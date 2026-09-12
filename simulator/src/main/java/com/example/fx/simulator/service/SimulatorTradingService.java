package com.example.fx.simulator.service;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.UUID;
import com.example.fx.simulator.api.model.Side;
import com.example.fx.simulator.domain.TradingModels.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class SimulatorTradingService {
    private static final Logger LOG = LoggerFactory.getLogger(SimulatorTradingService.class);

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
        LOG.debug("Pricing request requestId={} pair={} tenor={} side={} twoWay={} quantity={} {}",
                command.context().requestId(), command.currencyPair(), command.tenor(), command.side(),
                command.twoWay(), command.quantity(), command.quantityCurrency());
        Quote quote = pricing.price(command);
        store.addQuote(quote);
        LOG.info("Quote created quoteId={} requestId={} pair={} tenor={} expiresAt={}",
                quote.quoteId(), command.context().requestId(), command.currencyPair(), command.tenor(), quote.expiresAt());
        return quote;
    }

    public Quote getPriceQuote(UUID quoteId, RequestContext context) {
        LOG.debug("Looking up quote quoteId={} requestId={}", quoteId, context.requestId());
        return store.getQuote(quoteId, context.identity());
    }

    public BookingResult bookTrade(RequestContext context, String idempotencyKey, UUID quoteId, Side side) {
        if (idempotencyKey == null || !idempotencyKey.matches("[A-Za-z0-9._:-]{1,100}") || quoteId == null || side == null) {
            throw SimulatorApiException.invalidRequest("Idempotency-Key, quoteId, and side are required.");
        }
        BookingResult result = store.book(context, idempotencyKey, quoteId, side, quote -> {
            Price price = quote.prices().get(side);
            return new Trade(UUID.randomUUID(), context, quote, price,
                    settlement.calculate(quote.command(), price), OffsetDateTime.now(clock));
        });
        if (result.created()) {
            LOG.info("Trade booked tradeId={} quoteId={} requestId={} side={} clientPrice={}",
                    result.trade().tradeId(), quoteId, context.requestId(), side, result.trade().price().clientPrice());
        } else {
            LOG.debug("Booking replayed tradeId={} quoteId={} requestId={}",
                    result.trade().tradeId(), quoteId, context.requestId());
        }
        return result;
    }

    public Trade getBooking(UUID tradeId, RequestContext context) {
        LOG.debug("Looking up trade tradeId={} requestId={}", tradeId, context.requestId());
        return store.getTrade(tradeId, context.identity());
    }
}
