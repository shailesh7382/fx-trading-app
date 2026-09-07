package com.example.fx.simulator;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import com.example.fx.simulator.api.model.LimitOrder;
import com.example.fx.simulator.api.model.LimitOrderEvent;
import com.example.fx.simulator.api.model.LimitOrderExpiredEvent;
import com.example.fx.simulator.api.model.LimitOrderTriggeredEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.servlet.function.RouterFunction;
import org.springframework.web.servlet.function.RouterFunctions;
import org.springframework.web.servlet.function.ServerRequest;
import org.springframework.web.servlet.function.ServerResponse;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Exercises the callback over a real socket: the receiver refuses the first attempts, so the test covers
 * retry, dedupe identity across attempts, and the terminal delivery state recorded on the order.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "simulator.limit-orders.evaluation-interval=50ms",
        "simulator.limit-orders.dispatch-interval=50ms",
        "simulator.limit-orders.callback.initial-backoff=50ms",
        "simulator.limit-orders.callback.max-attempts=4",
        "simulator.limit-orders.callback.allowed-prefixes[0]=http://localhost:"
})
class LimitOrderCallbackIntegrationTest {
    private static final Duration DEADLINE = Duration.ofSeconds(20);

    @LocalServerPort int port;
    @Autowired ObjectMapper mapper;
    @Autowired CallbackReceiver receiver;

    private RestClient simulator;

    @BeforeEach
    void connect() {
        receiver.reset();
        simulator = RestClient.create("http://localhost:" + port);
    }

    ObjectNode order(String side, String limitPrice) {
        return mapper.createObjectNode().put("requestId", UUID.randomUUID().toString())
                .put("channel", "WEB").put("segment", "C").put("customerId", "0000123456")
                .put("currencyPair", "EURUSD").put("quantity", 1000000).put("quantityCurrency", "EUR")
                .put("tenor", "ONE_MONTH").put("side", side).put("limitPrice", new BigDecimal(limitPrice))
                .put("timeInForce", "GOOD_TILL_CANCELLED")
                .put("callbackUrl", "http://localhost:" + port + "/test/callbacks");
    }

