package com.example.fx.simulator;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SimulatorApiIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void requestsAndBooksOneWayPriceIdempotently() throws Exception {
        String quoteResponse = mockMvc.perform(post("/api/v1/pricing/quotes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(oneWayPriceRequest("pricing-request-1", "EUR", "BUY")))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.requestId").value("pricing-request-1"))
                .andExpect(jsonPath("$.channel").value("WEB"))
                .andExpect(jsonPath("$.segment").value("C"))
                .andExpect(jsonPath("$.customerId").value("0000123456"))
                .andExpect(jsonPath("$.responseId").isNotEmpty())
                .andExpect(jsonPath("$.responseAt").isNotEmpty())
                .andExpect(jsonPath("$.quotedAt").isNotEmpty())
                .andExpect(jsonPath("$.quoteType").value("ONE_WAY"))
                .andExpect(jsonPath("$.prices").doesNotExist())
                .andExpect(jsonPath("$.side").value("BUY"))
                .andExpect(jsonPath("$.coverPrice").isNumber())
                .andExpect(jsonPath("$.clientPrice").isNumber())
                .andExpect(jsonPath("$.swapPoints").isNumber())
                .andExpect(jsonPath("$.buyCoverPrice").doesNotExist())
                .andExpect(jsonPath("$.sellCoverPrice").doesNotExist())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode quote = objectMapper.readTree(quoteResponse);
        String quoteId = quote.required("quoteId").asText();
        String bookingJson = bookingRequest("booking-request-1", quoteId, "BUY");

        String bookingResponse = mockMvc.perform(post("/api/v1/bookings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bookingJson))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.requestId").value("booking-request-1"))
                .andExpect(jsonPath("$.channel").value("WEB"))
                .andExpect(jsonPath("$.segment").value("C"))
                .andExpect(jsonPath("$.customerId").value("0000123456"))
                .andExpect(jsonPath("$.responseId").isNotEmpty())
                .andExpect(jsonPath("$.responseAt").isNotEmpty())
                .andExpect(jsonPath("$.bookedAt").isNotEmpty())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode trade = objectMapper.readTree(bookingResponse);
        assertThat(trade.required("clientPrice").decimalValue())
                .isEqualByComparingTo(quote.required("clientPrice").decimalValue());
        assertThat(trade.required("coverPrice").decimalValue())
                .isEqualByComparingTo(quote.required("coverPrice").decimalValue());
        assertThat(trade.required("swapPoints").decimalValue())
                .isEqualByComparingTo(quote.required("swapPoints").decimalValue());
        assertThat(trade.required("status").asText()).isEqualTo("BOOKED");

        String replayResponse = mockMvc.perform(post("/api/v1/bookings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bookingJson))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        JsonNode replay = objectMapper.readTree(replayResponse);
        assertThat(replay.required("tradeId")).isEqualTo(trade.required("tradeId"));
        assertThat(replay.required("bookedAt")).isEqualTo(trade.required("bookedAt"));
        assertThat(replay.required("responseId")).isNotEqualTo(trade.required("responseId"));

        mockMvc.perform(get("/api/v1/pricing/quotes/{quoteId}", quoteId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("BOOKED"));

        mockMvc.perform(get("/api/v1/bookings/{tradeId}", trade.required("tradeId").asText()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.requestId").value("booking-request-1"));
    }

    @Test
    void returnsBuyAndSellPricesForTwoWayRequest() throws Exception {
        String response = mockMvc.perform(post("/api/v1/pricing/quotes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "requestId": "two-way-request-1",
                                  "channel": "VOICE",
                                  "segment": "I",
                                  "customerId": "0000654321",
                                  "currencyPair": "EURUSD",
                                  "quantity": 5000000,
                                  "quantityCurrency": "USD",
                                  "tenor": "SIX_MONTHS",
                                  "quoteType": "TWO_WAY"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.quoteType").value("TWO_WAY"))
                .andExpect(jsonPath("$.prices").doesNotExist())
                .andExpect(jsonPath("$.side").doesNotExist())
                .andExpect(jsonPath("$.coverPrice").doesNotExist())
                .andExpect(jsonPath("$.clientPrice").doesNotExist())
                .andExpect(jsonPath("$.swapPoints").doesNotExist())
                .andExpect(jsonPath("$.buyCoverPrice").isNumber())
                .andExpect(jsonPath("$.buyClientPrice").isNumber())
                .andExpect(jsonPath("$.buySwapPoints").isNumber())
                .andExpect(jsonPath("$.sellCoverPrice").isNumber())
                .andExpect(jsonPath("$.sellClientPrice").isNumber())
                .andExpect(jsonPath("$.sellSwapPoints").isNumber())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode quote = objectMapper.readTree(response);
        assertThat(quote.required("buyClientPrice").decimalValue())
                .isLessThan(quote.required("buyCoverPrice").decimalValue());
        assertThat(quote.required("sellClientPrice").decimalValue())
                .isGreaterThan(quote.required("sellCoverPrice").decimalValue());
        assertThat(quote.required("buySwapPoints"))
                .isEqualTo(quote.required("sellSwapPoints"));
    }

    @Test
    void returnsContractedProblemResponses() throws Exception {
        mockMvc.perform(post("/api/v1/pricing/quotes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(oneWayPriceRequest("invalid-pair", "EUR", "BUY").replace("EURUSD", "eurusd")))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.responseId").isNotEmpty())
                .andExpect(jsonPath("$.responseAt").isNotEmpty())
                .andExpect(jsonPath("$.errorCode").value("INVALID_REQUEST"));

        mockMvc.perform(post("/api/v1/pricing/quotes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(oneWayPriceRequest("wrong-quantity-ccy", "JPY", "BUY")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("INVALID_PRICING_REQUEST"));

        mockMvc.perform(post("/api/v1/pricing/quotes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(oneWayPriceRequest("unsupported-pair", "AAA", "BUY").replace("EURUSD", "AAAQQQ")))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errorCode").value("UNSUPPORTED_INSTRUMENT"));
    }

    @Test
    void enforcesIdentificationFieldLengthsAndQuoteDirectionRules() throws Exception {
        mockMvc.perform(post("/api/v1/pricing/quotes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(oneWayPriceRequest("missing-side", "EUR", null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("INVALID_PRICING_REQUEST"));

        mockMvc.perform(post("/api/v1/pricing/quotes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(oneWayPriceRequest("bad-identifiers", "EUR", "BUY")
                                .replace("WEB", "CHANNEL-NAME-OVER-20-CHARS")
                                .replace("\"segment\": \"C\"", "\"segment\": \"CC\"")
                                .replace("0000123456", "123")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("INVALID_REQUEST"));

        mockMvc.perform(post("/api/v1/pricing/quotes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "requestId": "two-way-with-side",
                                  "channel": "WEB",
                                  "segment": "C",
                                  "customerId": "0000123456",
                                  "currencyPair": "EURUSD",
                                  "quantity": 1000000,
                                  "quantityCurrency": "EUR",
                                  "tenor": "ONE_MONTH",
                                  "quoteType": "TWO_WAY",
                                  "side": "BUY"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("INVALID_PRICING_REQUEST"));
    }

    @Test
    void rejectsASideThatWasNotIncludedInAOneWayQuote() throws Exception {
        String response = mockMvc.perform(post("/api/v1/pricing/quotes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(oneWayPriceRequest("buy-only-request", "EUR", "BUY")))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String quoteId = objectMapper.readTree(response).required("quoteId").asText();

        mockMvc.perform(post("/api/v1/bookings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bookingRequest("wrong-side-booking", quoteId, "SELL")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("SIDE_NOT_QUOTED"));
    }

    @Test
    void exposesTheAuthoredOpenApiContract() throws Exception {
        mockMvc.perform(get("/openapi/fx-simulator-api.yaml"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("title: FX Simulator API")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("buyCoverPrice:")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("/api/v1/bookings:")));
    }

    private String oneWayPriceRequest(String requestId, String quantityCurrency, String side) {
        String sideField = side == null ? "" : ",\n  \"side\": \"" + side + "\"";
        return """
                {
                  "requestId": "%s",
                  "channel": "WEB",
                  "segment": "C",
                  "customerId": "0000123456",
                  "currencyPair": "EURUSD",
                  "quantity": 1000000,
                  "quantityCurrency": "%s",
                  "tenor": "ONE_MONTH",
                  "quoteType": "ONE_WAY"%s
                }
                """.formatted(requestId, quantityCurrency, sideField);
    }

    private String bookingRequest(String requestId, String quoteId, String side) {
        return """
                {
                  "requestId": "%s",
                  "channel": "WEB",
                  "segment": "C",
                  "customerId": "0000123456",
                  "quoteId": "%s",
                  "side": "%s"
                }
                """.formatted(requestId, quoteId, side);
    }
}
