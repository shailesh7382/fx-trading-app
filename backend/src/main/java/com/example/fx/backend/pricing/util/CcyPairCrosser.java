package com.example.fx.backend.pricing.util;

/**
 * Derives the bid/ask of a target pair from two USD-legged pairs, e.g. EURUSD + USDJPY -&gt; EURJPY.
 *
 * <p>Pair topology (base/quote currencies, USD orientation, cross-rate formula) is resolved once
 * per {@link CcyPair} constant at class initialization; this class only selects and applies it.</p>
 */
public final class CcyPairCrosser {

    private static final double RESULT_ROUNDING_FACTOR = 1_000_000.0; // 6 decimal places

    private CcyPairCrosser() {
    }

    /**
     * @param firstUsdPair   first USD-legged pair, e.g. EURUSD
     * @param firstPairBid   bid of firstUsdPair
     * @param firstPairAsk   ask of firstUsdPair
     * @param secondUsdPair  second USD-legged pair, e.g. USDJPY
     * @param secondPairBid  bid of secondUsdPair
     * @param secondPairAsk  ask of secondUsdPair
     * @param targetPair     the cross pair to derive, e.g. EURJPY
     * @return {bid, ask} of targetPair
     */
    public static double[] crossRate(CcyPair firstUsdPair, double firstPairBid, double firstPairAsk,
                                      CcyPair secondUsdPair, double secondPairBid, double secondPairAsk,
                                      CcyPair targetPair) {
        requireUsdLeg(firstUsdPair, "firstUsdPair");
        requireUsdLeg(secondUsdPair, "secondUsdPair");
        validateQuote(firstPairBid, firstPairAsk, "first pair");
        validateQuote(secondPairBid, secondPairAsk, "second pair");

        Ccy firstCcy = firstUsdPair.nonUsdCcy();
        Ccy secondCcy = secondUsdPair.nonUsdCcy();
        if (firstCcy == secondCcy) {
            throw new IllegalArgumentException(
                    "Input pairs must have distinct non-USD currencies: " + firstUsdPair + ", " + secondUsdPair);
        }
        requireAvailableCurrency(targetPair.base(), firstCcy, secondCcy);
        requireAvailableCurrency(targetPair.quote(), firstCcy, secondCcy);

        if (targetPair.isUsdLeg()) {
            if (targetPair == firstUsdPair) {
                return validatedResult(firstPairBid, firstPairAsk);
            }
            if (targetPair == secondUsdPair) {
                return validatedResult(secondPairBid, secondPairAsk);
            }
            throw new AssertionError("Canonical USD target did not match either input pair");
        }

        CcyPair.CrossRateFormula formula = targetPair.crossRateFormula();
        if (targetPair.base() != firstCcy) {
            formula = formula.withSwappedInputs();
        }
        return calculate(formula, firstPairBid, firstPairAsk, secondPairBid, secondPairAsk);
    }

    /**
     * Compatibility adapter for exact uppercase pair names. No case normalization is performed;
     * unknown or lowercase symbols fail through {@link CcyPair#valueOf(String)}.
     */
    public static double[] crossRate(String firstUsdPair, double firstPairBid, double firstPairAsk,
                                      String secondUsdPair, double secondPairBid, double secondPairAsk,
                                      String targetPair) {
        return crossRate(
                CcyPair.valueOf(firstUsdPair), firstPairBid, firstPairAsk,
                CcyPair.valueOf(secondUsdPair), secondPairBid, secondPairAsk,
                CcyPair.valueOf(targetPair));
    }

    private static double[] calculate(CcyPair.CrossRateFormula formula,
                                       double firstBid, double firstAsk,
                                       double secondBid, double secondAsk) {
        switch (formula) {
            case DIVIDE_FIRST_BY_SECOND:
                return validatedResult(firstBid / secondAsk, firstAsk / secondBid);
            case MULTIPLY_FIRST_AND_SECOND:
                return validatedResult(firstBid * secondBid, firstAsk * secondAsk);
            case RECIPROCAL_OF_PAIR_PRODUCT:
                return validatedResult(1.0 / (firstAsk * secondAsk), 1.0 / (firstBid * secondBid));
            case DIVIDE_SECOND_BY_FIRST:
                return validatedResult(secondBid / firstAsk, secondAsk / firstBid);
            default:
                throw new AssertionError("Unknown cross-rate formula: " + formula);
        }
    }

    private static void requireUsdLeg(CcyPair pair, String argumentName) {
        if (!pair.isUsdLeg()) {
            throw new IllegalArgumentException(argumentName + " must be a USD leg: " + pair);
        }
    }

    private static void requireAvailableCurrency(Ccy ccy, Ccy firstCcy, Ccy secondCcy) {
        if (ccy != Ccy.USD && ccy != firstCcy && ccy != secondCcy) {
            throw new IllegalArgumentException("No input pair contains currency " + ccy);
        }
    }

    private static void validateQuote(double bid, double ask, String argumentName) {
        if (!Double.isFinite(bid) || !Double.isFinite(ask) || bid <= 0.0 || ask <= 0.0) {
            throw new IllegalArgumentException(
                    argumentName + " bid/ask must be finite and positive: bid=" + bid + " ask=" + ask);
        }
        if (bid > ask) {
            throw new IllegalArgumentException(argumentName + " bid cannot exceed ask: bid=" + bid + " ask=" + ask);
        }
    }

    private static double[] validatedResult(double bid, double ask) {
        if (!Double.isFinite(bid) || !Double.isFinite(ask) || bid <= 0.0 || ask <= 0.0 || bid > ask) {
            throw new IllegalArgumentException("Calculated cross bid/ask is invalid: bid=" + bid + " ask=" + ask);
        }
        return new double[]{round(bid), round(ask)};
    }

    private static double round(double value) {
        return Math.round(value * RESULT_ROUNDING_FACTOR) / RESULT_ROUNDING_FACTOR;
    }
}
