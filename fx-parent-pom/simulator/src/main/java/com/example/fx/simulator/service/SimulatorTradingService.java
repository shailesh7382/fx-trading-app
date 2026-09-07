package com.example.fx.simulator.service;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.UUID;
import com.example.fx.simulator.api.model.Side;
import com.example.fx.simulator.domain.TradingModels.*;
import org.springframework.stereotype.Service;

@Service
public class SimulatorTradingService {
    private final FxPricingEngine pricing;
    private final SimulatorStateStore store;
    private final SettlementCalculator settlement;
    private final Clock clock;

    public SimulatorTradingService(FxPricingEngine pricing, SimulatorStateStore store,
                                   SettlementCalculator settlement, Clock clock) {
        this.pricing = pricing;
        this.store = store;
        this.settlement = settlement;
        this.clock = clock;
    }

    public Quote requestPrice(PricingCommand command) {
        Quote quote = pricing.price(command);
        store.addQuote(quote);
        return quote;
    }

    public Quote getPriceQuote(UUID quoteId, RequestContext context) {
        return store.getQuote(quoteId, context.identity());
    }

    public BookingResult bookTrade(RequestContext context, String idempotencyKey, UUID quoteId, Side side) {
        if (idempotencyKey == null || !idempotencyKey.matches("[A-Za-z0-9._:-]{1,100}") || quoteId == null || side == null) {
            throw SimulatorApiException.invalidRequest("Idempotency-Key, quoteId, and side are required.");
        }
        return store.book(context, idempotencyKey, quoteId, side, quote -> {
            Price price = quote.prices().get(side);
            return new Trade(UUID.randomUUID(), context, quote, price,
                    settlement.calculate(quote.command(), price), OffsetDateTime.now(clock));
        });
    }

    public Trade getBooking(UUID tradeId, RequestContext context) {
        return store.getTrade(tradeId, context.identity());
    }
}
