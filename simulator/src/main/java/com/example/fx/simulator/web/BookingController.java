package com.example.fx.simulator.web;

import java.net.URI;
import java.util.UUID;

import com.example.fx.tradingsystems.api.BookingApi;
import com.example.fx.tradingsystems.api.model.BookedTrade;
import com.example.fx.tradingsystems.api.model.BookingRequest;
import com.example.fx.simulator.service.SimulatorTradingService;
import com.example.fx.simulator.domain.TradingModels.*;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class BookingController implements BookingApi {

    private final SimulatorTradingService simulatorTradingService;
    private final SimulatorApiMapper mapper;

    public BookingController(SimulatorTradingService simulatorTradingService, SimulatorApiMapper mapper) {
        this.simulatorTradingService = simulatorTradingService;
        this.mapper = mapper;
    }

    @Override
    public ResponseEntity<BookedTrade> bookTrade(String idempotencyKey, BookingRequest bookingRequest) {
        RequestContext context = mapper.context(bookingRequest);
        BookingResult result = simulatorTradingService.bookTrade(context, idempotencyKey, bookingRequest.getQuoteId(), bookingRequest.getSide());
        if (!result.created()) {
            return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(mapper.trade(result.trade(), context));
        }
        return ResponseEntity
                .created(URI.create("/api/v1/bookings/" + result.trade().tradeId()))
                .contentType(MediaType.APPLICATION_JSON)
                .body(mapper.trade(result.trade(), context));
    }

    @Override
    public ResponseEntity<BookedTrade> getBooking(String xRequestId, String xChannel, String xSegment,
                                                 String xCustomerId, UUID tradeId) {
        RequestContext context = new RequestContext(xRequestId, xChannel, xSegment, xCustomerId);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON)
                .body(mapper.trade(simulatorTradingService.getBooking(tradeId, context), context));
    }
}
