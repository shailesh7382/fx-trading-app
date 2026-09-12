package com.example.fx.backend.pricing.model;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LimitOrderJsonTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void keepsTheExistingTradeReferenceJsonKeyForFrontendCompatibility() {
        LimitOrder order = new LimitOrder();
        order.setTradingSystemTradeId("trade-123");

        JsonNode json = mapper.valueToTree(order);

        assertThat(json.path("simulatorTradeId").asText()).isEqualTo("trade-123");
        assertThat(json.has("tradingSystemTradeId")).isFalse();
    }
}
