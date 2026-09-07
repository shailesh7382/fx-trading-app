package com.example.fx.simulator.service;

import com.example.fx.simulator.api.model.Side;
import org.springframework.http.HttpStatus;

public final class SimulatorApiException extends RuntimeException {

    private final HttpStatus status;
    private final String errorCode;
    private final String title;

    private SimulatorApiException(HttpStatus status, String errorCode, String title, String detail) {
        super(detail);
        this.status = status;
        this.errorCode = errorCode;
        this.title = title;
    }

    public static SimulatorApiException unsupportedInstrument(String currencyPair) {
        return new SimulatorApiException(
                HttpStatus.UNPROCESSABLE_ENTITY,
                "UNSUPPORTED_INSTRUMENT",
                "Unsupported instrument",
                "No simulated market is configured for " + currencyPair + "."
        );
    }

    public static SimulatorApiException invalidPricingRequest(String detail) {
        return new SimulatorApiException(
                HttpStatus.BAD_REQUEST,
                "INVALID_PRICING_REQUEST",
                "Invalid pricing request",
                detail
        );
    }

    public static SimulatorApiException invalidRequest(String detail) {
        return new SimulatorApiException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Invalid request", detail);
    }

    public static SimulatorApiException capacityExceeded() {
        return new SimulatorApiException(HttpStatus.SERVICE_UNAVAILABLE, "CAPACITY_EXCEEDED",
                "Simulator capacity exceeded", "Retained state is full; retry later with the same idempotency key.");
    }

    public static SimulatorApiException quoteNotFound(Object quoteId) {
        return new SimulatorApiException(
                HttpStatus.NOT_FOUND,
                "QUOTE_NOT_FOUND",
                "Quote not found",
                "Quote " + quoteId + " does not exist."
        );
    }

    public static SimulatorApiException tradeNotFound(Object tradeId) {
        return new SimulatorApiException(
                HttpStatus.NOT_FOUND,
                "TRADE_NOT_FOUND",
                "Trade not found",
                "Trade " + tradeId + " does not exist."
        );
    }

    public static SimulatorApiException quoteExpired(Object quoteId) {
        return new SimulatorApiException(
                HttpStatus.GONE,
                "QUOTE_EXPIRED",
                "Quote expired",
                "Quote " + quoteId + " has expired and cannot be booked."
        );
    }

    public static SimulatorApiException quoteAlreadyBooked(Object quoteId) {
        return new SimulatorApiException(
                HttpStatus.CONFLICT,
                "QUOTE_ALREADY_BOOKED",
                "Quote already booked",
                "Quote " + quoteId + " has already been used to book a trade."
        );
    }

    public static SimulatorApiException sideNotQuoted(Side side, Object quoteId) {
        return new SimulatorApiException(
                HttpStatus.BAD_REQUEST,
                "SIDE_NOT_QUOTED",
                "Side not quoted",
                "Quote " + quoteId + " does not contain a " + side + " price."
        );
    }

    public static SimulatorApiException idempotencyConflict(String requestId) {
        return new SimulatorApiException(
                HttpStatus.CONFLICT,
                "IDEMPOTENCY_CONFLICT",
                "Idempotency conflict",
                "Idempotency-Key " + requestId + " was already used for different booking details."
        );
    }

    public static SimulatorApiException orderNotFound(Object orderId) {
        return new SimulatorApiException(
                HttpStatus.NOT_FOUND,
                "ORDER_NOT_FOUND",
                "Order not found",
                "Limit order " + orderId + " does not exist."
        );
    }

    public static SimulatorApiException orderNotWorking(Object orderId, Object status) {
        return new SimulatorApiException(
                HttpStatus.CONFLICT,
                "ORDER_NOT_WORKING",
                "Order not working",
                "Limit order " + orderId + " is " + status + " and can no longer be cancelled."
        );
    }

    public static SimulatorApiException invalidLimitOrder(String detail) {
        return new SimulatorApiException(HttpStatus.BAD_REQUEST, "INVALID_LIMIT_ORDER", "Invalid limit order", detail);
    }

    public static SimulatorApiException callbackUrlNotAllowed(String callbackUrl) {
        return new SimulatorApiException(
                HttpStatus.UNPROCESSABLE_ENTITY,
                "CALLBACK_URL_NOT_ALLOWED",
                "Callback URL not allowed",
                "The simulator is not configured to deliver events to " + callbackUrl + "."
        );
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public String getTitle() {
        return title;
    }
}
