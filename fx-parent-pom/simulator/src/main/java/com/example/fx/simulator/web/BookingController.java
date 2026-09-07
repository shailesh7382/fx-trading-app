package com.example.fx.simulator.web;

import java.net.URI;
import java.util.UUID;

import com.example.fx.simulator.api.BookingApi;
import com.example.fx.simulator.api.model.BookedTrade;
import com.example.fx.simulator.api.model.BookingRequest;
import com.example.fx.simulator.service.SimulatorTradingService;
import com.example.fx.simulator.service.SimulatorTradingService.BookingResult;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class BookingController implements BookingApi {

    private final SimulatorTradingService simulatorTradingService;

    public BookingController(SimulatorTradingService simulatorTradingService) {
        this.simulatorTradingService = simulatorTradingService;
    }

    @Override
    public ResponseEntity<BookedTrade> bookTrade(BookingRequest bookingRequest) {
        BookingResult result = simulatorTradingService.bookTrade(bookingRequest);
        if (!result.created()) {
            return ResponseEntity.ok(result.trade());
        }
        return ResponseEntity
                .created(URI.create("/api/v1/bookings/" + result.trade().getTradeId()))
                .body(result.trade());
    }

    @Override
    public ResponseEntity<BookedTrade> getBooking(UUID tradeId) {
        return ResponseEntity.ok(simulatorTradingService.getBooking(tradeId));
    }
}
