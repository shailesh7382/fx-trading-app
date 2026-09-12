package com.example.fx.simulator.web;

import java.net.URI;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.UUID;
import java.util.stream.Collectors;
import com.example.fx.simulator.api.model.ApiProblem;
import com.example.fx.simulator.service.SimulatorApiException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.WebUtils;

@RestControllerAdvice
public class SimulatorExceptionHandler extends ResponseEntityExceptionHandler {
    private static final Logger LOG = LoggerFactory.getLogger(SimulatorExceptionHandler.class);
    private final Clock clock;
    private final ObjectMapper mapper;

    public SimulatorExceptionHandler(Clock clock, ObjectMapper mapper) {
        this.clock = clock;
        this.mapper = mapper;
    }

    @ExceptionHandler(SimulatorApiException.class)
    ResponseEntity<Object> handleSimulatorException(SimulatorApiException exception) {
        LOG.warn("Simulator request rejected status={} errorCode={} detail={}",
                exception.getStatus().value(), exception.getErrorCode(), exception.getMessage());
        return problem(exception.getStatus(), exception.getErrorCode(), exception.getTitle(), exception.getMessage(), new HttpHeaders());
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ResponseEntity<Object> handleConstraintViolation(ConstraintViolationException exception) {
        LOG.debug("Simulator request failed constraint validation violations={}",
                exception.getConstraintViolations().size());
        return problem(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Invalid request",
                "One or more request values violate the API contract.", new HttpHeaders());
    }

    @Override
    protected ResponseEntity<Object> handleExceptionInternal(Exception exception, Object body, HttpHeaders headers,
                                                              HttpStatusCode status, WebRequest webRequest) {
        String detail = exception instanceof MethodArgumentNotValidException invalid
                ? invalid.getBindingResult().getFieldErrors().stream()
                    .map(error -> error.getField() + " " + error.getDefaultMessage()).distinct().collect(Collectors.joining("; "))
                : "The request could not be processed.";
        LOG.debug("Simulator request could not be processed status={} exceptionType={} detail={}",
                status.value(), exception.getClass().getSimpleName(), detail);
        return problem(status, "INVALID_REQUEST", "Invalid request", detail, headers);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Object> handleUnexpected(Exception exception) {
        LOG.error("Unexpected simulator failure", exception);
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Internal error",
                "An unexpected error occurred.", new HttpHeaders());
    }

    private ResponseEntity<Object> problem(HttpStatusCode status, String code, String title, String detail, HttpHeaders headers) {
        ApiProblem body = new ApiProblem(UUID.randomUUID(), OffsetDateTime.now(clock),
                URI.create("urn:problem:fx-simulator:" + code.toLowerCase(Locale.ROOT).replace('_', '-')),
                title, status.value(), detail, code);
        HttpServletRequest request = currentRequest();
        JsonNode input = null;
        ContentCachingRequestWrapper cached = request == null
                ? null
                : WebUtils.getNativeRequest(request, ContentCachingRequestWrapper.class);
        if (cached != null && cached.getContentAsByteArray().length > 0) {
            try { input = mapper.readTree(cached.getContentAsByteArray()); }
            catch (java.io.IOException ignored) { /* Malformed or truncated bodies may have no recoverable context. */ }
        }
        body.setRequestId(contextValue(request, input, "requestId", "X-Request-Id"));
        body.setChannel(contextValue(request, input, "channel", "X-Channel"));
        body.setSegment(contextValue(request, input, "segment", "X-Segment"));
        body.setCustomerId(contextValue(request, input, "customerId", "X-Customer-Id"));
        return ResponseEntity.status(status).headers(headers).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(body);
    }

    private String contextValue(HttpServletRequest request, JsonNode body, String field, String header) {
        if (body != null && body.path(field).isTextual()) return body.path(field).textValue();
        return request == null ? null : request.getHeader(header);
    }

    /** An injected request is an interface proxy, so the caching wrapper is only reachable through the bound attributes. */
    private static HttpServletRequest currentRequest() {
        return RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes
                ? attributes.getRequest()
                : null;
    }
}
