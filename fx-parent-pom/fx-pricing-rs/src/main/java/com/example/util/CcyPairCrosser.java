package com.example.util;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicReferenceArray;

/**
 * Derives an executable bid/ask for a target pair from two USD-legged pairs.
 *
 * <p>The enum API is the production path. Pair structure is already resolved by {@link CcyPair},
 * so calculator lookup uses only enum ordinals and array access. The string overloads are adapters
 * for uppercase symbols and deliberately perform no case normalization.</p>
 */
public final class CcyPairCrosser {

    private static final int PAIR_TYPE_COUNT = CcyPair.values().length;

    /*
     * Every ordered enum triple has one collision-free slot. This replaces hashing, primitive
     * symbol packing, linear probing, and a fixed capacity limit from the previous cache.
     */
    private static final AtomicReferenceArray<CrossRateCalculator> CALCULATOR_CACHE =
            new AtomicReferenceArray<>(PAIR_TYPE_COUNT * PAIR_TYPE_COUNT * PAIR_TYPE_COUNT);

    private CcyPairCrosser() {
    }

    /**
     * One-off enum API. It reuses the cached calculator but allocates the returned array.
     */
    public static double[] crossRate(CcyPair firstUsdPair,
                                     double firstPairBid,
                                     double firstPairAsk,
                                     CcyPair secondUsdPair,
                                     double secondPairBid,
                                     double secondPairAsk,
                                     CcyPair targetPair) {
        return calculatorFor(firstUsdPair, secondUsdPair, targetPair)
                .crossRate(firstPairBid, firstPairAsk, secondPairBid, secondPairAsk);
    }

    /**
     * Compatibility adapter for exact uppercase pair names.
     *
     * <p>No uppercase conversion or case-insensitive fallback is performed. Unknown or lowercase
     * symbols fail through {@link CcyPair#valueOf(String)}.</p>
     */
    public static double[] crossRate(String firstUsdPair,
                                     double firstPairBid,
                                     double firstPairAsk,
                                     String secondUsdPair,
                                     double secondPairBid,
                                     double secondPairAsk,
                                     String targetPair) {
        return crossRate(
                CcyPair.valueOf(firstUsdPair), firstPairBid, firstPairAsk,
                CcyPair.valueOf(secondUsdPair), secondPairBid, secondPairAsk,
                CcyPair.valueOf(targetPair));
    }

    /**
     * Returns the shared immutable calculator for an ordered enum combination.
     *
     * <p>The cache index is calculated directly from the three enum ordinals. A hit requires no
     * hash, collision probe, temporary key, symbol parsing, or allocation. On the first lookup,
     * topology is validated and the formula retained by the target-pair enum is selected.</p>
     */
    public static CrossRateCalculator calculatorFor(CcyPair firstUsdPair,
                                                    CcyPair secondUsdPair,
                                                    CcyPair targetPair) {
        Objects.requireNonNull(firstUsdPair, "firstUsdPair");
        Objects.requireNonNull(secondUsdPair, "secondUsdPair");
        Objects.requireNonNull(targetPair, "targetPair");

        int cacheIndex = cacheIndex(firstUsdPair, secondUsdPair, targetPair);
        CrossRateCalculator cached = CALCULATOR_CACHE.get(cacheIndex);
        if (cached != null) {
            return cached;
        }

        CrossRateCalculator candidate = createCalculator(firstUsdPair, secondUsdPair, targetPair);
        if (CALCULATOR_CACHE.compareAndSet(cacheIndex, null, candidate)) {
            return candidate;
        }
        return CALCULATOR_CACHE.get(cacheIndex);
    }

    /**
     * Compatibility adapter for exact uppercase pair names. Prefer the enum overload when pair
     * identity is already known by the caller.
     */
    public static CrossRateCalculator calculatorFor(String firstUsdPair,
                                                    String secondUsdPair,
                                                    String targetPair) {
        return calculatorFor(
                CcyPair.valueOf(firstUsdPair),
                CcyPair.valueOf(secondUsdPair),
                CcyPair.valueOf(targetPair));
    }

    private static int cacheIndex(CcyPair firstUsdPair,
                                  CcyPair secondUsdPair,
                                  CcyPair targetPair) {
        return (firstUsdPair.ordinal() * PAIR_TYPE_COUNT + secondUsdPair.ordinal())
                * PAIR_TYPE_COUNT + targetPair.ordinal();
    }

