package com.example.fx.simulator;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
import com.example.fx.simulator.service.RestingOrderMonitor;
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
        "simulator.resting-orders.evaluation-interval=1h",
        "simulator.resting-orders.dispatch-interval=1h"
})
@AutoConfigureMockMvc
class RestingOrderApiIntegrationTest {
    private static final String CALLBACK = "http://localhost:8080/api/resting-orders/events";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired RestingOrderMonitor monitor;

    ObjectNode order(String side, String limitPrice) {
        return mapper.createObjectNode().put("requestId", UUID.randomUUID().toString())
                .put("orderId", "ORD-" + UUID.randomUUID())
                .put("channel", "WEB").put("segment", "C").put("customerId", "0000123456")
                .put("currencyPair", "EURUSD").put("quantity", 1000000).put("quantityCurrency", "EUR")
                .put("tenor", "ONE_MONTH").put("side", side).put("limitPrice", new BigDecimal(limitPrice))
                .put("timeInForce", "GOOD_TILL_CANCELLED").put("callbackUrl", CALLBACK);
    }

    MockHttpServletRequestBuilder placement(ObjectNode body) throws Exception {
        return post("/api/v1/resting-orders")
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
        return checked(placement(order(side, limitPrice)), 201);
    }

    @Test
    void placesWorkingOrderAndReplaysUnderTheSameOrderId() throws Exception {
        ObjectNode input = order("BUY", "1.05000");
        JsonNode placed = checked(placement(input), 201);
        assertThat(placed.path("status").asText()).isEqualTo("WORKING");
        assertThat(placed.path("callbackStatus").asText()).isEqualTo("NOT_REQUIRED");
        assertThat(placed.path("callbackAttempts").asInt()).isZero();
        assertThat(placed.path("callbackUrl").asText()).isEqualTo(CALLBACK);
        assertThat(placed.path("orderId")).isEqualTo(input.path("orderId"));
        assertThat(placed.path("requestId")).isEqualTo(input.path("requestId"));
        assertThat(placed.path("originalRequestId")).isEqualTo(input.path("requestId"));
        for (String absent : new String[]{"closedAt", "expiresAt", "lastEvaluatedAt", "lastEvaluatedPrice"}) {
            assertThat(placed.has(absent)).as(absent).isFalse();
        }

        // A retry carries the same orderId and terms, and only its requestId differs.
        ObjectNode replayed = input.deepCopy();
        replayed.put("requestId", "order-retry");
        JsonNode replay = checked(placement(replayed), 200);
        assertThat(replay.path("orderId")).isEqualTo(placed.path("orderId"));
        assertThat(replay.path("requestId").asText()).isEqualTo("order-retry");
        assertThat(replay.path("originalRequestId")).isEqualTo(input.path("requestId"));
        assertThat(replay.path("responseId")).isNotEqualTo(placed.path("responseId"));

        JsonNode conflict = checked(placement(replayed.deepCopy().put("limitPrice", 1.04)), 409);
        assertThat(conflict.path("errorCode").asText()).isEqualTo("ORDER_ID_IN_USE");

        JsonNode fetched = checked(identified(get("/api/v1/resting-orders/" + placed.path("orderId").asText()),
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
                o -> o.remove("callbackUrl"), o -> o.put("callbackUrl", "not-a-url"), o -> o.put("typo", true),
                o -> o.remove("orderId"), o -> o.put("orderId", "has a space"), o -> o.put("orderId", ""))) {
            ObjectNode body = order("BUY", "1.05000");
            invalid.accept(body);
            checked(placement(body), 400);
        }

        JsonNode refused = checked(placement(order("BUY", "1.05000")
                .put("callbackUrl", "http://evil.example.com/events")), 422);
        assertThat(refused.path("errorCode").asText()).isEqualTo("CALLBACK_URL_NOT_ALLOWED");
        JsonNode unsupported = checked(placement(order("BUY", "1.05000")
                .put("currencyPair", "AAAQQQ").put("quantityCurrency", "AAA")), 422);
        assertThat(unsupported.path("errorCode").asText()).isEqualTo("UNSUPPORTED_INSTRUMENT");
    }

    @Test
    void refusesAnOrderIdTheCustomerIsAlreadyUsing() throws Exception {
        ObjectNode first = order("BUY", "1.05000");
        checked(placement(first), 201);

        ObjectNode reused = order("SELL", "1.20000").put("orderId", first.path("orderId").asText());
        JsonNode conflict = checked(placement(reused), 409);
        assertThat(conflict.path("errorCode").asText()).isEqualTo("ORDER_ID_IN_USE");

        // The name belongs to one customer, so another customer may use the same one.
        ObjectNode elsewhere = order("BUY", "1.05000")
                .put("orderId", first.path("orderId").asText())
                .put("customerId", "0000654321");
        checked(placement(elsewhere), 201);
    }

