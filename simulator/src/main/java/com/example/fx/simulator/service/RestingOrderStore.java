package com.example.fx.simulator.service;

import java.math.BigDecimal;
import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import com.example.fx.tradingsystems.api.model.CallbackStatus;
import com.example.fx.tradingsystems.api.model.RestingOrderStatus;
import com.example.fx.tradingsystems.api.model.Side;
import com.example.fx.tradingsystems.api.model.Tenor;
import com.example.fx.tradingsystems.api.model.TimeInForce;
import com.example.fx.simulator.config.RestingOrderProperties;
import com.example.fx.simulator.domain.TradingModels.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * One monitor covers placement, the terminal transition, and the queuing of that transition's callback,
 * so an order can never close without its notification being queued in the same step.
 */
@Component
public class RestingOrderStore {
    /** A working order is retained until it closes; capacity, not time, is what bounds resting orders. */
    private static final Instant RESTING = Instant.MAX;

    private final Clock clock;
    private final RestingOrderProperties properties;
    private final RetainedMap<RestingOrderKey, RestingOrder> orders;
    private final RetainedMap<RestingOrderKey, PendingDelivery> deliveries;

    public RestingOrderStore(Clock clock, RestingOrderProperties properties) {
        this.clock = clock;
        this.properties = properties;
        orders = new RetainedMap<>(properties.maxOrders());
        deliveries = new RetainedMap<>(properties.maxOrders());
    }

    /**
     * The order's own name is its idempotency key, so the retained order is the idempotency record:
     * identical terms replay it, different terms under the same name are a conflict.
     */
    public synchronized RestingOrderPlacement place(RestingOrderCommand command) {
        purge();
        RestingOrder existing = orders.get(command.key());
        if (existing != null) {
            if (!Fingerprint.of(existing.command()).equals(Fingerprint.of(command))) {
                throw SimulatorApiException.orderIdInUse(command.orderId());
            }
            return new RestingOrderPlacement(existing, false);
        }

        orders.requireCapacity();
        OffsetDateTime now = OffsetDateTime.now(clock);
        if (command.timeInForce() == TimeInForce.GOOD_TILL_TIME && !command.expiresAt().isAfter(now)) {
            throw SimulatorApiException.invalidRestingOrder("expiresAt must be in the future.");
        }
        RestingOrder order = RestingOrder.working(command, now);
        orders.put(order.key(), order, RESTING);
        return new RestingOrderPlacement(order, true);
    }

    public synchronized RestingOrder get(String orderId, Identity identity) {
        purge();
        RestingOrder order = orders.get(new RestingOrderKey(identity.customerId(), orderId));
        if (order == null || !order.command().context().identity().equals(identity)) {
            throw SimulatorApiException.orderNotFound(orderId);
        }
        return order;
    }

    public synchronized RestingOrder cancel(String orderId, Identity identity) {
        RestingOrder order = get(orderId, identity);
        if (!order.working()) {
            throw SimulatorApiException.orderNotWorking(orderId, order.status());
        }
        // A cancellation produces no event: the caller learns the outcome from this response.
        return close(order, RestingOrderStatus.CANCELLED, OffsetDateTime.now(clock), null, CallbackStatus.NOT_REQUIRED);
    }

    public synchronized RestingOrder amend(RestingOrderCommand amended, Identity identity) {
        RestingOrder order = get(amended.orderId(), identity);
        if (!order.working()) {
            throw SimulatorApiException.orderNotWorking(amended.orderId(), order.status());
        }
        OffsetDateTime now = OffsetDateTime.now(clock);
        if (amended.timeInForce() == TimeInForce.GOOD_TILL_TIME && !amended.expiresAt().isAfter(now)) {
            throw SimulatorApiException.invalidRestingOrder("expiresAt must be in the future.");
        }
        RestingOrder replacement = order.amended(amended);
        orders.replace(order.key(), replacement);
        return replacement;
    }

    public synchronized List<RestingOrder> workingOrders() {
        purge();
        return orders.values().stream().filter(RestingOrder::working).toList();
    }

    public synchronized void recordEvaluation(RestingOrderKey key, OffsetDateTime at, BigDecimal clientPrice) {
        RestingOrder order = orders.get(key);
        if (order != null && order.working()) {
            orders.replace(key, order.evaluated(at, clientPrice));
        }
    }

