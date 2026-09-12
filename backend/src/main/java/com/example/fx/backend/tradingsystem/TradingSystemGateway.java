package com.example.fx.backend.tradingsystem;

import com.example.fx.tradingsystems.api.model.BookedTrade;
import com.example.fx.tradingsystems.api.model.BookingRequest;
import com.example.fx.tradingsystems.api.model.PriceQuote;
import com.example.fx.tradingsystems.api.model.PriceRequest;
import com.example.fx.tradingsystems.api.model.RestingOrder;
import com.example.fx.tradingsystems.api.model.RestingOrderAmendRequest;
import com.example.fx.tradingsystems.api.model.RestingOrderRequest;
import com.example.fx.tradingsystems.client.BookingApi;
import com.example.fx.tradingsystems.client.PricingApi;
import com.example.fx.tradingsystems.client.RestingOrdersApi;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

/** Single error-normalizing boundary around the Trading System HTTP clients. */
@Component
public class TradingSystemGateway {
    private static final Logger LOG = LoggerFactory.getLogger(TradingSystemGateway.class);

    private final PricingApi pricing;
    private final BookingApi booking;
    private final RestingOrdersApi restingOrders;
    private final ObjectMapper mapper;

    public TradingSystemGateway(PricingApi pricing, BookingApi booking, RestingOrdersApi restingOrders,
                                ObjectMapper mapper) {
        this.pricing = pricing;
        this.booking = booking;
        this.restingOrders = restingOrders;
        this.mapper = mapper;
    }

    public PriceQuote requestPrice(PriceRequest request) {
        return invoke("requestPrice", () -> pricing.requestPrice(request));
    }

    public PriceQuote getPriceQuote(UUID quoteId, String requestId, String channel, String segment, String customerId) {
        return invoke("getPriceQuote", () -> pricing.getPriceQuote(quoteId, requestId, channel, segment, customerId));
    }

    public BookedTrade bookTrade(String idempotencyKey, BookingRequest request) {
        return invoke("bookTrade", () -> booking.bookTrade(idempotencyKey, request));
    }

    public BookedTrade getBooking(UUID tradeId, String requestId, String channel, String segment, String customerId) {
        return invoke("getBooking", () -> booking.getBooking(requestId, channel, segment, customerId, tradeId));
    }

    public RestingOrder placeRestingOrder(RestingOrderRequest request) {
        return invoke("placeRestingOrder", () -> restingOrders.placeRestingOrder(request));
    }

    public RestingOrder getRestingOrder(String orderId, String requestId, String channel,
                                        String segment, String customerId) {
        return invoke("getRestingOrder",
                () -> restingOrders.getRestingOrder(orderId, requestId, channel, segment, customerId));
    }

    public RestingOrder amendRestingOrder(String orderId, RestingOrderAmendRequest request) {
        return invoke("amendRestingOrder", () -> restingOrders.amendRestingOrder(orderId, request));
    }

    public RestingOrder cancelRestingOrder(String orderId, String requestId, String channel,
                                           String segment, String customerId) {
        return invoke("cancelRestingOrder",
                () -> restingOrders.cancelRestingOrder(orderId, requestId, channel, segment, customerId));
    }

    private <T> T invoke(String operationName, Supplier<ResponseEntity<T>> operation) {
        long startedAt = System.nanoTime();
        LOG.debug("Calling Trading System operation={}", operationName);
        try {
            ResponseEntity<T> response = operation.get();
            T body = response.getBody();
            if (body == null) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "Trading System returned an empty response.");
            }
            LOG.debug("Trading System call completed operation={} status={} durationMs={}", operationName,
                    response.getStatusCode(), elapsedMillis(startedAt));
            return body;
        } catch (RestClientResponseException exception) {
            String detail = problemDetail(exception);
            LOG.warn("Trading System call rejected operation={} status={} durationMs={} detail={}", operationName,
                    exception.getStatusCode(), elapsedMillis(startedAt), detail);
            throw new ResponseStatusException(exception.getStatusCode(), detail, exception);
        } catch (ResourceAccessException exception) {
            LOG.warn("Trading System call unavailable operation={} durationMs={} message={}", operationName,
                    elapsedMillis(startedAt), exception.getMessage());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Trading System is unavailable. Try again shortly.", exception);
        }
    }

    private long elapsedMillis(long startedAt) {
        return TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt);
    }

    private String problemDetail(RestClientResponseException exception) {
        try {
            JsonNode problem = mapper.readTree(exception.getResponseBodyAsByteArray());
            String detail = problem.path("detail").asText();
            String code = problem.path("errorCode").asText();
            if (!detail.isBlank()) {
                return code.isBlank() ? detail : detail + " (" + code + ")";
            }
        } catch (Exception ignored) {
            // Fall back to the HTTP status below when the remote body is not a problem document.
        }
        return "Trading System request failed with " + exception.getStatusCode() + ".";
    }
}
