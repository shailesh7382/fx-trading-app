package com.example.fx.simulator.service;

import java.math.BigDecimal;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;

import com.example.fx.simulator.api.model.CallbackStatus;
import com.example.fx.simulator.api.model.LimitOrderStatus;
import com.example.fx.simulator.api.model.Side;
import com.example.fx.simulator.api.model.Tenor;
import com.example.fx.simulator.api.model.TimeInForce;
import com.example.fx.simulator.config.LimitOrderProperties;
import com.example.fx.simulator.config.SettlementProperties;
import com.example.fx.simulator.config.SimulatorStateProperties;
import com.example.fx.simulator.domain.TradingModels.DueCallback;
import com.example.fx.simulator.domain.TradingModels.LimitOrder;
import com.example.fx.simulator.domain.TradingModels.LimitOrderCommand;
import com.example.fx.simulator.domain.TradingModels.PricingCommand;
import com.example.fx.simulator.domain.TradingModels.RequestContext;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Drives the resting order lifecycle against a clock the test controls, covering the transitions the
 * HTTP tests cannot reach deterministically: which side triggers, expiry, and callback retry exhaustion.
 */
class LimitOrderLifecycleTest {

    private static final Duration BACKOFF = Duration.ofSeconds(1);
    private static final int MAX_ATTEMPTS = 3;
    private static final URI CALLBACK = URI.create("http://localhost:8080/api/limit-orders/events");

    private final MutableClock clock = new MutableClock(Instant.parse("2026-09-08T08:00:00Z"));
    private final SettlementCalculator settlement = new SettlementCalculator();
    private final LimitOrderProperties properties = new LimitOrderProperties(4, Duration.ofHours(24),
            new LimitOrderProperties.Callback(List.of("http://localhost:"), MAX_ATTEMPTS, BACKOFF, Duration.ofSeconds(5)));
    private final LimitOrderStore store = new LimitOrderStore(clock, properties);
    private final FxPricingEngine pricing = new FxPricingEngine(clock, new Random(42), new FxSwapCurve(),
            new SettlementDateCalculator(new SettlementProperties(Map.of(), Map.of())), settlement, Duration.ofSeconds(30));
    private final SimulatorStateStore trades = new SimulatorStateStore(clock, new SimulatorStateProperties(
            10, 10, 10, Duration.ofMinutes(5), Duration.ofHours(24), Duration.ofHours(24)));
    private final LimitOrderMonitor monitor = new LimitOrderMonitor(store, trades, pricing, settlement, clock);
    private final LimitOrderService service = new LimitOrderService(store, pricing, properties);

    private LimitOrderCommand command(Side side, String limitPrice) {
        return command(side, limitPrice, TimeInForce.GOOD_TILL_CANCELLED, null);
    }

    private LimitOrderCommand command(Side side, String limitPrice, TimeInForce timeInForce, OffsetDateTime expiresAt) {
        RequestContext context = new RequestContext("order-" + UUID.randomUUID(), "WEB", "C", "0000123456");
        PricingCommand quantity = new PricingCommand(context, "EURUSD", new BigDecimal("1000000"), "EUR", Tenor.SPOT, side);
        return new LimitOrderCommand(quantity, new BigDecimal(limitPrice), timeInForce, expiresAt, CALLBACK);
    }

    private LimitOrder place(LimitOrderCommand command) {
        return service.place(UUID.randomUUID().toString(), command).order();
    }

    private LimitOrder reload(LimitOrder order) {
        return store.get(order.orderId(), order.command().context().identity());
    }

    @Test
    void triggersOnlyOnceTheMarketReachesTheLimitFromTheOrdersOwnSide() {
        // EURUSD prices around 1.10000, so each pair of limits sits either side of the market.
        LimitOrder buyThrough = place(command(Side.BUY, "1.20000"));
        LimitOrder buyAway = place(command(Side.BUY, "1.00000"));
        LimitOrder sellThrough = place(command(Side.SELL, "1.00000"));
        LimitOrder sellAway = place(command(Side.SELL, "1.20000"));

        monitor.evaluateWorkingOrders();

        assertThat(reload(buyThrough).status()).isEqualTo(LimitOrderStatus.TRIGGERED);
        assertThat(reload(sellThrough).status()).isEqualTo(LimitOrderStatus.TRIGGERED);
        assertThat(reload(buyAway).status()).isEqualTo(LimitOrderStatus.WORKING);
        assertThat(reload(sellAway).status()).isEqualTo(LimitOrderStatus.WORKING);

        LimitOrder triggered = reload(buyThrough);
        assertThat(triggered.trade().price().clientPrice()).isLessThanOrEqualTo(new BigDecimal("1.20000"));
        assertThat(triggered.lastEvaluatedPrice()).isEqualByComparingTo(triggered.trade().price().clientPrice());
        assertThat(triggered.callbackStatus()).isEqualTo(CallbackStatus.PENDING);
        // The trade the event will name has to be retrievable through the ordinary booking lookup.
        assertThat(trades.getTrade(triggered.trade().tradeId(), triggered.command().context().identity()))
                .isEqualTo(triggered.trade());
        assertThat(reload(buyAway).lastEvaluatedPrice()).isNotNull();
    }

    @Test
    void keepsACancellationWhenEvaluationRunsAfterwards() {
        LimitOrder order = place(command(Side.BUY, "1.20000"));
        store.cancel(order.orderId(), order.command().context().identity());

        monitor.evaluateWorkingOrders();

        LimitOrder cancelled = reload(order);
        assertThat(cancelled.status()).isEqualTo(LimitOrderStatus.CANCELLED);
        assertThat(cancelled.trade()).isNull();
        assertThat(cancelled.callbackStatus()).isEqualTo(CallbackStatus.NOT_REQUIRED);
        assertThat(store.dueDeliveries()).isEmpty();
    }

