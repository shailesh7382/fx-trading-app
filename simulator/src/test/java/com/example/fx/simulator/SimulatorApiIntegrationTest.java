package com.example.fx.simulator;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.stream.Stream;
import com.example.fx.tradingsystems.api.model.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockMvcClientHttpRequestFactory;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.support.RestClientAdapter;
import org.springframework.web.service.invoker.HttpServiceProxyFactory;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class SimulatorApiIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;

    ObjectNode price(String type, String currency, String side) {
        ObjectNode request = mapper.createObjectNode().put("requestId", UUID.randomUUID().toString())
                .put("channel", "WEB").put("segment", "C").put("customerId", "0000123456")
                .put("currencyPair", "EURUSD").put("quantity", 1000000).put("quantityCurrency", currency)
                .put("tenor", "ONE_MONTH").put("quoteType", type);
        if (side != null) request.put("side", side);
        return request;
    }

    MockHttpServletRequestBuilder pricePost(ObjectNode input) throws Exception {
        return post("/api/v1/pricing/quotes").contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsBytes(input));
    }

    MockHttpServletRequestBuilder identifiedGet(String path, String requestId) {
        return get(path).header("X-Request-Id", requestId).header("X-Channel", "WEB")
                .header("X-Segment", "C").header("X-Customer-Id", "0000123456");
    }

    ObjectNode booking(JsonNode quote, String requestId, String side) {
        return mapper.createObjectNode().put("requestId", requestId).put("channel", "WEB")
                .put("segment", "C").put("customerId", "0000123456")
                .put("quoteId", quote.path("quoteId").asText()).put("side", side);
    }

    MockHttpServletRequestBuilder bookingPost(ObjectNode body, String key) throws Exception {
        return post("/api/v1/bookings").header("Idempotency-Key", key).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(body));
    }

    JsonNode checked(MockHttpServletRequestBuilder request, int expected) throws Exception {
        var result = mvc.perform(request).andExpect(status().is(expected)).andReturn();
        ContractAssertions.validResponse(result);
        return mapper.readTree(result.getResponse().getContentAsString());
    }

    @Test
    void createsBooksReplaysAndRetrievesWithCurrentRequestContext() throws Exception {
        ObjectNode input = price("ONE_WAY", "EUR", "BUY");
        JsonNode quote = checked(pricePost(input), 201);
        assertThat(quote.path("requestId")).isEqualTo(input.path("requestId"));
        assertThat(quote.path("originalRequestId")).isEqualTo(input.path("requestId"));
        assertThat(quote.has("prices")).isFalse();
        assertThat(quote.has("buyCoverPrice")).isFalse();
        assertThat(quote.path("side").asText()).isEqualTo("BUY");

        String key = UUID.randomUUID().toString();
        JsonNode trade = checked(bookingPost(booking(quote, "book-original", "BUY"), key), 201);
        assertThat(trade.path("buyCurrency").asText()).isEqualTo("EUR");
        assertThat(trade.path("buyQuantity").decimalValue()).isEqualByComparingTo("1000000");
        assertThat(trade.path("sellQuantity").decimalValue()).isEqualByComparingTo(
                quote.path("clientPrice").decimalValue().multiply(new BigDecimal("1000000")).setScale(2, RoundingMode.HALF_UP));
        assertThat(trade.path("coverPrice")).isEqualTo(quote.path("coverPrice"));

        JsonNode replay = checked(bookingPost(booking(quote, "book-retry", "BUY"), key), 200);
        assertThat(replay.path("requestId").asText()).isEqualTo("book-retry");
        assertThat(replay.path("originalRequestId").asText()).isEqualTo("book-original");
        assertThat(replay.path("responseId")).isNotEqualTo(trade.path("responseId"));
        for (String field : new String[]{"tradeId", "bookedAt", "clientPrice", "buyQuantity", "sellQuantity"}) {
            assertThat(replay.path(field)).isEqualTo(trade.path(field));
        }
        JsonNode fetched = checked(identifiedGet("/api/v1/pricing/quotes/" + quote.path("quoteId").asText(), "quote-lookup"), 200);
        assertThat(fetched.path("requestId").asText()).isEqualTo("quote-lookup");
        assertThat(fetched.path("originalRequestId")).isEqualTo(input.path("requestId"));
        assertThat(fetched.path("status").asText()).isEqualTo("BOOKED");
        JsonNode fetchedTrade = checked(identifiedGet("/api/v1/bookings/" + trade.path("tradeId").asText(), "trade-lookup"), 200);
        assertThat(fetchedTrade.path("requestId").asText()).isEqualTo("trade-lookup");
        assertThat(fetchedTrade.path("originalRequestId").asText()).isEqualTo("book-original");
    }

    @ParameterizedTest
    @MethodSource("directions")
    void booksEitherSideAndEitherQuantityCurrency(String currency, String side) throws Exception {
        JsonNode quote = checked(pricePost(price("TWO_WAY", currency, null)), 201);
        assertThat(quote.has("side")).isFalse();
        assertThat(quote.has("clientPrice")).isFalse();
        assertThat(quote.has("prices")).isFalse();
        String prefix = side.equals("BUY") ? "buy" : "sell";
        JsonNode trade = checked(bookingPost(booking(quote, "book-two-way", side), UUID.randomUUID().toString()), 201);
        assertThat(trade.path("clientPrice")).isEqualTo(quote.path(prefix + "ClientPrice"));
        assertThat(trade.path(prefix + "Currency").asText()).isEqualTo(currency);
        assertThat(trade.path(prefix + "Quantity").decimalValue()).isEqualByComparingTo("1000000");
    }

    static Stream<Arguments> directions() {
        return Stream.of(Arguments.of("EUR", "BUY"), Arguments.of("EUR", "SELL"),
                Arguments.of("USD", "BUY"), Arguments.of("USD", "SELL"));
    }

    @Test
    void requiresMatchingIdentityForLookupAndBooking() throws Exception {
        JsonNode quote = checked(pricePost(price("ONE_WAY", "EUR", "BUY")), 201);
        String path = "/api/v1/pricing/quotes/" + quote.path("quoteId").asText();
        checked(get(path), 400);
        for (String field : new String[]{"channel", "segment", "customerId"}) {
            String changed = field.equals("channel") ? "VOICE" : field.equals("segment") ? "I" : "0000654321";
            checked(bookingPost(booking(quote, "wrong-context", "BUY").put(field, changed), UUID.randomUUID().toString()), 404);
        }
        checked(get(path).header("X-Request-Id", "wrong-customer").header("X-Channel", "WEB")
                .header("X-Segment", "C").header("X-Customer-Id", "0000654321"), 404);
        JsonNode trade = checked(bookingPost(booking(quote, "correct", "BUY"), UUID.randomUUID().toString()), 201);
        checked(get("/api/v1/bookings/" + trade.path("tradeId").asText()).header("X-Request-Id", "wrong-channel")
                .header("X-Channel", "VOICE").header("X-Segment", "C").header("X-Customer-Id", "0000123456"), 404);
    }

    @Test
    void conflictsOnChangedFingerprintAndRejectsUnquotedSide() throws Exception {
        JsonNode quote = checked(pricePost(price("ONE_WAY", "EUR", "BUY")), 201);
        ObjectNode body = booking(quote, "first", "BUY");
        checked(bookingPost(booking(quote, "wrong-side", "SELL"), UUID.randomUUID().toString()), 400);
        checked(post("/api/v1/bookings").contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsBytes(body)), 400);
        String key = UUID.randomUUID().toString();
        checked(bookingPost(body, key), 201);
        for (Consumer<ObjectNode> change : java.util.List.<Consumer<ObjectNode>>of(
                b -> b.put("side", "SELL"), b -> b.put("channel", "VOICE"), b -> b.put("segment", "I"),
                b -> b.put("quoteId", UUID.randomUUID().toString()))) {
            ObjectNode modified = body.deepCopy();
            change.accept(modified);
            JsonNode error = checked(bookingPost(modified, key), 409);
            assertThat(error.path("errorCode").asText()).isEqualTo("IDEMPOTENCY_CONFLICT");
            assertThat(error.path("requestId").asText()).isEqualTo("first");
        }
        checked(bookingPost(body, UUID.randomUUID().toString()), 409);
    }

    @Test
    void enforcesVariantShapesAndScalarTypes() throws Exception {
        for (Consumer<ObjectNode> invalid : java.util.List.<Consumer<ObjectNode>>of(
                p -> p.remove("side"), p -> p.put("side", "UNKNOWN"), p -> p.putNull("side"),
                p -> p.put("quoteType", "OTHER"), p -> p.remove("quoteType"),
                p -> p.put("customerId", 1234567890L), p -> p.put("quantity", "1000000"),
                p -> p.put("quantity", 0), p -> p.put("quantity", new BigDecimal("0.001")),
                p -> p.put("quantity", new BigDecimal("1000000000001")), p -> p.put("typo", true),
                p -> p.put("quantityCurrency", "JPY"), p -> p.put("channel", " ".repeat(3)),
                p -> p.put("segment", "CC"), p -> p.put("customerId", "123"))) {
            ObjectNode body = price("ONE_WAY", "EUR", "BUY");
            invalid.accept(body);
            checked(pricePost(body), 400);
        }
        checked(pricePost(price("TWO_WAY", "EUR", "BUY")), 400);
        checked(pricePost(price("TWO_WAY", "EUR", null).putNull("side")), 400);
        checked(pricePost(price("TWO_WAY", "EUR", null).put("buyClientPrice", 1)), 400);
    }

    @Test
    void schemasRejectMissingOrMixedPriceFieldsAndBadRequestVariants() throws Exception {
        ObjectNode quote = (ObjectNode) checked(pricePost(price("ONE_WAY", "EUR", "BUY")), 201);
        assertThat(ContractAssertions.priceResponse(quote.toString()).hasErrors()).isFalse();
        ObjectNode missing = quote.deepCopy();
        missing.remove("clientPrice");
        assertThat(ContractAssertions.priceResponse(missing.toString()).hasErrors()).isTrue();
        assertThat(ContractAssertions.priceResponse(quote.deepCopy().put("buyClientPrice", 1).toString()).hasErrors()).isTrue();
        assertThat(ContractAssertions.priceResponse(quote.deepCopy().put("quoteType", "TWO_WAY").toString()).hasErrors()).isTrue();
        ObjectNode twoWay = (ObjectNode) checked(pricePost(price("TWO_WAY", "EUR", null)), 201);
        twoWay.remove("sellSwapPoints");
        assertThat(ContractAssertions.priceResponse(twoWay.toString()).hasErrors()).isTrue();
        ObjectNode request = price("ONE_WAY", "EUR", null);
        assertThat(ContractAssertions.priceRequest(request.toString()).hasErrors()).isTrue();
        assertThat(ContractAssertions.priceRequest(price("TWO_WAY", "EUR", "BUY").toString()).hasErrors()).isTrue();
    }

    @Test
    void returnsCorrelatedProblemResponsesAndCorrectMediaTypes() throws Exception {
        ObjectNode unsupported = price("ONE_WAY", "AAA", "BUY").put("currencyPair", "AAAQQQ");
        JsonNode error = checked(pricePost(unsupported), 422);
        for (String field : new String[]{"requestId", "channel", "segment", "customerId"}) {
            assertThat(error.path(field)).isEqualTo(unsupported.path(field));
        }
        checked(pricePost(price("ONE_WAY", "EUR", "BUY")).accept(MediaType.APPLICATION_PROBLEM_JSON), 406);
        checked(post("/api/v1/pricing/quotes").contentType(MediaType.TEXT_PLAIN).content("{}"), 415);
        checked(identifiedGet("/api/v1/pricing/quotes/not-a-uuid", "invalid-id"), 400);
        checked(identifiedGet("/api/v1/pricing/quotes/" + UUID.randomUUID(), "missing-quote"), 404);
        checked(identifiedGet("/api/v1/bookings/" + UUID.randomUUID(), "missing-trade"), 404);
    }

    @Test
    void generatedHttpClientsRoundTripBothVariantsAndBookings() throws Exception {
        var client = RestClient.builder().requestFactory(new MockMvcClientHttpRequestFactory(mvc)).build();
        var factory = HttpServiceProxyFactory.builderFor(RestClientAdapter.create(client)).build();
        var pricing = factory.createClient(com.example.fx.tradingsystems.client.PricingApi.class);
        var bookings = factory.createClient(com.example.fx.tradingsystems.client.BookingApi.class);
        OneWayPriceRequest one = mapper.treeToValue(price("ONE_WAY", "EUR", "BUY"), OneWayPriceRequest.class);
        OneWayPriceQuote quote = (OneWayPriceQuote) pricing.requestPrice(one).getBody();
        assertThat(quote.getClientPrice()).isPositive();
        assertThat(pricing.getPriceQuote(quote.getQuoteId(), "lookup-client", "WEB", "C", "0000123456").getBody())
                .isInstanceOf(OneWayPriceQuote.class);
        TwoWayPriceRequest two = mapper.treeToValue(price("TWO_WAY", "USD", null), TwoWayPriceRequest.class);
        assertThat(pricing.requestPrice(two).getBody()).isInstanceOf(TwoWayPriceQuote.class);
        BookingRequest input = new BookingRequest("client-book", "WEB", "C", "0000123456", quote.getQuoteId(), Side.BUY);
        String key = UUID.randomUUID().toString();
        var trade = bookings.bookTrade(key, input).getBody();
        input.setRequestId("client-retry");
        assertThat(bookings.bookTrade(key, input).getBody().getTradeId()).isEqualTo(trade.getTradeId());
        assertThat(bookings.getBooking("client-get", "WEB", "C", "0000123456", trade.getTradeId()).getBody().getRequestId())
                .isEqualTo("client-get");
        assertThatThrownBy(() -> pricing.getPriceQuote(UUID.randomUUID(), "missing", "WEB", "C", "0000123456"))
                .isInstanceOfSatisfying(RestClientResponseException.class, exception ->
                        assertThat(exception.getResponseBodyAs(ApiProblem.class).getErrorCode()).isEqualTo("QUOTE_NOT_FOUND"));
    }

    @Test
    void servesAuthoritativeContract() throws Exception {
        mvc.perform(get("/openapi/fx-trading-systems-api.yaml")).andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("version: 2.5.0")));
    }
}
