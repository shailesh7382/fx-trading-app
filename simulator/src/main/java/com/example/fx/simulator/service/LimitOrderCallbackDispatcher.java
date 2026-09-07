package com.example.fx.simulator.service;

import com.example.fx.simulator.api.model.LimitOrderEvent;
import com.example.fx.simulator.api.model.LimitOrderExpiredEvent;
import com.example.fx.simulator.api.model.LimitOrderStatus;
import com.example.fx.simulator.api.model.LimitOrderTriggeredEvent;
import com.example.fx.simulator.config.LimitOrderProperties;
import com.example.fx.simulator.domain.TradingModels.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Delivers terminal order events out of band, at least once. Delivery is deliberately separate from
 * evaluation: an unreachable receiver delays only its own retries, never the matching of other orders.
 */
@Component
public class LimitOrderCallbackDispatcher {
    private static final Logger LOG = LoggerFactory.getLogger(LimitOrderCallbackDispatcher.class);

    private final LimitOrderStore store;
    private final RestClient client;

    public LimitOrderCallbackDispatcher(LimitOrderStore store, RestClient.Builder builder,
                                        LimitOrderProperties properties) {
        this.store = store;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(properties.callback().timeout());
        factory.setReadTimeout(properties.callback().timeout());
        this.client = builder.requestFactory(factory).build();
    }

    @Scheduled(fixedDelayString = "${simulator.limit-orders.dispatch-interval:200ms}")
    public void dispatchDueCallbacks() {
        for (DueCallback due : store.dueDeliveries()) {
            deliver(due.delivery(), due.order());
        }
    }

    private void deliver(CallbackDelivery delivery, LimitOrder order) {
        try {
            ResponseEntity<Void> response = client.post()
                    .uri(order.command().callbackUrl())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(event(delivery, order))
                    .retrieve()
                    // Any status is an outcome to record, never an exception to propagate to the scheduler.
                    .onStatus(status -> true, (request, ignored) -> { })
                    .toBodilessEntity();
            if (response.getStatusCode().is2xxSuccessful()) {
                store.recordDelivered(delivery);
                return;
            }
            LOG.warn("Callback for limit order {} refused with {}", order.orderId(), response.getStatusCode());
        } catch (RestClientException exception) {
            LOG.warn("Callback for limit order {} could not be delivered", order.orderId(), exception);
        }
        store.recordFailure(delivery);
    }

    private LimitOrderEvent event(CallbackDelivery delivery, LimitOrder order) {
        LimitOrderCommand command = order.command();
        PricingCommand pricing = command.pricing();
        Identity identity = command.context().identity();
        int attempt = delivery.attempts() + 1;
        if (order.status() == LimitOrderStatus.TRIGGERED) {
            Trade trade = order.trade();
            Price price = trade.price();
            Settlement settlement = trade.settlement();
            return new LimitOrderTriggeredEvent()
                    .eventId(delivery.eventId()).eventType("TRIGGERED").occurredAt(delivery.occurredAt()).attempt(attempt)
                    .orderId(order.orderId()).originalRequestId(command.context().requestId())
                    .channel(identity.channel()).segment(identity.segment()).customerId(identity.customerId())
                    .currencyPair(pricing.currencyPair()).quantity(pricing.quantity())
                    .quantityCurrency(pricing.quantityCurrency()).tenor(pricing.tenor()).side(pricing.side())
                    .limitPrice(command.limitPrice()).status(order.status())
                    .tradeId(trade.tradeId()).coverPrice(price.coverPrice()).clientPrice(price.clientPrice())
                    .swapPoints(price.swapPoints())
                    .buyCurrency(settlement.buyCurrency()).buyQuantity(settlement.buyQuantity())
                    .sellCurrency(settlement.sellCurrency()).sellQuantity(settlement.sellQuantity())
                    .spotDate(trade.quote().dates().spotDate()).valueDate(trade.quote().dates().valueDate());
        }
        return new LimitOrderExpiredEvent()
                .eventId(delivery.eventId()).eventType("EXPIRED").occurredAt(delivery.occurredAt()).attempt(attempt)
                .orderId(order.orderId()).originalRequestId(command.context().requestId())
                .channel(identity.channel()).segment(identity.segment()).customerId(identity.customerId())
                .currencyPair(pricing.currencyPair()).quantity(pricing.quantity())
                .quantityCurrency(pricing.quantityCurrency()).tenor(pricing.tenor()).side(pricing.side())
                .limitPrice(command.limitPrice()).status(order.status())
                .expiresAt(command.expiresAt()).lastEvaluatedPrice(order.lastEvaluatedPrice());
    }
}