    @Test
    void expiresGoodTillTimeOrdersAndQueuesTheirEvent() {
        OffsetDateTime expiresAt = OffsetDateTime.now(clock).plusMinutes(5);
        LimitOrder order = place(command(Side.BUY, "1.00000", TimeInForce.GOOD_TILL_TIME, expiresAt));

        monitor.evaluateWorkingOrders();
        assertThat(reload(order).status()).isEqualTo(LimitOrderStatus.WORKING);

        clock.advance(Duration.ofMinutes(5));
        monitor.evaluateWorkingOrders();

        LimitOrder expired = reload(order);
        assertThat(expired.status()).isEqualTo(LimitOrderStatus.EXPIRED);
        assertThat(expired.closedAt()).isEqualTo(expiresAt);
        assertThat(expired.trade()).isNull();
        assertThat(store.dueDeliveries()).singleElement()
                .satisfies(due -> assertThat(due.order().orderId()).isEqualTo(order.orderId()));
    }

    @Test
    void holdsRetriesForTheBackoffAndGivesUpAtTheAttemptLimit() {
        LimitOrder order = place(command(Side.BUY, "1.20000"));
        monitor.evaluateWorkingOrders();

        DueCallback first = store.dueDeliveries().get(0);
        UUID eventId = first.delivery().eventId();
        store.recordFailure(first.delivery());
        assertThat(store.dueDeliveries()).as("held until the backoff elapses").isEmpty();
        assertThat(reload(order).callbackStatus()).isEqualTo(CallbackStatus.PENDING);

        clock.advance(BACKOFF);
        DueCallback second = store.dueDeliveries().get(0);
        assertThat(second.delivery().eventId()).as("retries reuse the event identity").isEqualTo(eventId);
        assertThat(second.delivery().attempts()).isEqualTo(1);
        store.recordFailure(second.delivery());

        clock.advance(BACKOFF);
        assertThat(store.dueDeliveries()).as("the backoff doubles after the second attempt").isEmpty();
        clock.advance(BACKOFF);
        DueCallback third = store.dueDeliveries().get(0);
        store.recordFailure(third.delivery());

        LimitOrder failed = reload(order);
        assertThat(failed.callbackStatus()).isEqualTo(CallbackStatus.FAILED);
        assertThat(failed.callbackAttempts()).isEqualTo(MAX_ATTEMPTS);
        assertThat(failed.status()).as("a failed notification does not undo the fill").isEqualTo(LimitOrderStatus.TRIGGERED);
        clock.advance(Duration.ofHours(1));
        assertThat(store.dueDeliveries()).isEmpty();
    }

    @Test
    void scopesIdempotencyToTheOrdersTermsRatherThanItsRequestId() {
        String key = UUID.randomUUID().toString();
        LimitOrder placed = service.place(key, command(Side.BUY, "1.00000")).order();

        var replay = service.place(key, command(Side.BUY, "1.000000"));
        assertThat(replay.created()).isFalse();
        assertThat(replay.order().orderId()).isEqualTo(placed.orderId());

        assertThatThrownBy(() -> service.place(key, command(Side.BUY, "1.01000")))
                .isInstanceOf(SimulatorApiException.class)
                .extracting("errorCode").isEqualTo("IDEMPOTENCY_CONFLICT");
        assertThatThrownBy(() -> service.place(key, command(Side.SELL, "1.00000")))
                .isInstanceOf(SimulatorApiException.class)
                .extracting("errorCode").isEqualTo("IDEMPOTENCY_CONFLICT");
    }

    @Test
    void refusesOrdersItCouldNeitherPriceNorNotify() {
        RequestContext context = new RequestContext("unsupported", "WEB", "C", "0000123456");
        PricingCommand unsupported = new PricingCommand(context, "AAAQQQ", new BigDecimal("1000000"), "AAA", Tenor.SPOT, Side.BUY);
        assertThatThrownBy(() -> service.place(UUID.randomUUID().toString(), new LimitOrderCommand(
                unsupported, new BigDecimal("1.10000"), TimeInForce.GOOD_TILL_CANCELLED, null, CALLBACK)))
                .isInstanceOf(SimulatorApiException.class)
                .extracting("errorCode").isEqualTo("UNSUPPORTED_INSTRUMENT");

        LimitOrderCommand elsewhere = new LimitOrderCommand(command(Side.BUY, "1.10000").pricing(),
                new BigDecimal("1.10000"), TimeInForce.GOOD_TILL_CANCELLED, null,
                URI.create("http://evil.example.com/events"));
        assertThatThrownBy(() -> service.place(UUID.randomUUID().toString(), elsewhere))
                .isInstanceOf(SimulatorApiException.class)
                .extracting("errorCode").isEqualTo("CALLBACK_URL_NOT_ALLOWED");

        assertThatThrownBy(() -> service.place(UUID.randomUUID().toString(), command(Side.BUY, "1.10000",
                TimeInForce.GOOD_TILL_TIME, OffsetDateTime.now(clock).minusMinutes(1))))
                .isInstanceOf(SimulatorApiException.class)
                .extracting("errorCode").isEqualTo("INVALID_LIMIT_ORDER");
    }

    @Test
    void refusesToRestMoreOrdersThanItCanRetain() {
        for (int i = 0; i < 4; i++) {
            place(command(Side.BUY, "1.00000"));
        }
        assertThatThrownBy(() -> place(command(Side.BUY, "1.00000")))
                .isInstanceOf(SimulatorApiException.class)
                .extracting("errorCode").isEqualTo("CAPACITY_EXCEEDED");
    }
}