    private static CrossRateCalculator createCalculator(CcyPair firstUsdPair,
                                                        CcyPair secondUsdPair,
                                                        CcyPair targetPair) {
        requireUsdLeg(firstUsdPair, "firstUsdPair");
        requireUsdLeg(secondUsdPair, "secondUsdPair");
        Ccy firstCcy = firstUsdPair.nonUsdCcy();
        Ccy secondCcy = secondUsdPair.nonUsdCcy();
        if (firstCcy == secondCcy) {
            throw new IllegalArgumentException(
                    "Input pairs must have distinct non-USD currencies: "
                            + firstUsdPair + ", " + secondUsdPair);
        }

        requireAvailableCurrency(targetPair.base(), firstCcy, secondCcy);
        requireAvailableCurrency(targetPair.quote(), firstCcy, secondCcy);

        if (targetPair.isUsdLeg()) {
            if (targetPair == firstUsdPair) {
                return new CrossRateCalculator(CcyPair.CrossRateFormula.COPY_FIRST_PAIR);
            }
            if (targetPair == secondUsdPair) {
                return new CrossRateCalculator(CcyPair.CrossRateFormula.COPY_SECOND_PAIR);
            }
            throw new AssertionError("Canonical USD target did not match either input pair");
        }

        CcyPair.CrossRateFormula formula = targetPair.crossRateFormula();
        if (targetPair.base() == firstCcy) {
            return new CrossRateCalculator(formula);
        }
        return new CrossRateCalculator(formula.withSwappedInputs());
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

    /**
     * Immutable, thread-safe executable formula for one ordered pair combination.
     */
    public static final class CrossRateCalculator {

        private final CcyPair.CrossRateFormula formula;

        private CrossRateCalculator(CcyPair.CrossRateFormula formula) {
            this.formula = formula;
        }

        /**
         * Validates both input quotes and returns a newly allocated {@code {bid, ask}} array.
         */
        public double[] crossRate(double firstPairBid, double firstPairAsk,
                                  double secondPairBid, double secondPairAsk) {
            double[] result = new double[2];
            crossRate(firstPairBid, firstPairAsk, secondPairBid, secondPairAsk, result);
            return result;
        }

        /**
         * Validates both input quotes and writes into caller-owned storage without allocation.
         */
        public void crossRate(double firstPairBid, double firstPairAsk,
                              double secondPairBid, double secondPairAsk,
                              double[] result) {
            validateDestination(result);
            validateQuote(firstPairBid, firstPairAsk, "first pair");
            validateQuote(secondPairBid, secondPairAsk, "second pair");
            calculate(firstPairBid, firstPairAsk, secondPairBid, secondPairAsk, result, true);
        }

        /**
         * Fast path for already validated quotes and a result array of length at least two.
         */
        public void crossRateUnchecked(double firstPairBid, double firstPairAsk,
                                       double secondPairBid, double secondPairAsk,
                                       double[] result) {
            calculate(firstPairBid, firstPairAsk, secondPairBid, secondPairAsk, result, false);
        }

        private void calculate(double firstPairBid, double firstPairAsk,
                               double secondPairBid, double secondPairAsk,
                               double[] result, boolean validateResult) {
            switch (formula) {
                case COPY_FIRST_PAIR:
                    writeResult(result, firstPairBid, firstPairAsk, validateResult);
                    return;
                case COPY_SECOND_PAIR:
                    writeResult(result, secondPairBid, secondPairAsk, validateResult);
                    return;
                case DIVIDE_FIRST_BY_SECOND:
                    writeResult(result, firstPairBid / secondPairAsk,
                            firstPairAsk / secondPairBid, validateResult);
                    return;
                case MULTIPLY_FIRST_AND_SECOND:
                    writeResult(result, firstPairBid * secondPairBid,
                            firstPairAsk * secondPairAsk, validateResult);
                    return;
                case RECIPROCAL_OF_PAIR_PRODUCT:
                    writeResult(result, 1.0d / (firstPairAsk * secondPairAsk),
                            1.0d / (firstPairBid * secondPairBid), validateResult);
                    return;
                case DIVIDE_SECOND_BY_FIRST:
                    writeResult(result, secondPairBid / firstPairAsk,
                            secondPairAsk / firstPairBid, validateResult);
                    return;
                default:
                    throw new AssertionError("Unknown cross-rate formula: " + formula);
            }
        }
    }

    private static void validateDestination(double[] result) {
        if (result == null || result.length < 2) {
            throw new IllegalArgumentException("Result array must have length at least two");
        }
    }

    private static void validateQuote(double bid, double ask, String argumentName) {
        if (!Double.isFinite(bid) || !Double.isFinite(ask) || bid <= 0.0d || ask <= 0.0d) {
            throw new IllegalArgumentException(argumentName
                    + " bid/ask must be finite and positive: bid=" + bid + " ask=" + ask);
        }
        if (bid > ask) {
            throw new IllegalArgumentException(argumentName
                    + " bid cannot exceed ask: bid=" + bid + " ask=" + ask);
        }
    }

    private static void writeResult(double[] result, double bid, double ask, boolean validateResult) {
        if (validateResult
                && (!Double.isFinite(bid) || !Double.isFinite(ask)
                || bid <= 0.0d || ask <= 0.0d || bid > ask)) {
            throw new IllegalArgumentException("Calculated cross bid/ask is invalid: bid="
                    + bid + " ask=" + ask);
        }
        result[0] = bid;
        result[1] = ask;
    }
}
