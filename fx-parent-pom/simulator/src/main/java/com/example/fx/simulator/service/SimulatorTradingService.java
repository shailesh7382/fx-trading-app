package com.example.fx.simulator.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.random.RandomGenerator;

import com.example.fx.simulator.api.model.BookedTrade;
import com.example.fx.simulator.api.model.BookingRequest;
import com.example.fx.simulator.api.model.PriceQuote;
import com.example.fx.simulator.api.model.PriceRequest;
import com.example.fx.simulator.api.model.QuoteStatus;
import com.example.fx.simulator.api.model.QuoteType;
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

    private static final BigDecimal CLIENT_MARKUP_FACTOR = new BigDecimal("0.75");

    private final Map<UUID, QuoteState> quotes = new ConcurrentHashMap<>();
    private final Map<UUID, TradeState> trades = new ConcurrentHashMap<>();
    private final Map<BookingRequestKey, StoredBooking> bookingsByRequest = new ConcurrentHashMap<>();
    private final Clock clock;
    private final RandomGenerator random;
    private final FxSwapCurve swapCurve;
    private final Duration quoteTtl;

    public SimulatorTradingService(
            Clock clock,
            RandomGenerator random,
            FxSwapCurve swapCurve,
            @Value("${simulator.quote-ttl:30s}") Duration quoteTtl
    ) {
        this.clock = clock;
        this.random = random;
        this.swapCurve = swapCurve;
        this.quoteTtl = quoteTtl;
    }

    public PriceQuote requestPrice(PriceRequest request) {
        validatePricingRequest(request);
        BigDecimal referenceRate = REFERENCE_RATES.get(request.getCurrencyPair());
        if (referenceRate == null) {
            throw SimulatorApiException.unsupportedInstrument(request.getCurrencyPair());
        }

        OffsetDateTime quotedAt = now();
        int rateScale = request.getCurrencyPair().endsWith("JPY") ? 3 : 5;
        BigDecimal spotMid = referenceRate.add(randomMovement(rateScale));
        BigDecimal swapPoints = swapCurve.swapPoints(
                request.getCurrencyPair(),
                request.getTenor(),
                spotMid,
                rateScale
        );
        BigDecimal forwardMid = spotMid.add(swapPoints);
        BigDecimal halfSpread = calculateHalfSpread(request.getQuantity(), rateScale);
        BigDecimal clientMarkup = halfSpread.multiply(CLIENT_MARKUP_FACTOR);
        List<PriceState> prices = requestedSides(request).stream()
                .map(side -> createPrice(
                        request.getCurrencyPair(),
                        request.getQuantityCurrency(),
                        side,
                        forwardMid,
                        halfSpread,
                        clientMarkup,
                        swapPoints,
                        rateScale
                ))
                .toList();

        QuoteState quote = new QuoteState(
                request.getRequestId(),
                request.getChannel(),
                request.getSegment(),
                request.getCustomerId(),
                UUID.randomUUID(),
                request.getCurrencyPair(),
                request.getQuantity(),
                request.getQuantityCurrency(),
                request.getTenor(),
                request.getQuoteType(),
                prices,
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
        BookingRequestKey requestKey = new BookingRequestKey(
                request.getRequestId(),
                request.getChannel(),
                request.getSegment(),
                request.getCustomerId()
        );
        BookingFingerprint requestedBooking = new BookingFingerprint(
                request.getQuoteId(),
                request.getSide()
        );
        StoredBooking existingBooking = bookingsByRequest.get(requestKey);
        if (existingBooking != null) {
            if (!existingBooking.fingerprint().equals(requestedBooking)) {
                throw SimulatorApiException.idempotencyConflict(request.getRequestId());
            }
            return new BookingResult(toTrade(existingBooking.trade()), false);
        }

        QuoteState quote = quotes.get(request.getQuoteId());
        if (quote == null || !quote.customerId().equals(request.getCustomerId())) {
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

        UUID quoteId = quote.quoteId();
        PriceState selectedPrice = quote.prices().stream()
                .filter(price -> price.side() == request.getSide())
                .findFirst()
                .orElseThrow(() -> SimulatorApiException.sideNotQuoted(request.getSide(), quoteId));
        TradeState trade = new TradeState(
                request.getRequestId(),
                request.getChannel(),
                request.getSegment(),
                request.getCustomerId(),
                UUID.randomUUID(),
                quote.quoteId(),
                quote.currencyPair(),
                quote.quantity(),
                quote.quantityCurrency(),
                quote.tenor(),
                selectedPrice.side(),
                selectedPrice.coverPrice(),
                selectedPrice.clientPrice(),
                selectedPrice.swapPoints(),
                quote.valueDate(),
                now()
        );

        quotes.put(quote.quoteId(), quote.withStatus(QuoteStatus.BOOKED));
        trades.put(trade.tradeId(), trade);
        bookingsByRequest.put(requestKey, new StoredBooking(requestedBooking, trade));
        return new BookingResult(toTrade(trade), true);
    }

    public BookedTrade getBooking(UUID tradeId) {
        TradeState trade = trades.get(tradeId);
        if (trade == null) {
            throw SimulatorApiException.tradeNotFound(tradeId);
        }
        return toTrade(trade);
    }

    private void validatePricingRequest(PriceRequest request) {
        String quantityCurrency = request.getQuantityCurrency();
        String currencyPair = request.getCurrencyPair();
        boolean currencyBelongsToPair = currencyPair.substring(0, 3).equals(quantityCurrency)
                || currencyPair.substring(3, 6).equals(quantityCurrency);
        if (!currencyBelongsToPair) {
            throw SimulatorApiException.invalidPricingRequest(
                    "quantityCurrency must be one of the currencies in currencyPair."
            );
        }
        if (request.getQuoteType() == QuoteType.ONE_WAY && request.getSide() == null) {
            throw SimulatorApiException.invalidPricingRequest("side is required for a ONE_WAY price request.");
        }
        if (request.getQuoteType() == QuoteType.TWO_WAY && request.getSide() != null) {
            throw SimulatorApiException.invalidPricingRequest("side must be omitted for a TWO_WAY price request.");
        }
    }

    private List<Side> requestedSides(PriceRequest request) {
        return request.getQuoteType() == QuoteType.TWO_WAY
                ? List.of(Side.BUY, Side.SELL)
                : List.of(request.getSide());
    }

    private PriceState createPrice(
            String currencyPair,
            String quantityCurrency,
            Side side,
            BigDecimal forwardMid,
            BigDecimal halfSpread,
            BigDecimal clientMarkup,
            BigDecimal swapPoints,
            int rateScale
    ) {
        boolean customerBuysBase = customerBuysBase(currencyPair, quantityCurrency, side);
        BigDecimal coverPrice = customerBuysBase
                ? forwardMid.add(halfSpread)
                : forwardMid.subtract(halfSpread);
        BigDecimal clientPrice = customerBuysBase
                ? coverPrice.add(clientMarkup)
                : coverPrice.subtract(clientMarkup);
        return new PriceState(
                side,
                coverPrice.setScale(rateScale, RoundingMode.HALF_UP),
                clientPrice.setScale(rateScale, RoundingMode.HALF_UP),
                swapPoints
        );
    }

    private boolean customerBuysBase(String currencyPair, String quantityCurrency, Side side) {
        boolean quantityIsBase = currencyPair.startsWith(quantityCurrency);
        return (quantityIsBase && side == Side.BUY) || (!quantityIsBase && side == Side.SELL);
    }

    private QuoteState withCurrentStatus(QuoteState quote) {
        if (quote.status() == QuoteStatus.ACTIVE && !now().isBefore(quote.expiresAt())) {
            return quote.withStatus(QuoteStatus.EXPIRED);
        }
        return quote;
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC);
    }

    private BigDecimal randomMovement(int rateScale) {
        BigDecimal range = rateScale == 3 ? new BigDecimal("0.050") : new BigDecimal("0.00050");
        double sample;
        synchronized (random) {
            sample = random.nextDouble();
        }
        return BigDecimal.valueOf((sample * 2.0) - 1.0).multiply(range);
    }

    private BigDecimal calculateHalfSpread(BigDecimal quantity, int rateScale) {
        BigDecimal baseHalfSpread = rateScale == 3 ? new BigDecimal("0.005") : new BigDecimal("0.00005");
        BigDecimal sizeFactor = quantity
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
        PriceQuote response = new PriceQuote(
                quote.requestId(),
                UUID.randomUUID(),
                now(),
                quote.channel(),
                quote.segment(),
                quote.customerId(),
                quote.quoteId(),
                quote.currencyPair(),
                quote.quantity(),
                quote.quantityCurrency(),
                quote.tenor(),
                quote.quoteType(),
                quote.valueDate(),
                quote.quotedAt(),
                quote.expiresAt(),
                quote.status()
        );

        if (quote.quoteType() == QuoteType.ONE_WAY) {
            PriceState price = quote.prices().getFirst();
            response.setSide(price.side());
            response.setCoverPrice(price.coverPrice());
            response.setClientPrice(price.clientPrice());
            response.setSwapPoints(price.swapPoints());
        } else {
            PriceState buyPrice = priceForSide(quote, Side.BUY);
            response.setBuyCoverPrice(buyPrice.coverPrice());
            response.setBuyClientPrice(buyPrice.clientPrice());
            response.setBuySwapPoints(buyPrice.swapPoints());

            PriceState sellPrice = priceForSide(quote, Side.SELL);
            response.setSellCoverPrice(sellPrice.coverPrice());
            response.setSellClientPrice(sellPrice.clientPrice());
            response.setSellSwapPoints(sellPrice.swapPoints());
        }
        return response;
    }

    private PriceState priceForSide(QuoteState quote, Side side) {
        return quote.prices().stream()
                .filter(price -> price.side() == side)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Missing " + side + " price for quote " + quote.quoteId()));
    }

    private BookedTrade toTrade(TradeState trade) {
        return new BookedTrade(
                trade.requestId(),
                UUID.randomUUID(),
                now(),
                trade.channel(),
                trade.segment(),
                trade.customerId(),
                trade.tradeId(),
                trade.quoteId(),
                trade.currencyPair(),
                trade.quantity(),
                trade.quantityCurrency(),
                trade.tenor(),
                trade.side(),
                trade.coverPrice(),
                trade.clientPrice(),
                trade.swapPoints(),
                trade.valueDate(),
                trade.bookedAt(),
                TradeStatus.BOOKED
        );
    }

    public record BookingResult(BookedTrade trade, boolean created) {
    }

    private record BookingRequestKey(
            String requestId,
            String channel,
            String segment,
            String customerId
    ) {
    }

    private record BookingFingerprint(UUID quoteId, Side side) {
    }

    private record StoredBooking(BookingFingerprint fingerprint, TradeState trade) {
    }

    private record PriceState(
            Side side,
            BigDecimal coverPrice,
            BigDecimal clientPrice,
            BigDecimal swapPoints
    ) {
    }

    private record QuoteState(
            String requestId,
            String channel,
            String segment,
            String customerId,
            UUID quoteId,
            String currencyPair,
            BigDecimal quantity,
            String quantityCurrency,
            Tenor tenor,
            QuoteType quoteType,
            List<PriceState> prices,
            LocalDate valueDate,
            OffsetDateTime quotedAt,
            OffsetDateTime expiresAt,
            QuoteStatus status
    ) {
        private QuoteState withStatus(QuoteStatus newStatus) {
            return new QuoteState(
                    requestId,
                    channel,
                    segment,
                    customerId,
                    quoteId,
                    currencyPair,
                    quantity,
                    quantityCurrency,
                    tenor,
                    quoteType,
                    prices,
                    valueDate,
                    quotedAt,
                    expiresAt,
                    newStatus
            );
        }
    }

    private record TradeState(
            String requestId,
            String channel,
            String segment,
            String customerId,
            UUID tradeId,
            UUID quoteId,
            String currencyPair,
            BigDecimal quantity,
            String quantityCurrency,
            Tenor tenor,
            Side side,
            BigDecimal coverPrice,
            BigDecimal clientPrice,
            BigDecimal swapPoints,
            LocalDate valueDate,
            OffsetDateTime bookedAt
    ) {
    }
}
