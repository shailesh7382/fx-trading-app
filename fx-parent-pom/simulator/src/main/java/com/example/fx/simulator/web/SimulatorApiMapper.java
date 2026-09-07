package com.example.fx.simulator.web;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.UUID;
import com.example.fx.simulator.api.model.*;
import com.example.fx.simulator.domain.TradingModels.*;
import com.example.fx.simulator.service.SimulatorApiException;
import org.springframework.stereotype.Component;

@Component
public class SimulatorApiMapper {
    private final Clock clock;
    public SimulatorApiMapper(Clock clock) { this.clock = clock; }

    public PricingCommand command(PriceRequest request) {
        if (request instanceof OneWayPriceRequest one) {
            if (one.getSide() == null || !"ONE_WAY".equals(one.getQuoteType())) {
                throw SimulatorApiException.invalidPricingRequest("ONE_WAY requires side.");
            }
            return new PricingCommand(new RequestContext(one.getRequestId(), one.getChannel(), one.getSegment(), one.getCustomerId()),
                    one.getCurrencyPair(), one.getQuantity(), one.getQuantityCurrency(), one.getTenor(), one.getSide());
        }
        if (request instanceof TwoWayPriceRequest two && "TWO_WAY".equals(two.getQuoteType())) {
            return new PricingCommand(new RequestContext(two.getRequestId(), two.getChannel(), two.getSegment(), two.getCustomerId()),
                    two.getCurrencyPair(), two.getQuantity(), two.getQuantityCurrency(), two.getTenor(), null);
        }
        throw SimulatorApiException.invalidPricingRequest("Unknown pricing variant.");
    }

    public RequestContext context(BookingRequest request) {
        return new RequestContext(request.getRequestId(), request.getChannel(), request.getSegment(), request.getCustomerId());
    }

    public PriceQuote quote(Quote quote, RequestContext context) {
        PricingCommand command = quote.command();
        Identity identity = context.identity();
        if (!command.twoWay()) {
            Price price = quote.prices().get(command.side());
            return new OneWayPriceQuote()
                    .quoteType("ONE_WAY").requestId(context.requestId())
                    .channel(identity.channel()).segment(identity.segment()).customerId(identity.customerId())
                    .originalRequestId(command.context().requestId()).responseId(UUID.randomUUID()).responseAt(now())
                    .quoteId(quote.quoteId()).currencyPair(command.currencyPair()).quantity(command.quantity())
                    .quantityCurrency(command.quantityCurrency()).tenor(command.tenor())
                    .spotDate(quote.dates().spotDate()).valueDate(quote.dates().valueDate())
                    .quotedAt(quote.quotedAt()).expiresAt(quote.expiresAt()).status(quote.status())
                    .side(price.side()).coverPrice(price.coverPrice()).clientPrice(price.clientPrice()).swapPoints(price.swapPoints());
        }
        Price buy = quote.prices().get(Side.BUY);
        Price sell = quote.prices().get(Side.SELL);
        return new TwoWayPriceQuote()
                .quoteType("TWO_WAY").requestId(context.requestId())
                .channel(identity.channel()).segment(identity.segment()).customerId(identity.customerId())
                .originalRequestId(command.context().requestId()).responseId(UUID.randomUUID()).responseAt(now())
                .quoteId(quote.quoteId()).currencyPair(command.currencyPair()).quantity(command.quantity())
                .quantityCurrency(command.quantityCurrency()).tenor(command.tenor())
                .spotDate(quote.dates().spotDate()).valueDate(quote.dates().valueDate())
                .quotedAt(quote.quotedAt()).expiresAt(quote.expiresAt()).status(quote.status())
                .buyCoverPrice(buy.coverPrice()).buyClientPrice(buy.clientPrice()).buySwapPoints(buy.swapPoints())
                .sellCoverPrice(sell.coverPrice()).sellClientPrice(sell.clientPrice()).sellSwapPoints(sell.swapPoints());
    }

    public BookedTrade trade(Trade trade, RequestContext context) {
        Quote quote = trade.quote();
        PricingCommand command = quote.command();
        Identity identity = context.identity();
        Price price = trade.price();
        Settlement settlement = trade.settlement();
        return new BookedTrade().requestId(context.requestId())
                .channel(identity.channel()).segment(identity.segment()).customerId(identity.customerId())
                .originalRequestId(trade.originalContext().requestId()).responseId(UUID.randomUUID()).responseAt(now())
                .tradeId(trade.tradeId()).quoteId(quote.quoteId()).currencyPair(command.currencyPair())
                .quantity(command.quantity()).quantityCurrency(command.quantityCurrency()).tenor(command.tenor())
                .side(price.side()).coverPrice(price.coverPrice()).clientPrice(price.clientPrice()).swapPoints(price.swapPoints())
                .buyCurrency(settlement.buyCurrency()).buyQuantity(settlement.buyQuantity())
                .sellCurrency(settlement.sellCurrency()).sellQuantity(settlement.sellQuantity())
                .spotDate(quote.dates().spotDate()).valueDate(quote.dates().valueDate())
                .bookedAt(trade.bookedAt()).status(TradeStatus.BOOKED);
    }

    private OffsetDateTime now() { return OffsetDateTime.now(clock); }
}