    LimitOrder place(ObjectNode body) {
        return simulator.post().uri("/api/v1/limit-orders")
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON).body(body)
                .retrieve().body(LimitOrder.class);
    }

    LimitOrder fetch(UUID orderId) {
        return simulator.get().uri("/api/v1/limit-orders/{id}", orderId)
                .header("X-Request-Id", "poll").header("X-Channel", "WEB")
                .header("X-Segment", "C").header("X-Customer-Id", "0000123456")
                .retrieve().body(LimitOrder.class);
    }

    /** Polls rather than sleeps a fixed time, so a slow machine lengthens the wait instead of failing. */
    LimitOrder awaitDelivery(UUID orderId) throws Exception {
        Instant deadline = Instant.now().plus(DEADLINE);
        LimitOrder order = fetch(orderId);
        while (Instant.now().isBefore(deadline) && order.getCallbackAttempts() == 0
                || order.getCallbackStatus() == com.example.fx.simulator.api.model.CallbackStatus.PENDING) {
            if (!Instant.now().isBefore(deadline)) break;
            Thread.sleep(25);
            order = fetch(orderId);
        }
        return order;
    }

    List<LimitOrderEvent> received() {
        return receiver.bodies().stream().map(body -> {
            try {
                return mapper.readValue(body, LimitOrderEvent.class);
            } catch (Exception exception) {
                throw new AssertionError("Callback body did not match the published contract: " + body, exception);
            }
        }).toList();
    }

    @Test
    void retriesUntilTheReceiverAcceptsTheTriggeredEvent() throws Exception {
        receiver.refuseNext(2);
        LimitOrder placed = place(order("BUY", "99.00000"));

        LimitOrder delivered = awaitDelivery(placed.getOrderId());
        assertThat(delivered.getStatus()).isEqualTo(com.example.fx.simulator.api.model.LimitOrderStatus.TRIGGERED);
        assertThat(delivered.getCallbackStatus()).isEqualTo(com.example.fx.simulator.api.model.CallbackStatus.DELIVERED);
        assertThat(delivered.getCallbackAttempts()).isEqualTo(3);

        List<LimitOrderEvent> events = received();
        assertThat(events).hasSize(3).allSatisfy(event ->
                assertThat(event).isInstanceOf(LimitOrderTriggeredEvent.class));
        List<LimitOrderTriggeredEvent> triggered = events.stream().map(LimitOrderTriggeredEvent.class::cast).toList();
        assertThat(triggered).extracting(LimitOrderTriggeredEvent::getEventId).containsOnly(triggered.get(0).getEventId());
        assertThat(triggered).extracting(LimitOrderTriggeredEvent::getAttempt).containsExactly(1, 2, 3);
        assertThat(triggered).extracting(LimitOrderTriggeredEvent::getOccurredAt)
                .containsOnly(triggered.get(0).getOccurredAt());

        LimitOrderTriggeredEvent event = triggered.get(0);
        assertThat(event.getOrderId()).isEqualTo(placed.getOrderId());
        assertThat(event.getTradeId()).isEqualTo(delivered.getTradeId());
        assertThat(event.getClientPrice()).isEqualByComparingTo(delivered.getExecutedPrice());
        assertThat(event.getClientPrice()).isLessThanOrEqualTo(event.getLimitPrice());
        assertThat(event.getBuyCurrency()).isEqualTo("EUR");
        assertThat(event.getBuyQuantity()).isEqualByComparingTo("1000000");
        assertThat(event.getCustomerId()).isEqualTo("0000123456");
        assertThat(event.getOriginalRequestId()).isEqualTo(placed.getOriginalRequestId());

        var trade = simulator.get().uri("/api/v1/bookings/{id}", event.getTradeId())
                .header("X-Request-Id", "from-event").header("X-Channel", "WEB")
                .header("X-Segment", "C").header("X-Customer-Id", "0000123456")
                .retrieve().body(com.example.fx.simulator.api.model.BookedTrade.class);
        assertThat(trade.getClientPrice()).isEqualByComparingTo(event.getClientPrice());
        assertThat(trade.getSellQuantity()).isEqualByComparingTo(event.getSellQuantity());
    }

    @Test
    void deliversAnExpiryEventForAnOrderThatNeverBecomesReachable() throws Exception {
        ObjectNode unreachable = order("BUY", "0.50000")
                .put("timeInForce", "GOOD_TILL_TIME")
                .put("expiresAt", OffsetDateTime.now(ZoneOffset.UTC).plusSeconds(1).toString());
        LimitOrder placed = place(unreachable);

        LimitOrder expired = awaitDelivery(placed.getOrderId());
        assertThat(expired.getStatus()).isEqualTo(com.example.fx.simulator.api.model.LimitOrderStatus.EXPIRED);
        assertThat(expired.getCallbackStatus()).isEqualTo(com.example.fx.simulator.api.model.CallbackStatus.DELIVERED);
        assertThat(expired.getTradeId()).isNull();

        assertThat(received()).singleElement().isInstanceOfSatisfying(LimitOrderExpiredEvent.class, event -> {
            assertThat(event.getOrderId()).isEqualTo(placed.getOrderId());
            assertThat(event.getStatus()).isEqualTo(com.example.fx.simulator.api.model.LimitOrderStatus.EXPIRED);
            assertThat(event.getExpiresAt()).isEqualTo(placed.getExpiresAt());
            assertThat(event.getAttempt()).isEqualTo(1);
        });
    }

    @TestConfiguration
    static class ReceiverConfiguration {
        @Bean
        CallbackReceiver callbackReceiver() {
            return new CallbackReceiver();
        }

        // Functional routing keeps the stub out of the component scan that every other test context runs.
        @Bean
        RouterFunction<ServerResponse> callbackRoute(CallbackReceiver receiver) {
            return RouterFunctions.route().POST("/test/callbacks", receiver::receive).build();
        }
    }

    static class CallbackReceiver {
        private final List<String> bodies = Collections.synchronizedList(new ArrayList<>());
        private final AtomicInteger refusals = new AtomicInteger();

        ServerResponse receive(ServerRequest request) throws Exception {
            bodies.add(request.body(String.class));
            return refusals.getAndUpdate(remaining -> Math.max(remaining - 1, 0)) > 0
                    ? ServerResponse.status(503).build()
                    : ServerResponse.noContent().build();
        }

        void refuseNext(int attempts) {
            refusals.set(attempts);
        }

        void reset() {
            bodies.clear();
            refusals.set(0);
        }

        List<String> bodies() {
            return List.copyOf(bodies);
        }
    }
}
