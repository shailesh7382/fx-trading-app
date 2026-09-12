package com.example.fx.simulator.service;

import com.example.fx.simulator.api.model.RestingOrderEvent;
import com.example.fx.simulator.api.model.RestingOrderExpiredEvent;
import com.example.fx.simulator.api.model.RestingOrderStatus;
import com.example.fx.simulator.api.model.RestingOrderTriggeredEvent;
import com.example.fx.simulator.config.RestingOrderProperties;
import com.example.fx.simulator.domain.TradingModels.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
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
public class RestingOrderCallbackDispatcher {
    private static final Logger LOG = LoggerFactory.getLogger(RestingOrderCallbackDispatcher.class);

    private final RestingOrderStore store;
    private final ObjectMapper mapper;
    private final RestClient client;

    public RestingOrderCallbackDispatcher(RestingOrderStore store, ObjectMapper mapper, RestClient.Builder builder,
                                        RestingOrderProperties properties) {
        this.store = store;
        this.mapper = mapper;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(properties.callback().timeout());
        factory.setReadTimeout(properties.callback().timeout());
        this.client = builder.requestFactory(factory).build();
    }

    @Scheduled(fixedDelayString = "${simulator.resting-orders.dispatch-interval:200ms}")
    public void dispatchDueCallbacks() {
        for (DueCallback due : store.dueDeliveries()) {
            deliver(due.delivery(), due.order());
        }
    }

    private void deliver(CallbackDelivery delivery, RestingOrder order) {
        int attempt = delivery.attempts() + 1;
        LOG.debug("Delivering resting-order callback eventId={} orderId={} attempt={}",
                delivery.eventId(), order.orderId(), attempt);
        try {
            ResponseEntity<Void> response = client.post()
                    .uri(order.command().callbackUrl())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(mapper.writeValueAsBytes(event(delivery, order)))
                    .retrieve()
                    // Any status is an outcome to record, never an exception to propagate to the scheduler.
                    .onStatus(status -> true, (request, ignored) -> { })
                    .toBodilessEntity();
            if (response.getStatusCode().is2xxSuccessful()) {
                store.recordDelivered(delivery);
                LOG.info("Resting-order callback delivered eventId={} orderId={} attempt={} status={}",
                        delivery.eventId(), order.orderId(), attempt, response.getStatusCode());
                return;
            }
            LOG.warn("Resting-order callback refused eventId={} orderId={} attempt={} status={}",
                    delivery.eventId(), order.orderId(), attempt, response.getStatusCode());
        } catch (RestClientException | JsonProcessingException exception) {
            LOG.warn("Resting-order callback failed eventId={} orderId={} attempt={} message={}",
                    delivery.eventId(), order.orderId(), attempt, exception.getMessage(), exception);
        }
        store.recordFailure(delivery);
    }

    private RestingOrderEvent event(CallbackDelivery delivery, RestingOrder order) {
        RestingOrderCommand command = order.command();
        PricingCommand pricing = command.pricing();
        Identity identity = command.context().identity();
        int attempt = delivery.attempts() + 1;
        if (order.status() == RestingOrderStatus.TRIGGERED) {
            Trade trade = order.trade();
            Price price = trade.price();
            Settlement settlement = trade.settlement();
            return new RestingOrderTriggeredEvent()
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
        return new RestingOrderExpiredEvent()
                .eventId(delivery.eventId()).eventType("EXPIRED").occurredAt(delivery.occurredAt()).attempt(attempt)
                .orderId(order.orderId()).originalRequestId(command.context().requestId())
                .channel(identity.channel()).segment(identity.segment()).customerId(identity.customerId())
                .currencyPair(pricing.currencyPair()).quantity(pricing.quantity())
                .quantityCurrency(pricing.quantityCurrency()).tenor(pricing.tenor()).side(pricing.side())
                .limitPrice(command.limitPrice()).status(order.status())
                .expiresAt(command.expiresAt()).lastEvaluatedPrice(order.lastEvaluatedPrice());
    }
}
