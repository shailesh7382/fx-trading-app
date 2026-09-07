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
import com.example.fx.simulator.api.model.QuoteType;
import com.example.fx.simulator.api.model.Side;
import com.example.fx.simulator.api.model.Tenor;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SimulatorTradingServiceTest {

    private final FxSwapCurve swapCurve = new FxSwapCurve();

    @Test
    void rejectsBookingWhenQuoteHasExpired() {
        SimulatorTradingService service = new SimulatorTradingService(
                Clock.fixed(Instant.parse("2026-09-08T08:00:00Z"), ZoneOffset.UTC),
                new Random(42),
                swapCurve,
                Duration.ZERO
        );
        PriceRequest priceRequest = new PriceRequest(
                "expired-price-request",
                "WEB",
                "C",
                "0000123456",
                "EURUSD",
                new BigDecimal("1000000"),
                "EUR",
                Tenor.SPOT,
                QuoteType.ONE_WAY
        ).side(Side.BUY);
        PriceQuote quote = service.requestPrice(priceRequest);
        BookingRequest booking = new BookingRequest(
                "expired-booking-request",
                "WEB",
                "C",
                "0000123456",
                quote.getQuoteId(),
                Side.BUY
        );

        assertThatThrownBy(() -> service.bookTrade(booking))
                .isInstanceOf(SimulatorApiException.class)
                .extracting("errorCode")
                .isEqualTo("QUOTE_EXPIRED");
    }

    @Test
    void derivesForwardPointsFromTheConfiguredTenorCurves() {
        BigDecimal spot = new BigDecimal("1.10000");

        BigDecimal spotPoints = swapCurve.swapPoints("EURUSD", Tenor.SPOT, spot, 5);
        BigDecimal oneMonthPoints = swapCurve.swapPoints("EURUSD", Tenor.ONE_MONTH, spot, 5);
        BigDecimal oneYearPoints = swapCurve.swapPoints("EURUSD", Tenor.ONE_YEAR, spot, 5);

        assertThat(spotPoints).isZero();
        assertThat(oneMonthPoints).isPositive();
        assertThat(oneYearPoints).isGreaterThan(oneMonthPoints);
    }
}
