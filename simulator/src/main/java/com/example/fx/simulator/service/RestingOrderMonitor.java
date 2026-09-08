package com.example.fx.simulator.service;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.UUID;
import com.example.fx.simulator.api.model.RestingOrderStatus;
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
public class RestingOrderMonitor {
    private static final Logger LOG = LoggerFactory.getLogger(RestingOrderMonitor.class);

    private final RestingOrderStore orders;
    private final SimulatorStateStore trades;
    private final FxPricingEngine pricing;
    private final SettlementCalculator settlement;
    private final Clock clock;

    public RestingOrderMonitor(RestingOrderStore orders, SimulatorStateStore trades, FxPricingEngine pricing,
                             SettlementCalculator settlement, Clock clock) {
        this.orders = orders;
        this.trades = trades;
        this.pricing = pricing;
        this.settlement = settlement;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${simulator.resting-orders.evaluation-interval:250ms}")
    public void evaluateWorkingOrders() {
        for (RestingOrder order : orders.workingOrders()) {
            try {
                evaluate(order);
            } catch (RuntimeException exception) {
                // The order stays working, so a transient failure only postpones it to the next pass.
                LOG.warn("Evaluation of resting order {} failed", order.orderId(), exception);
            }
        }
    }

    private void evaluate(RestingOrder order) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        if (order.expiredAt(now)) {
            closed(orders.closeWithEvent(order.key(), RestingOrderStatus.EXPIRED, now, null));
            return;
        }

        RestingOrderCommand command = order.command();
        Quote quote = pricing.price(command.pricing());
        Price price = quote.prices().get(command.pricing().side());
        orders.recordEvaluation(order.key(), now, price.clientPrice());
        if (!command.triggers(price.clientPrice())) {
            return;
        }

        Quote booked = quote.withStatus(QuoteStatus.BOOKED);
        Trade trade = new Trade(UUID.randomUUID(), command.context(), booked, price,
                settlement.calculate(command.pricing(), price), now);
        // Publish the trade first: a triggered event must never name a trade that cannot be retrieved.
        trades.addTrade(booked, trade);
        closed(orders.closeWithEvent(order.key(), RestingOrderStatus.TRIGGERED, now, trade));
    }

    private void closed(RestingOrder order) {
        if (order != null) {
            LOG.info("Resting order {} is {}", order.orderId(), order.status());
        }
    }
}
