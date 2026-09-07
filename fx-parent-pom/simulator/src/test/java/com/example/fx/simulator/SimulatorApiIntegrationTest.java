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
    void requestsAndBooksAnExecutableQuoteIdempotently() throws Exception {
        String quoteResponse = mockMvc.perform(post("/api/v1/pricing/quotes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "currencyPair": "EURUSD",
                                  "amount": 1000000,
                                  "tenor": "SPOT"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode quote = objectMapper.readTree(quoteResponse);
        String quoteId = quote.required("quoteId").asText();
        String ask = quote.required("ask").asText();
        String bookingJson = """
                {
                  "quoteId": "%s",
                  "side": "BUY",
                  "clientRequestId": "integration-booking-1"
                }
                """.formatted(quoteId);

        String bookingResponse = mockMvc.perform(post("/api/v1/bookings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bookingJson))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.executionRate").value(Double.parseDouble(ask)))
                .andExpect(jsonPath("$.status").value("BOOKED"))
                .andReturn()
                .getResponse()
                .getContentAsString();

        String tradeId = objectMapper.readTree(bookingResponse).required("tradeId").asText();

        String replayResponse = mockMvc.perform(post("/api/v1/bookings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bookingJson))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        assertThat(objectMapper.readTree(replayResponse).required("tradeId").asText()).isEqualTo(tradeId);

        mockMvc.perform(get("/api/v1/pricing/quotes/{quoteId}", quoteId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("BOOKED"));

        mockMvc.perform(get("/api/v1/bookings/{tradeId}", tradeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.clientRequestId").value("integration-booking-1"));
    }

    @Test
    void returnsContractedProblemResponses() throws Exception {
        mockMvc.perform(post("/api/v1/pricing/quotes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "currencyPair": "eurusd",
                                  "amount": 1000000,
                                  "tenor": "SPOT"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.errorCode").value("INVALID_REQUEST"));

        mockMvc.perform(post("/api/v1/pricing/quotes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "currencyPair": "EURUSD",
                                  "amount": 1000000,
                                  "tenor": "SPOT",
                                  "unexpectedField": true
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.errorCode").value("INVALID_REQUEST"));

        mockMvc.perform(post("/api/v1/pricing/quotes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "currencyPair": "AAAQQQ",
                                  "amount": 1000000,
                                  "tenor": "SPOT"
                                }
                                """))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.errorCode").value("UNSUPPORTED_INSTRUMENT"));
    }

    @Test
    void exposesTheAuthoredOpenApiContract() throws Exception {
        mockMvc.perform(get("/openapi/fx-simulator-api.yaml"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("title: FX Simulator API")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("/api/v1/bookings:")));
    }
}