    @Test
    void keepsOrdersPrivateToTheirOwnContext() throws Exception {
        JsonNode placed = placeWorking("BUY", "1.05000");
        String path = "/api/v1/resting-orders/" + placed.path("orderId").asText();
        checked(get(path), 400);
        checked(identified(get(path), "wrong-customer", "0000654321"), 404);
        checked(identified(delete(path), "wrong-customer", "0000654321"), 404);
        checked(identified(get("/api/v1/resting-orders/" + UUID.randomUUID()), "missing", "0000123456"), 404);
        checked(identified(get(path), "right-customer", "0000123456"), 200);
    }

    @Test
    void triggersThroughTheMarketAndExposesTheBookedTradeForReconciliation() throws Exception {
        JsonNode placed = placeWorking("BUY", "99.00000");
        monitor.evaluateWorkingOrders();

        JsonNode triggered = checked(identified(get("/api/v1/resting-orders/" + placed.path("orderId").asText()),
                "after-trigger", "0000123456"), 200);
        assertThat(triggered.path("status").asText()).isEqualTo("TRIGGERED");
        assertThat(triggered.path("callbackStatus").asText()).isEqualTo("PENDING");
        assertThat(triggered.path("closedAt").asText()).isNotBlank();
        assertThat(triggered.path("lastEvaluatedPrice").decimalValue()).isLessThan(new BigDecimal("99.00000"));
        assertThat(triggered.path("tradeId").asText()).isNotBlank();
        // Price and settlement detail stays on the trade and callback event.
        for (String execution : new String[]{"executedPrice", "clientPrice", "coverPrice"}) {
            assertThat(triggered.has(execution)).as(execution).isFalse();
        }
    }

    @Test
    void amendsWorkingOrderAtomicallyAndPreservesImmutableTerms() throws Exception {
        JsonNode placed = placeWorking("BUY", "1.05000");
        String path = "/api/v1/resting-orders/" + placed.path("orderId").asText();
        ObjectNode amendment = mapper.createObjectNode().put("requestId", "amend-request")
                .put("channel", "WEB").put("segment", "C").put("customerId", "0000123456")
                .put("quantity", 2000000).put("limitPrice", new BigDecimal("1.04000"))
                .put("timeInForce", "GOOD_TILL_TIME")
                .put("expiresAt", OffsetDateTime.now(ZoneOffset.UTC).plusHours(1).toString());

        JsonNode amended = checked(put(path).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(amendment)), 200);
        assertThat(amended.path("requestId").asText()).isEqualTo("amend-request");
        assertThat(amended.path("originalRequestId")).isEqualTo(placed.path("originalRequestId"));
        assertThat(amended.path("orderId")).isEqualTo(placed.path("orderId"));
        assertThat(amended.path("currencyPair")).isEqualTo(placed.path("currencyPair"));
        assertThat(amended.path("quantity").decimalValue()).isEqualByComparingTo("2000000");
        assertThat(amended.path("limitPrice").decimalValue()).isEqualByComparingTo("1.04000");
        assertThat(amended.path("lastEvaluatedAt").isMissingNode()).isTrue();

        checked(identified(delete(path), "cancel-amended", "0000123456"), 200);
        checked(put(path).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(amendment.put("requestId", "too-late"))), 409);
    }

    @Test
    void cancelsOnlyWhileWorkingAndStopsEvaluation() throws Exception {
        JsonNode placed = placeWorking("BUY", "99.00000");
        String path = "/api/v1/resting-orders/" + placed.path("orderId").asText();

        JsonNode cancelled = checked(identified(delete(path), "cancel", "0000123456"), 200);
        assertThat(cancelled.path("status").asText()).isEqualTo("CANCELLED");
        assertThat(cancelled.path("callbackStatus").asText()).isEqualTo("NOT_REQUIRED");
        assertThat(cancelled.path("closedAt").asText()).isNotBlank();

        JsonNode conflict = checked(identified(delete(path), "cancel-again", "0000123456"), 409);
        assertThat(conflict.path("errorCode").asText()).isEqualTo("ORDER_NOT_WORKING");

        monitor.evaluateWorkingOrders();
        assertThat(checked(identified(get(path), "after-evaluation", "0000123456"), 200).path("status").asText())
                .isEqualTo("CANCELLED");
    }
}
