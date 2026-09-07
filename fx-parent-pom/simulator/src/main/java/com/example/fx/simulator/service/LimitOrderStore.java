package com.example.fx.simulator.service;

import java.math.BigDecimal;
import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import com.example.fx.simulator.api.model.CallbackStatus;
import com.example.fx.simulator.api.model.LimitOrderStatus;
import com.example.fx.simulator.api.model.Side;
import com.example.fx.simulator.api.model.Tenor;
import com.example.fx.simulator.api.model.TimeInForce;
import com.example.fx.simulator.config.LimitOrderProperties;
import com.example.fx.simulator.domain.TradingModels.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * One monitor covers placement, the terminal transition, and the queuing of that transition's callback,
 * so an order can never close without its notification being queued in the same step.
 */
@Component
public class LimitOrderStore {
    /** A working order is retained until it closes; capacity, not time, is what bounds resting orders. */
    private static final Instant RESTING = Instant.MAX;

    private final Clock clock;
    private final LimitOrderProperties properties;
    private final RetainedMap<UUID, LimitOrder> orders;
    private final RetainedMap<IdempotencyScope, StoredPlacement> placements;
    private final RetainedMap<UUID, PendingDelivery> deliveries;

    public LimitOrderStore(Clock clock, LimitOrderProperties properties) {
        this.clock = clock;
        this.properties = properties;
        orders = new RetainedMap<>(properties.maxOrders());
        placements = new RetainedMap<>(properties.maxOrders());
        deliveries = new RetainedMap<>(properties.maxOrders());
    }

    public synchronized LimitOrderPlacement place(String idempotencyKey, LimitOrderCommand command) {
        purge();
        Identity identity = command.context().identity();
        IdempotencyScope scope = new IdempotencyScope(identity.customerId(), idempotencyKey);
        Fingerprint fingerprint = Fingerprint.of(command);
        StoredPlacement existing = placements.get(scope);
        if (existing != null) {
            if (!existing.fingerprint().equals(fingerprint)) {
                throw SimulatorApiException.idempotencyConflict(idempotencyKey);
            }
            return new LimitOrderPlacement(orders.get(existing.orderId()), false);
        }

        // Never publish an order the replay of which could not be answered from the same state.
        orders.requireCapacity();
        placements.requireCapacity();
        OffsetDateTime now = OffsetDateTime.now(clock);
        if (command.timeInForce() == TimeInForce.GOOD_TILL_TIME && !command.expiresAt().isAfter(now)) {
            throw SimulatorApiException.invalidLimitOrder("expiresAt must be in the future.");
        }
        LimitOrder order = LimitOrder.working(UUID.randomUUID(), command, now);
        orders.put(order.orderId(), order, RESTING);
        placements.put(scope, new StoredPlacement(fingerprint, order.orderId()),
                now.toInstant().plus(properties.retention()));
        return new LimitOrderPlacement(order, true);
    }

    public synchronized LimitOrder get(UUID orderId, Identity identity) {
        purge();
        LimitOrder order = orders.get(orderId);
        if (order == null || !order.command().context().identity().equals(identity)) {
            throw SimulatorApiException.orderNotFound(orderId);
        }
        return order;
    }

    public synchronized LimitOrder cancel(UUID orderId, Identity identity) {
        LimitOrder order = get(orderId, identity);
        if (!order.working()) {
            throw SimulatorApiException.orderNotWorking(orderId, order.status());
        }
        // A cancellation produces no event: the caller learns the outcome from this response.
        return close(order, LimitOrderStatus.CANCELLED, OffsetDateTime.now(clock), null, CallbackStatus.NOT_REQUIRED);
    }

    public synchronized List<LimitOrder> workingOrders() {
        purge();
        return orders.values().stream().filter(LimitOrder::working).toList();
    }

    public synchronized void recordEvaluation(UUID orderId, OffsetDateTime at, BigDecimal clientPrice) {
        LimitOrder order = orders.get(orderId);
        if (order != null && order.working()) {
            orders.replace(orderId, order.evaluated(at, clientPrice));
        }
    }

    /**
     * Closes a still-working order and queues its notification. Returns null when the order was already
     * closed, which is how a cancellation that raced an evaluation keeps its outcome.
     */
    public synchronized LimitOrder closeWithEvent(UUID orderId, LimitOrderStatus terminal, OffsetDateTime at, Trade trade) {
        LimitOrder order = orders.get(orderId);
        if (order == null || !order.working()) {
            return null;
        }
        deliveries.requireCapacity();
        LimitOrder closed = close(order, terminal, at, trade, CallbackStatus.PENDING);
        deliveries.put(orderId, new PendingDelivery(new CallbackDelivery(UUID.randomUUID(), orderId, at, 0), Instant.MIN),
                at.toInstant().plus(properties.retention()));
        return closed;
    }

    /** Returns each due delivery with the order it describes, so the dispatcher reads one consistent snapshot. */
    public synchronized List<DueCallback> dueDeliveries() {
        purge();
        Instant now = clock.instant();
        List<DueCallback> due = new ArrayList<>();
        for (PendingDelivery pending : deliveries.values()) {
            LimitOrder order = orders.get(pending.delivery().orderId());
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
        LimitOrder order = orders.get(delivery.orderId());
        if (attempted.attempts() >= properties.callback().maxAttempts()) {
            settle(attempted, CallbackStatus.FAILED);
            return;
        }
        if (order != null) {
            orders.replace(order.orderId(), order.withCallback(CallbackStatus.PENDING, attempted.attempts()));
        }
        deliveries.replace(delivery.orderId(), new PendingDelivery(attempted,
                clock.instant().plus(properties.callback().backoffAfter(attempted.attempts()))));
    }

    @Scheduled(fixedDelayString = "${simulator.limit-orders.cleanup-interval:60s}")
    public synchronized void purge() {
        Instant now = clock.instant();
        orders.purge(now);
        placements.purge(now);
        deliveries.purge(now);
    }

    private LimitOrder close(LimitOrder order, LimitOrderStatus terminal, OffsetDateTime at,
                             Trade trade, CallbackStatus callback) {
        LimitOrder closed = order.closed(terminal, at, trade, callback);
        orders.put(closed.orderId(), closed, at.toInstant().plus(properties.retention()));
        return closed;
    }

    private void settle(CallbackDelivery delivery, CallbackStatus outcome) {
        LimitOrder order = orders.get(delivery.orderId());
        if (order != null) {
            orders.replace(order.orderId(), order.withCallback(outcome, delivery.attempts()));
        }
        deliveries.remove(delivery.orderId());
    }

    private record IdempotencyScope(String customerId, String key) {}
    private record PendingDelivery(CallbackDelivery delivery, Instant nextAttemptAt) {}
    private record StoredPlacement(Fingerprint fingerprint, UUID orderId) {}

    /** Terms only: a replay carries a new requestId, and quantities must compare by value, not scale. */
    private record Fingerprint(Identity identity, String currencyPair, BigDecimal quantity, String quantityCurrency,
                               Tenor tenor, Side side, BigDecimal limitPrice, TimeInForce timeInForce,
                               OffsetDateTime expiresAt, URI callbackUrl) {
        static Fingerprint of(LimitOrderCommand command) {
            PricingCommand pricing = command.pricing();
            return new Fingerprint(pricing.context().identity(), pricing.currencyPair(),
                    pricing.quantity().stripTrailingZeros(), pricing.quantityCurrency(), pricing.tenor(), pricing.side(),
                    command.limitPrice().stripTrailingZeros(), command.timeInForce(), command.expiresAt(),
                    command.callbackUrl());
        }
    }
}
