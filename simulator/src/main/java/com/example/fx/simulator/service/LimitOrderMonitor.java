package com.example.fx.simulator.service;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.UUID;
import com.example.fx.simulator.api.model.LimitOrderStatus;
import com.example.fx.simulator.api.model.QuoteStatus;
import com.example.fx.simulator.domain.TradingModels.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Re-prices every working order on a fixed interval. Evaluation happens outside the store's monitor,
 * so a slow pricing pass never blocks placement, lookup, or cancellation.
 */
@Component
public class LimitOrderMonitor {
    private static final Logger LOG = LoggerFactory.getLogger(LimitOrderMonitor.class);

    private final LimitOrderStore orders;
    private final SimulatorStateStore trades;
    private final FxPricingEngine pricing;
    private final SettlementCalculator settlement;
    private final Clock clock;

    public LimitOrderMonitor(LimitOrderStore orders, SimulatorStateStore trades, FxPricingEngine pricing,
                             SettlementCalculator settlement, Clock clock) {
        this.orders = orders;
        this.trades = trades;
        this.pricing = pricing;
        this.settlement = settlement;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${simulator.limit-orders.evaluation-interval:250ms}")
    public void evaluateWorkingOrders() {
        for (LimitOrder order : orders.workingOrders()) {
            try {
                evaluate(order);
            } catch (RuntimeException exception) {
                // The order stays working, so a transient failure only postpones it to the next pass.
                LOG.warn("Evaluation of limit order {} failed", order.orderId(), exception);
            }
        }
    }

    private void evaluate(LimitOrder order) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        if (order.expiredAt(now)) {
            closed(orders.closeWithEvent(order.orderId(), LimitOrderStatus.EXPIRED, now, null));
            return;
        }

        LimitOrderCommand command = order.command();
        Quote quote = pricing.price(command.pricing());
        Price price = quote.prices().get(command.pricing().side());
        orders.recordEvaluation(order.orderId(), now, price.clientPrice());
        if (!command.triggers(price.clientPrice())) {
            return;
        }

        Quote booked = quote.withStatus(QuoteStatus.BOOKED);
        Trade trade = new Trade(UUID.randomUUID(), command.context(), booked, price,
                settlement.calculate(command.pricing(), price), now);
        // Publish the trade first: a triggered event must never name a trade that cannot be retrieved.
        trades.addTrade(booked, trade);
        closed(orders.closeWithEvent(order.orderId(), LimitOrderStatus.TRIGGERED, now, trade));
    }

    private void closed(LimitOrder order) {
        if (order != null) {
            LOG.info("Limit order {} is {}", order.orderId(), order.status());
        }
    }
}
