package com.example.fx.simulator.service;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import com.example.fx.simulator.api.model.QuoteStatus;
import com.example.fx.simulator.api.model.Side;
import com.example.fx.simulator.config.SimulatorStateProperties;
import com.example.fx.simulator.domain.TradingModels.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** One monitor protects quote consumption, trade creation and idempotency publication as one operation. */
@Component
public class SimulatorStateStore {
    private final Clock clock;
    private final SimulatorStateProperties properties;
    private final RetainedMap<UUID, Quote> quotes;
    private final RetainedMap<UUID, Trade> trades;
    private final RetainedMap<IdempotencyScope, StoredBooking> bookings;

    public SimulatorStateStore(Clock clock, SimulatorStateProperties properties) {
        this.clock = clock;
        this.properties = properties;
        quotes = new RetainedMap<>(properties.maxQuotes());
        trades = new RetainedMap<>(properties.maxTrades());
        bookings = new RetainedMap<>(properties.maxIdempotencyKeys());
    }

    public synchronized void addQuote(Quote quote) {
        purge();
        quotes.requireCapacity();
        quotes.put(quote.quoteId(), quote, quote.expiresAt().toInstant().plus(properties.quoteRetention()));
    }

    public synchronized Quote getQuote(UUID id, Identity identity) {
        purge();
        Quote quote = quotes.get(id);
        if (quote == null || !quote.command().context().identity().equals(identity)) {
            throw SimulatorApiException.quoteNotFound(id);
        }
        return quote.withStatus(quote.statusAt(OffsetDateTime.now(clock)));
    }

    public synchronized Trade getTrade(UUID id, Identity identity) {
        purge();
        Trade trade = trades.get(id);
        if (trade == null || !trade.originalContext().identity().equals(identity)) {
            throw SimulatorApiException.tradeNotFound(id);
        }
        return trade;
    }

    public synchronized BookingResult book(RequestContext context, String key, UUID quoteId, Side side,
                                             Function<Quote, Trade> createTrade) {
        purge();
        IdempotencyScope scope = new IdempotencyScope(context.identity().customerId(), key);
        Fingerprint fingerprint = new Fingerprint(context.identity(), quoteId, side);
        StoredBooking existing = bookings.get(scope);
        if (existing != null) {
            if (!existing.fingerprint().equals(fingerprint)) {
                throw SimulatorApiException.idempotencyConflict(key);
            }
            return new BookingResult(existing.trade(), false);
        }

        Quote quote = getQuote(quoteId, context.identity());
        if (quote.status() == QuoteStatus.EXPIRED) throw SimulatorApiException.quoteExpired(quoteId);
        if (quote.status() == QuoteStatus.BOOKED) throw SimulatorApiException.quoteAlreadyBooked(quoteId);
        if (!quote.prices().containsKey(side)) throw SimulatorApiException.sideNotQuoted(side, quoteId);
        // Never evict an unexpired idempotency key or consume a quote when publication cannot succeed.
        trades.requireCapacity();
        bookings.requireCapacity();
        Trade trade = createTrade.apply(quote);
        Instant bookedAt = trade.bookedAt().toInstant();
        quotes.replace(quoteId, quote.withStatus(QuoteStatus.BOOKED));
        trades.put(trade.tradeId(), trade, bookedAt.plus(properties.tradeRetention()));
        bookings.put(scope, new StoredBooking(fingerprint, trade), bookedAt.plus(properties.idempotencyRetention()));
        return new BookingResult(trade, true);
    }

    /** A triggered limit order books outside the quote/idempotency flow, but its trade is retrieved the same way. */
    public synchronized void addTrade(Quote quote, Trade trade) {
        purge();
        quotes.requireCapacity();
        trades.requireCapacity();
        Instant bookedAt = trade.bookedAt().toInstant();
        quotes.put(quote.quoteId(), quote, quote.expiresAt().toInstant().plus(properties.quoteRetention()));
        trades.put(trade.tradeId(), trade, bookedAt.plus(properties.tradeRetention()));
    }

    @Scheduled(fixedDelayString = "${simulator.state.cleanup-interval:60s}")
    public synchronized void purge() {
        Instant now = clock.instant();
        quotes.purge(now);
        trades.purge(now);
        bookings.purge(now);
    }

    synchronized int[] sizes() {
        purge();
        return new int[]{quotes.size(), trades.size(), bookings.size()};
    }

    private record IdempotencyScope(String customerId, String key) {}
    private record Fingerprint(Identity identity, UUID quoteId, Side side) {}
    private record StoredBooking(Fingerprint fingerprint, Trade trade) {}
}
