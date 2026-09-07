package com.example.fx.simulator.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Random;

import com.example.fx.simulator.api.model.BookingRequest;
import com.example.fx.simulator.api.model.PriceQuote;
import com.example.fx.simulator.api.model.PriceRequest;
import com.example.fx.simulator.api.model.Side;
import com.example.fx.simulator.api.model.Tenor;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SimulatorTradingServiceTest {

    @Test
    void rejectsBookingWhenQuoteHasExpired() {
        SimulatorTradingService service = new SimulatorTradingService(
                Clock.fixed(Instant.parse("2026-09-08T08:00:00Z"), ZoneOffset.UTC),
                new Random(42),
                Duration.ZERO
        );
        PriceQuote quote = service.requestPrice(
                new PriceRequest("EURUSD", new BigDecimal("1000000"), Tenor.SPOT)
        );
        BookingRequest booking = new BookingRequest(quote.getQuoteId(), Side.BUY, "expired-quote-booking");

        assertThatThrownBy(() -> service.bookTrade(booking))
                .isInstanceOf(SimulatorApiException.class)
                .extracting("errorCode")
                .isEqualTo("QUOTE_EXPIRED");
    }
}
