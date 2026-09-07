package com.example.fx.simulator;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
import com.example.fx.simulator.service.LimitOrderMonitor;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Evaluation and delivery are parked so the scheduler cannot move an order mid-assertion; the monitor
 * is driven by hand where a test needs a working order to trigger.
 */
@SpringBootTest(properties = {
        "simulator.limit-orders.evaluation-interval=1h",
        "simulator.limit-orders.dispatch-interval=1h"
})
@AutoConfigureMockMvc
class LimitOrderApiIntegrationTest {
    private static final String CALLBACK = "http://localhost:8080/api/limit-orders/events";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired LimitOrderMonitor monitor;

    ObjectNode order(String side, String limitPrice) {
        return mapper.createObjectNode().put("requestId", UUID.randomUUID().toString())
                .put("channel", "WEB").put("segment", "C").put("customerId", "0000123456")
                .put("currencyPair", "EURUSD").put("quantity", 1000000).put("quantityCurrency", "EUR")
                .put("tenor", "ONE_MONTH").put("side", side).put("limitPrice", new BigDecimal(limitPrice))
                .put("timeInForce", "GOOD_TILL_CANCELLED").put("callbackUrl", CALLBACK);
    }

    MockHttpServletRequestBuilder placement(ObjectNode body, String key) throws Exception {
        return post("/api/v1/limit-orders").header("Idempotency-Key", key)
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsBytes(body));
    }

    MockHttpServletRequestBuilder identified(MockHttpServletRequestBuilder request, String requestId, String customerId) {
        return request.header("X-Request-Id", requestId).header("X-Channel", "WEB")
                .header("X-Segment", "C").header("X-Customer-Id", customerId);
    }

    JsonNode checked(MockHttpServletRequestBuilder request, int expected) throws Exception {
        var result = mvc.perform(request).andExpect(status().is(expected)).andReturn();
        ContractAssertions.validResponse(result);
        return mapper.readTree(result.getResponse().getContentAsString());
    }

    JsonNode placeWorking(String side, String limitPrice) throws Exception {
        return checked(placement(order(side, limitPrice), UUID.randomUUID().toString()), 201);
    }

    @Test
    void placesWorkingOrderAndReplaysUnderTheSameKey() throws Exception {
        ObjectNode input = order("BUY", "1.05000");
        String key = UUID.randomUUID().toString();
        JsonNode placed = checked(placement(input, key), 201);
        assertThat(placed.path("status").asText()).isEqualTo("WORKING");
        assertThat(placed.path("callbackStatus").asText()).isEqualTo("NOT_REQUIRED");
        assertThat(placed.path("callbackAttempts").asInt()).isZero();
        assertThat(placed.path("callbackUrl").asText()).isEqualTo(CALLBACK);
        assertThat(placed.path("requestId")).isEqualTo(input.path("requestId"));
        assertThat(placed.path("originalRequestId")).isEqualTo(input.path("requestId"));
        for (String absent : new String[]{"tradeId", "executedPrice", "closedAt", "expiresAt", "lastEvaluatedAt"}) {
            assertThat(placed.has(absent)).as(absent).isFalse();
        }

        ObjectNode replayed = input.deepCopy();
        replayed.put("requestId", "order-retry");
        JsonNode replay = checked(placement(replayed, key), 200);
        assertThat(replay.path("orderId")).isEqualTo(placed.path("orderId"));
        assertThat(replay.path("requestId").asText()).isEqualTo("order-retry");
        assertThat(replay.path("originalRequestId")).isEqualTo(input.path("requestId"));
        assertThat(replay.path("responseId")).isNotEqualTo(placed.path("responseId"));

        JsonNode conflict = checked(placement(replayed.deepCopy().put("limitPrice", 1.04), key), 409);
        assertThat(conflict.path("errorCode").asText()).isEqualTo("IDEMPOTENCY_CONFLICT");

        JsonNode fetched = checked(identified(get("/api/v1/limit-orders/" + placed.path("orderId").asText()),
                "order-lookup", "0000123456"), 200);
        assertThat(fetched.path("requestId").asText()).isEqualTo("order-lookup");
        assertThat(fetched.path("status").asText()).isEqualTo("WORKING");
    }

    @Test
    void rejectsTermsThatCannotRest() throws Exception {
        OffsetDateTime past = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(1);
        OffsetDateTime future = OffsetDateTime.now(ZoneOffset.UTC).plusHours(1);
        for (Consumer<ObjectNode> invalid : List.<Consumer<ObjectNode>>of(
                o -> o.put("expiresAt", future.toString()),
                o -> o.put("timeInForce", "GOOD_TILL_TIME"),
                o -> o.put("timeInForce", "GOOD_TILL_TIME").put("expiresAt", past.toString()),
                o -> o.put("timeInForce", "IMMEDIATE_OR_CANCEL"),
                o -> o.put("limitPrice", 0), o -> o.remove("limitPrice"), o -> o.remove("side"),
                o -> o.put("quantityCurrency", "JPY"), o -> o.put("customerId", "123"),
                o -> o.remove("callbackUrl"), o -> o.put("callbackUrl", "not-a-url"), o -> o.put("typo", true))) {
            ObjectNode body = order("BUY", "1.05000");
            invalid.accept(body);
            checked(placement(body, UUID.randomUUID().toString()), 400);
        }
        checked(post("/api/v1/limit-orders").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(order("BUY", "1.05000"))), 400);

        JsonNode refused = checked(placement(order("BUY", "1.05000")
                .put("callbackUrl", "http://evil.example.com/events"), UUID.randomUUID().toString()), 422);
        assertThat(refused.path("errorCode").asText()).isEqualTo("CALLBACK_URL_NOT_ALLOWED");
        JsonNode unsupported = checked(placement(order("BUY", "1.05000")
                .put("currencyPair", "AAAQQQ").put("quantityCurrency", "AAA"), UUID.randomUUID().toString()), 422);
        assertThat(unsupported.path("errorCode").asText()).isEqualTo("UNSUPPORTED_INSTRUMENT");
    }

    @Test
    void keepsOrdersPrivateToTheirOwnContext() throws Exception {
        JsonNode placed = placeWorking("BUY", "1.05000");
        String path = "/api/v1/limit-orders/" + placed.path("orderId").asText();
        checked(get(path), 400);
        checked(identified(get(path), "wrong-customer", "0000654321"), 404);
        checked(identified(delete(path), "wrong-customer", "0000654321"), 404);
        checked(identified(get("/api/v1/limit-orders/" + UUID.randomUUID()), "missing", "0000123456"), 404);
        checked(identified(get(path), "right-customer", "0000123456"), 200);
    }

    @Test
    void triggersThroughTheMarketAndBooksARetrievableTrade() throws Exception {
        JsonNode placed = placeWorking("BUY", "99.00000");
        monitor.evaluateWorkingOrders();

        JsonNode triggered = checked(identified(get("/api/v1/limit-orders/" + placed.path("orderId").asText()),
                "after-trigger", "0000123456"), 200);
        assertThat(triggered.path("status").asText()).isEqualTo("TRIGGERED");
        assertThat(triggered.path("callbackStatus").asText()).isEqualTo("PENDING");
        assertThat(triggered.path("closedAt").asText()).isNotBlank();
        assertThat(triggered.path("executedPrice").decimalValue()).isLessThan(new BigDecimal("99.00000"));
        assertThat(triggered.path("executedPrice")).isEqualTo(triggered.path("lastEvaluatedPrice"));

        JsonNode trade = checked(identified(get("/api/v1/bookings/" + triggered.path("tradeId").asText()),
                "trade-lookup", "0000123456"), 200);
        assertThat(trade.path("clientPrice")).isEqualTo(triggered.path("executedPrice"));
        assertThat(trade.path("side").asText()).isEqualTo("BUY");
        assertThat(trade.path("buyCurrency").asText()).isEqualTo("EUR");
        assertThat(trade.path("buyQuantity").decimalValue()).isEqualByComparingTo("1000000");
    }

    @Test
    void cancelsOnlyWhileWorkingAndStopsEvaluation() throws Exception {
        JsonNode placed = placeWorking("BUY", "99.00000");
        String path = "/api/v1/limit-orders/" + placed.path("orderId").asText();

        JsonNode cancelled = checked(identified(delete(path), "cancel", "0000123456"), 200);
        assertThat(cancelled.path("status").asText()).isEqualTo("CANCELLED");
        assertThat(cancelled.path("callbackStatus").asText()).isEqualTo("NOT_REQUIRED");
        assertThat(cancelled.path("closedAt").asText()).isNotBlank();
        assertThat(cancelled.has("tradeId")).isFalse();

        JsonNode conflict = checked(identified(delete(path), "cancel-again", "0000123456"), 409);
        assertThat(conflict.path("errorCode").asText()).isEqualTo("ORDER_NOT_WORKING");

        monitor.evaluateWorkingOrders();
        assertThat(checked(identified(get(path), "after-evaluation", "0000123456"), 200).path("status").asText())
                .isEqualTo("CANCELLED");
    }
}
