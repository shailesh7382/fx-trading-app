package com.example.fx.simulator.service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import com.example.fx.tradingsystems.api.model.Tenor;
import com.example.fx.simulator.config.SettlementProperties;
import com.example.fx.simulator.domain.TradingModels.SettlementDates;
import org.springframework.stereotype.Component;

@Component
public class SettlementDateCalculator {
    private final SettlementProperties properties;

    public SettlementDateCalculator(SettlementProperties properties) {
        this.properties = properties;
    }

    public SettlementDates calculate(String pair, LocalDate tradeDate, Tenor tenor) {
        LocalDate spot = tradeDate;
        int lag = properties.spotLags().getOrDefault(pair, 2);
        for (int remaining = lag; remaining > 0;) {
            spot = spot.plusDays(1);
            if (isBusinessDay(pair, spot)) remaining--;
        }
        while (!isBusinessDay(pair, spot)) spot = spot.plusDays(1);
        if (tenor == Tenor.SPOT) return new SettlementDates(spot, spot);

        LocalDate target = switch (tenor) {
            case ONE_WEEK -> spot.plusWeeks(1);
            case ONE_MONTH -> spot.plusMonths(1);
            case THREE_MONTHS -> spot.plusMonths(3);
            case SIX_MONTHS -> spot.plusMonths(6);
            case ONE_YEAR -> spot.plusYears(1);
            case SPOT -> throw new IllegalStateException("SPOT already handled");
        };
        // Preserve the last business day convention for month/year tenors.
        if (tenor != Tenor.ONE_WEEK
                && spot.equals(previousBusinessDay(pair, YearMonth.from(spot).atEndOfMonth()))) {
            target = YearMonth.from(target).atEndOfMonth();
        }
        LocalDate adjusted = target;
        while (!isBusinessDay(pair, adjusted)) adjusted = adjusted.plusDays(1);
        if (!YearMonth.from(adjusted).equals(YearMonth.from(target))) {
            adjusted = previousBusinessDay(pair, target);
        }
        return new SettlementDates(spot, adjusted);
    }

    private LocalDate previousBusinessDay(String pair, LocalDate date) {
        while (!isBusinessDay(pair, date)) date = date.minusDays(1);
        return date;
    }

    private boolean isBusinessDay(String pair, LocalDate date) {
        return date.getDayOfWeek() != DayOfWeek.SATURDAY && date.getDayOfWeek() != DayOfWeek.SUNDAY
                && !properties.holidays().getOrDefault(pair.substring(0, 3), List.of()).contains(date)
                && !properties.holidays().getOrDefault(pair.substring(3), List.of()).contains(date);
    }
}
