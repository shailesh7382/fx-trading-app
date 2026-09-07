package com.example.fx.simulator.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;

import com.example.fx.simulator.api.model.Tenor;
import org.springframework.stereotype.Component;

@Component
public class FxSwapCurve {

    private static final Map<String, Map<Tenor, BigDecimal>> ANNUALIZED_CURRENCY_CURVES = Map.of(
            "USD", curve("0.0430", "0.0425", "0.0410", "0.0390", "0.0360"),
            "EUR", curve("0.0220", "0.0215", "0.0205", "0.0190", "0.0175"),
            "GBP", curve("0.0370", "0.0365", "0.0350", "0.0330", "0.0300"),
            "JPY", curve("0.0060", "0.0065", "0.0070", "0.0080", "0.0100"),
            "AUD", curve("0.0390", "0.0385", "0.0375", "0.0360", "0.0340"),
            "CAD", curve("0.0310", "0.0305", "0.0295", "0.0280", "0.0260"),
            "NZD", curve("0.0450", "0.0440", "0.0425", "0.0400", "0.0370"),
            "CHF", curve("0.0040", "0.0045", "0.0050", "0.0060", "0.0080")
    );

    public BigDecimal swapPoints(String currencyPair, Tenor tenor, BigDecimal spot, int rateScale) {
        if (tenor == Tenor.SPOT) {
            return BigDecimal.ZERO.setScale(rateScale, RoundingMode.HALF_UP);
        }

        String baseCurrency = currencyPair.substring(0, 3);
        String quoteCurrency = currencyPair.substring(3, 6);
        BigDecimal baseRate = rateFor(baseCurrency, tenor);
        BigDecimal quoteRate = rateFor(quoteCurrency, tenor);
        BigDecimal yearFraction = yearFraction(tenor);

        BigDecimal quoteGrowth = BigDecimal.ONE.add(quoteRate.multiply(yearFraction));
        BigDecimal baseGrowth = BigDecimal.ONE.add(baseRate.multiply(yearFraction));
        BigDecimal forward = spot.multiply(quoteGrowth)
                .divide(baseGrowth, rateScale + 8, RoundingMode.HALF_UP);
        return forward.subtract(spot).setScale(rateScale, RoundingMode.HALF_UP);
    }

    private BigDecimal rateFor(String currency, Tenor tenor) {
        Map<Tenor, BigDecimal> curve = ANNUALIZED_CURRENCY_CURVES.get(currency);
        if (curve == null) {
            throw SimulatorApiException.unsupportedInstrument(currency);
        }
        return curve.get(tenor);
    }

    private BigDecimal yearFraction(Tenor tenor) {
        return switch (tenor) {
            case SPOT -> BigDecimal.ZERO;
            case ONE_WEEK -> new BigDecimal("0.0191780822");
            case ONE_MONTH -> new BigDecimal("0.0833333333");
            case THREE_MONTHS -> new BigDecimal("0.25");
            case SIX_MONTHS -> new BigDecimal("0.50");
            case ONE_YEAR -> BigDecimal.ONE;
        };
    }

    private static Map<Tenor, BigDecimal> curve(
            String oneWeek,
            String oneMonth,
            String threeMonths,
            String sixMonths,
            String oneYear
    ) {
        return Map.of(
                Tenor.ONE_WEEK, new BigDecimal(oneWeek),
                Tenor.ONE_MONTH, new BigDecimal(oneMonth),
                Tenor.THREE_MONTHS, new BigDecimal(threeMonths),
                Tenor.SIX_MONTHS, new BigDecimal(sixMonths),
                Tenor.ONE_YEAR, new BigDecimal(oneYear)
        );
    }
}
