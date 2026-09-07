package com.example.fx.simulator.web;

import java.net.URI;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.stream.Collectors;

import com.example.fx.simulator.api.model.ApiProblem;
import com.example.fx.simulator.service.SimulatorApiException;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class SimulatorExceptionHandler {

    private final Clock clock;

    public SimulatorExceptionHandler(Clock clock) {
        this.clock = clock;
    }

    @ExceptionHandler(SimulatorApiException.class)
    ResponseEntity<ApiProblem> handleSimulatorException(SimulatorApiException exception) {
        return problem(
                exception.getStatus(),
                exception.getErrorCode(),
                exception.getTitle(),
                exception.getMessage()
        );
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiProblem> handleInvalidBody(MethodArgumentNotValidException exception) {
        String detail = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + " " + error.getDefaultMessage())
                .distinct()
                .collect(Collectors.joining("; "));
        return badRequest(detail.isBlank() ? "The request body is invalid." : detail);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    ResponseEntity<ApiProblem> handleMethodValidation(HandlerMethodValidationException exception) {
        return badRequest("One or more request values violate the API contract.");
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ResponseEntity<ApiProblem> handleConstraintViolation(ConstraintViolationException exception) {
        String detail = exception.getConstraintViolations().stream()
                .map(violation -> violation.getPropertyPath() + " " + violation.getMessage())
                .distinct()
                .collect(Collectors.joining("; "));
        return badRequest(detail);
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<ApiProblem> handleUnreadableRequest(Exception exception) {
        return badRequest("The request contains malformed JSON or a value of the wrong type.");
    }

    private ResponseEntity<ApiProblem> badRequest(String detail) {
        return problem(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Invalid request", detail);
    }

    private ResponseEntity<ApiProblem> problem(
            HttpStatus status,
            String errorCode,
            String title,
            String detail
    ) {
        ApiProblem body = new ApiProblem(
                UUID.randomUUID(),
                OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC),
                URI.create("urn:problem:fx-simulator:" + errorCode.toLowerCase().replace('_', '-')),
                title,
                status.value(),
                detail,
                errorCode
        );
        return ResponseEntity
                .status(status)
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .body(body);
    }
}