    /**
     * Closes a still-working order and queues its notification. Returns null when the order was already
     * closed, which is how a cancellation that raced an evaluation keeps its outcome.
     */
    public synchronized RestingOrder closeWithEvent(RestingOrderKey key, RestingOrderStatus terminal,
                                                    OffsetDateTime at, Trade trade) {
        RestingOrder order = orders.get(key);
        if (order == null || !order.working()) {
            return null;
        }
        deliveries.requireCapacity();
        RestingOrder closed = close(order, terminal, at, trade, CallbackStatus.PENDING);
        deliveries.put(key, new PendingDelivery(new CallbackDelivery(UUID.randomUUID(), key, at, 0), Instant.MIN),
                at.toInstant().plus(properties.retention()));
        return closed;
    }

    /** Returns each due delivery with the order it describes, so the dispatcher reads one consistent snapshot. */
    public synchronized List<DueCallback> dueDeliveries() {
        purge();
        Instant now = clock.instant();
        List<DueCallback> due = new ArrayList<>();
        for (PendingDelivery pending : deliveries.values()) {
            RestingOrder order = orders.get(pending.delivery().order());
            if (order != null && !now.isBefore(pending.nextAttemptAt())) {
                due.add(new DueCallback(pending.delivery(), order));
            }
        }
        return List.copyOf(due);
    }

    public synchronized void recordDelivered(CallbackDelivery delivery) {
        // The attempt that succeeded counts, so a delivered order reports every attempt it took.
        settle(delivery.attempted(), CallbackStatus.DELIVERED);
    }

    /** Retries stay queued with a doubling backoff; the attempt limit is what turns a failure terminal. */
    public synchronized void recordFailure(CallbackDelivery delivery) {
        CallbackDelivery attempted = delivery.attempted();
        RestingOrder order = orders.get(delivery.order());
        if (attempted.attempts() >= properties.callback().maxAttempts()) {
            settle(attempted, CallbackStatus.FAILED);
            return;
        }
        if (order != null) {
            orders.replace(order.key(), order.withCallback(CallbackStatus.PENDING, attempted.attempts()));
        }
        deliveries.replace(delivery.order(), new PendingDelivery(attempted,
                clock.instant().plus(properties.callback().backoffAfter(attempted.attempts()))));
    }

    @Scheduled(fixedDelayString = "${simulator.resting-orders.cleanup-interval:60s}")
    public synchronized void purge() {
        Instant now = clock.instant();
        orders.purge(now);
        deliveries.purge(now);
    }

    private RestingOrder close(RestingOrder order, RestingOrderStatus terminal, OffsetDateTime at,
                             Trade trade, CallbackStatus callback) {
        RestingOrder closed = order.closed(terminal, at, trade, callback);
        orders.put(closed.key(), closed, at.toInstant().plus(properties.retention()));
        return closed;
    }

    private void settle(CallbackDelivery delivery, CallbackStatus outcome) {
        RestingOrder order = orders.get(delivery.order());
        if (order != null) {
            orders.replace(order.key(), order.withCallback(outcome, delivery.attempts()));
        }
        deliveries.remove(delivery.order());
    }

    private record PendingDelivery(CallbackDelivery delivery, Instant nextAttemptAt) {}

    /** Terms only: a replay carries a new requestId, and quantities must compare by value, not scale. */
    private record Fingerprint(Identity identity, String orderId, String currencyPair, BigDecimal quantity,
                               String quantityCurrency, Tenor tenor, Side side, BigDecimal limitPrice,
                               TimeInForce timeInForce, OffsetDateTime expiresAt, URI callbackUrl) {
        static Fingerprint of(RestingOrderCommand command) {
            PricingCommand pricing = command.pricing();
            return new Fingerprint(pricing.context().identity(), command.orderId(), pricing.currencyPair(),
                    pricing.quantity().stripTrailingZeros(), pricing.quantityCurrency(), pricing.tenor(), pricing.side(),
                    command.limitPrice().stripTrailingZeros(), command.timeInForce(), command.expiresAt(),
                    command.callbackUrl());
        }
    }
}
