package com.example.fx.simulator.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.random.RandomGenerator;

import com.example.fx.simulator.api.model.BookedTrade;
import com.example.fx.simulator.api.model.BookingRequest;
import com.example.fx.simulator.api.model.PriceQuote;
import com.example.fx.simulator.api.model.PriceRequest;
import com.example.fx.simulator.api.model.QuoteStatus;
import com.example.fx.simulator.api.model.Side;
import com.example.fx.simulator.api.model.Tenor;
import com.example.fx.simulator.api.model.TradeStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class SimulatorTradingService {

    private static final Map<String, BigDecimal> REFERENCE_RATES = Map.ofEntries(
            Map.entry("EURUSD", new BigDecimal("1.10000")),
            Map.entry("GBPUSD", new BigDecimal("1.30000")),
            Map.entry("USDJPY", new BigDecimal("145.000")),
            Map.entry("AUDUSD", new BigDecimal("0.70000")),
            Map.entry("USDCAD", new BigDecimal("1.25000")),
            Map.entry("NZDUSD", new BigDecimal("0.65000")),
            Map.entry("USDCHF", new BigDecimal("0.90000")),
            Map.entry("EURGBP", new BigDecimal("0.85000")),
            Map.entry("EURJPY", new BigDecimal("159.500")),
            Map.entry("GBPJPY", new BigDecimal("188.500")),
            Map.entry("AUDJPY", new BigDecimal("101.500")),
            Map.entry("CADJPY", new BigDecimal("116.000")),
            Map.entry("CHFJPY", new BigDecimal("161.000")),
            Map.entry("NZDJPY", new BigDecimal("94.250")),
            Map.entry("EURCAD", new BigDecimal("1.37500")),
            Map.entry("GBPCAD", new BigDecimal("1.62500")),
            Map.entry("AUDCAD", new BigDecimal("0.87500")),
            Map.entry("NZDCAD", new BigDecimal("0.81250")),
            Map.entry("EURCHF", new BigDecimal("0.99000")),
            Map.entry("GBPCHF", new BigDecimal("1.17000")),
            Map.entry("AUDCHF", new BigDecimal("0.63000")),
            Map.entry("CADCHF", new BigDecimal("0.72000")),
            Map.entry("NZDCHF", new BigDecimal("0.58500")),
            Map.entry("EURNZD", new BigDecimal("1.69230")),
            Map.entry("GBPNZD", new BigDecimal("2.00000")),
            Map.entry("AUDNZD", new BigDecimal("1.07690")),
            Map.entry("CADNZD", new BigDecimal("1.53850")),
            Map.entry("CHFNZD", new BigDecimal("1.70940"))
    );

    private final Map<UUID, QuoteState> quotes = new ConcurrentHashMap<>();
    private final Map<UUID, TradeState> trades = new ConcurrentHashMap<>();
    private final Map<String, StoredBooking> bookingsByClientRequest = new ConcurrentHashMap<>();
    private final Clock clock;
    private final RandomGenerator random;
    private final Duration quoteTtl;

    public SimulatorTradingService(
            Clock clock,
            RandomGenerator random,
            @Value("${simulator.quote-ttl:30s}") Duration quoteTtl
    ) {
        this.clock = clock;
        this.random = random;
        this.quoteTtl = quoteTtl;
    }

    public PriceQuote requestPrice(PriceRequest request) {
        BigDecimal referenceRate = REFERENCE_RATES.get(request.getCurrencyPair());
        if (referenceRate == null) {
            throw SimulatorApiException.unsupportedInstrument(request.getCurrencyPair());
        }

        OffsetDateTime quotedAt = OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC);
        int rateScale = request.getCurrencyPair().endsWith("JPY") ? 3 : 5;
        BigDecimal halfSpread = calculateHalfSpread(request.getAmount(), rateScale);
        BigDecimal mid = referenceRate.add(randomMovement(rateScale));
        QuoteState quote = new QuoteState(
                UUID.randomUUID(),
                request.getCurrencyPair(),
                request.getAmount(),
                request.getTenor(),
                mid.subtract(halfSpread).setScale(rateScale, RoundingMode.HALF_UP),
                mid.add(halfSpread).setScale(rateScale, RoundingMode.HALF_UP),
                calculateValueDate(quotedAt.toLocalDate(), request.getTenor()),
                quotedAt,
                quotedAt.plus(quoteTtl),
                QuoteStatus.ACTIVE
        );

        quotes.put(quote.quoteId(), quote);
        return toQuote(quote);
    }

    public PriceQuote getPriceQuote(UUID quoteId) {
        QuoteState quote = quotes.get(quoteId);
        if (quote == null) {
            throw SimulatorApiException.quoteNotFound(quoteId);
        }
        return toQuote(withCurrentStatus(quote));
    }

    public synchronized BookingResult bookTrade(BookingRequest request) {
        BookingFingerprint requestedBooking = new BookingFingerprint(request.getQuoteId(), request.getSide());
        StoredBooking existingBooking = bookingsByClientRequest.get(request.getClientRequestId());
        if (existingBooking != null) {
            if (!existingBooking.fingerprint().equals(requestedBooking)) {
                throw SimulatorApiException.idempotencyConflict(request.getClientRequestId());
            }
            return new BookingResult(toTrade(existingBooking.trade()), false);
        }

        QuoteState quote = quotes.get(request.getQuoteId());
        if (quote == null) {
            throw SimulatorApiException.quoteNotFound(request.getQuoteId());
        }

        quote = withCurrentStatus(quote);
        if (quote.status() == QuoteStatus.EXPIRED) {
            quotes.put(quote.quoteId(), quote);
            throw SimulatorApiException.quoteExpired(quote.quoteId());
        }
        if (quote.status() == QuoteStatus.BOOKED) {
            throw SimulatorApiException.quoteAlreadyBooked(quote.quoteId());
        }

        OffsetDateTime bookedAt = OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC);
        TradeState trade = new TradeState(
                UUID.randomUUID(),
                request.getClientRequestId(),
                quote.quoteId(),
                quote.currencyPair(),
                quote.amount(),
                quote.tenor(),
                request.getSide(),
                request.getSide() == Side.BUY ? quote.ask() : quote.bid(),
                quote.valueDate(),
                bookedAt
        );

        quotes.put(quote.quoteId(), quote.withStatus(QuoteStatus.BOOKED));
        trades.put(trade.tradeId(), trade);
        bookingsByClientRequest.put(
                request.getClientRequestId(),
                new StoredBooking(requestedBooking, trade)
        );
        return new BookingResult(toTrade(trade), true);
    }

    public BookedTrade getBooking(UUID tradeId) {
        TradeState trade = trades.get(tradeId);
        if (trade == null) {
            throw SimulatorApiException.tradeNotFound(tradeId);
        }
        return toTrade(trade);
    }

    private QuoteState withCurrentStatus(QuoteState quote) {
        if (quote.status() == QuoteStatus.ACTIVE
                && !OffsetDateTime.now(clock).isBefore(quote.expiresAt())) {
            return quote.withStatus(QuoteStatus.EXPIRED);
        }
        return quote;
    }

    private BigDecimal randomMovement(int rateScale) {
        BigDecimal range = rateScale == 3 ? new BigDecimal("0.050") : new BigDecimal("0.00050");
        double sample;
        synchronized (random) {
            sample = random.nextDouble();
        }
        return BigDecimal.valueOf((sample * 2.0) - 1.0).multiply(range);
    }

    private BigDecimal calculateHalfSpread(BigDecimal amount, int rateScale) {
        BigDecimal baseHalfSpread = rateScale == 3 ? new BigDecimal("0.005") : new BigDecimal("0.00005");
        BigDecimal sizeFactor = amount
                .divide(new BigDecimal("25000000"), 8, RoundingMode.HALF_UP)
                .min(new BigDecimal("4"))
                .multiply(new BigDecimal("0.25"))
                .add(BigDecimal.ONE);
        return baseHalfSpread.multiply(sizeFactor);
    }

    private LocalDate calculateValueDate(LocalDate tradeDate, Tenor tenor) {
        LocalDate spotDate = addBusinessDays(tradeDate, 2);
        LocalDate unadjusted = switch (tenor) {
            case SPOT -> spotDate;
            case ONE_WEEK -> spotDate.plusWeeks(1);
            case ONE_MONTH -> spotDate.plusMonths(1);
            case THREE_MONTHS -> spotDate.plusMonths(3);
            case SIX_MONTHS -> spotDate.plusMonths(6);
            case ONE_YEAR -> spotDate.plusYears(1);
        };
        return moveToNextBusinessDay(unadjusted);
    }

    private LocalDate addBusinessDays(LocalDate date, int numberOfDays) {
        LocalDate result = date;
        int added = 0;
        while (added < numberOfDays) {
            result = result.plusDays(1);
            if (isBusinessDay(result)) {
                added++;
            }
        }
        return result;
    }

    private LocalDate moveToNextBusinessDay(LocalDate date) {
        LocalDate result = date;
        while (!isBusinessDay(result)) {
            result = result.plusDays(1);
        }
        return result;
    }

    private boolean isBusinessDay(LocalDate date) {
        return date.getDayOfWeek() != DayOfWeek.SATURDAY
                && date.getDayOfWeek() != DayOfWeek.SUNDAY;
    }

    private PriceQuote toQuote(QuoteState quote) {
        return new PriceQuote(
                quote.quoteId(),
                quote.currencyPair(),
                quote.amount(),
                quote.tenor(),
                quote.bid(),
                quote.ask(),
                quote.valueDate(),
                quote.quotedAt(),
                quote.expiresAt(),
                quote.status()
        );
    }

    private BookedTrade toTrade(TradeState trade) {
        return new BookedTrade(
                trade.tradeId(),
                trade.clientRequestId(),
                trade.quoteId(),
                trade.currencyPair(),
                trade.amount(),
                trade.tenor(),
                trade.side(),
                trade.executionRate(),
                trade.valueDate(),
                trade.bookedAt(),
                TradeStatus.BOOKED
        );
    }

    public record BookingResult(BookedTrade trade, boolean created) {
    }

    private record BookingFingerprint(UUID quoteId, Side side) {
    }

    private record StoredBooking(BookingFingerprint fingerprint, TradeState trade) {
    }

    private record QuoteState(
            UUID quoteId,
            String currencyPair,
            BigDecimal amount,
            Tenor tenor,
            BigDecimal bid,
            BigDecimal ask,
            LocalDate valueDate,
            OffsetDateTime quotedAt,
            OffsetDateTime expiresAt,
            QuoteStatus status
    ) {
        private QuoteState withStatus(QuoteStatus newStatus) {
            return new QuoteState(
                    quoteId,
                    currencyPair,
                    amount,
                    tenor,
                    bid,
                    ask,
                    valueDate,
                    quotedAt,
                    expiresAt,
                    newStatus
            );
        }
    }

    private record TradeState(
            UUID tradeId,
            String clientRequestId,
            UUID quoteId,
            String currencyPair,
            BigDecimal amount,
            Tenor tenor,
            Side side,
            BigDecimal executionRate,
            LocalDate valueDate,
            OffsetDateTime bookedAt
    ) {
    }
}
