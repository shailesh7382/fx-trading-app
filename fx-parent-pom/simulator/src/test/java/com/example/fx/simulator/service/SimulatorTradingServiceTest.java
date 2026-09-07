package com.example.fx.simulator.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Random;

import com.example.fx.simulator.api.model.Side;
import com.example.fx.simulator.api.model.Tenor;
import com.example.fx.simulator.config.SettlementProperties;
import com.example.fx.simulator.config.SimulatorStateProperties;
import com.example.fx.simulator.domain.TradingModels.PricingCommand;
import com.example.fx.simulator.domain.TradingModels.Quote;
import com.example.fx.simulator.domain.TradingModels.RequestContext;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SimulatorTradingServiceTest {

    private static final Duration QUOTE_TTL = Duration.ofSeconds(30);

    private final MutableClock clock = new MutableClock(Instant.parse("2026-09-08T08:00:00Z"));
    private final FxSwapCurve swapCurve = new FxSwapCurve();
    private final SettlementCalculator settlement = new SettlementCalculator();
    private final SimulatorTradingService service = new SimulatorTradingService(
            new FxPricingEngine(clock, new Random(42), swapCurve,
                    new SettlementDateCalculator(new SettlementProperties(Map.of(), Map.of())),
                    settlement, QUOTE_TTL),
            new SimulatorStateStore(clock, new SimulatorStateProperties(
                    10, 10, 10, Duration.ofMinutes(5), Duration.ofHours(24), Duration.ofHours(24))),
            settlement,
            clock
    );

    @Test
    void rejectsBookingWhenQuoteHasExpired() {
        RequestContext pricingContext = new RequestContext("expired-price-request", "WEB", "C", "0000123456");
        Quote quote = service.requestPrice(new PricingCommand(
                pricingContext, "EURUSD", new BigDecimal("1000000"), "EUR", Tenor.SPOT, Side.BUY));

        clock.advance(QUOTE_TTL);

        RequestContext bookingContext = new RequestContext("expired-booking-request", "WEB", "C", "0000123456");
        assertThatThrownBy(() -> service.bookTrade(bookingContext, "expired-booking-key", quote.quoteId(), Side.BUY))
                .isInstanceOf(SimulatorApiException.class)
                .extracting("errorCode")
                .isEqualTo("QUOTE_EXPIRED");
    }

    @Test
    void derivesForwardPointsFromTheConfiguredTenorCurves() {
        BigDecimal spot = new BigDecimal("1.10000");
        LocalDate spotDate = LocalDate.parse("2026-09-10");

        BigDecimal spotPoints = swapCurve.swapPoints("EURUSD", Tenor.SPOT, spot, spotDate, spotDate, 5);
        BigDecimal oneMonthPoints = swapCurve.swapPoints(
                "EURUSD", Tenor.ONE_MONTH, spot, spotDate, spotDate.plusMonths(1), 5);
        BigDecimal oneYearPoints = swapCurve.swapPoints(
                "EURUSD", Tenor.ONE_YEAR, spot, spotDate, spotDate.plusYears(1), 5);

        assertThat(spotPoints).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(oneMonthPoints).isPositive();
        assertThat(oneYearPoints).isGreaterThan(oneMonthPoints);
    }

    /** The quote TTL is only observable through the clock the service and its state store share. */
    private static final class MutableClock extends Clock {
        private Instant instant;

        private MutableClock(Instant instant) {
            this.instant = instant;
        }

        void advance(Duration amount) {
            instant = instant.plus(amount);
        }

        @Override
        public Instant instant() {
            return instant;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            throw new UnsupportedOperationException();
        }
    }
}
