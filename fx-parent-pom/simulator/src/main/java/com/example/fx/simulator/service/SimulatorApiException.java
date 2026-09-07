package com.example.fx.simulator.service;

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

    public static SimulatorApiException idempotencyConflict(String clientRequestId) {
        return new SimulatorApiException(
                HttpStatus.CONFLICT,
                "IDEMPOTENCY_CONFLICT",
                "Idempotency conflict",
                "clientRequestId " + clientRequestId + " was already used for different booking details."
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
