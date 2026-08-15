package com.example.util;

import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

class CcyPairCrosserTest {

    private static final Logger LOGGER = LoggerFactory.getLogger(CcyPairCrosserTest.class);

    @Test
    void calculatesAllUsdLegOrientationsWithExecutableBidAsk() {
        assertCross("EURUSD", 1.0850, 1.0852,
                "GBPUSD", 1.2650, 1.2653, "EURGBP",
                1.0850 / 1.2653, 1.0852 / 1.2650);

        assertCross("EURUSD", 1.0850, 1.0852,
                "USDJPY", 145.30, 145.35, "EURJPY",
                1.0850 * 145.30, 1.0852 * 145.35);

        assertCross("USDJPY", 145.30, 145.35,
                "CHFUSD", 1.1347, 1.1350, "JPYCHF",
                1.0 / (145.35 * 1.1350), 1.0 / (145.30 * 1.1347));

        assertCross("USDJPY", 145.30, 145.35,
                "USDCHF", 0.8810, 0.8813, "JPYCHF",
                0.8810 / 145.35, 0.8813 / 145.30);
    }

    @Test
    void producesTheSameCrossWhenInputLegsAreSwapped() {
        CcyPairCrosser.CompiledCross route = CcyPairCrosser.compile(
                "USDJPY", "EURUSD", "EURJPY");

        double[] result = route.crossRate(145.30, 145.35, 1.0850, 1.0852);

        assertQuote("swapped USDJPY + EURUSD -> EURJPY", result,
                1.0850 * 145.30, 1.0852 * 145.35);
    }

    @Test
    void supportsEveryLegOrientationInputOrderAndTargetDirection() {
        Object[][] eurLegs = {
                {"EURUSD", 1.0850, 1.0852},
                {"USDEUR", 1.0 / 1.0852, 1.0 / 1.0850}
        };
        Object[][] jpyLegs = {
                {"JPYUSD", 1.0 / 145.35, 1.0 / 145.30},
                {"USDJPY", 145.30, 145.35}
        };
        double eurJpyBid = 1.0850 * 145.30;
        double eurJpyAsk = 1.0852 * 145.35;

        for (Object[] eurLeg : eurLegs) {
            for (Object[] jpyLeg : jpyLegs) {
                assertCompiledCross(eurLeg, jpyLeg, "EURJPY", eurJpyBid, eurJpyAsk);
                assertCompiledCross(jpyLeg, eurLeg, "EURJPY", eurJpyBid, eurJpyAsk);
                assertCompiledCross(eurLeg, jpyLeg, "JPYEUR",
                        1.0 / eurJpyAsk, 1.0 / eurJpyBid);
                assertCompiledCross(jpyLeg, eurLeg, "JPYEUR",
                        1.0 / eurJpyAsk, 1.0 / eurJpyBid);
            }
        }
    }

    @Test
    void copiesOrInvertsEitherInputForUsdTargets() {
        CcyPairCrosser.CompiledCross eurUsd = CcyPairCrosser.compile(
                "EURUSD", "USDJPY", "EURUSD");
        CcyPairCrosser.CompiledCross usdEur = CcyPairCrosser.compile(
                "EURUSD", "USDJPY", "USDEUR");
        CcyPairCrosser.CompiledCross usdJpy = CcyPairCrosser.compile(
                "EURUSD", "USDJPY", "USDJPY");
        CcyPairCrosser.CompiledCross jpyUsd = CcyPairCrosser.compile(
                "EURUSD", "USDJPY", "JPYUSD");

        assertQuote("direct EURUSD", eurUsd.crossRate(1.0850, 1.0852, 145.30, 145.35),
                1.0850, 1.0852);
        assertQuote("inverse USDEUR", usdEur.crossRate(1.0850, 1.0852, 145.30, 145.35),
                1.0 / 1.0852, 1.0 / 1.0850);
        assertQuote("direct USDJPY", usdJpy.crossRate(1.0850, 1.0852, 145.30, 145.35),
                145.30, 145.35);
        assertQuote("inverse JPYUSD", jpyUsd.crossRate(1.0850, 1.0852, 145.30, 145.35),
                1.0 / 145.35, 1.0 / 145.30);
    }

    @Test
    void reusesCallerOwnedStorageOnTheCheckedAndUncheckedHotPaths() {
        CcyPairCrosser.CompiledCross route = CcyPairCrosser.compile(
                "EURUSD", "USDJPY", "EURJPY");
        double[] result = {-1.0, -1.0};

        route.crossRate(1.0850, 1.0852, 145.30, 145.35, result);
        assertQuote("checked reusable result", result,
                1.0850 * 145.30, 1.0852 * 145.35);

        route.crossRateUnchecked(1.0860, 1.0862, 145.40, 145.45, result);
        assertQuote("unchecked reusable result", result,
                1.0860 * 145.40, 1.0862 * 145.45);
    }

    @Test
    void compatibilityApiAcceptsLowercaseSymbols() {
        double[] result = CcyPairCrosser.crossRate(
                "eurusd", 1.0850, 1.0852,
                "usdjpy", 145.30, 145.35,
                "eurjpy");

        assertQuote("lowercase compatibility API", result,
                1.0850 * 145.30, 1.0852 * 145.35);
    }

    @Test
    void rejectsInvalidOrAmbiguousInstrumentTopologyAtCompileTime() {
        LOGGER.info("Verifying compile-time rejection of malformed and ambiguous currency routes");

        assertThatThrownBy(() -> CcyPairCrosser.compile(null, "USDJPY", "EURJPY"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("pair1");
        assertThatThrownBy(() -> CcyPairCrosser.compile("EURUS1", "USDJPY", "EURJPY"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("ASCII letters");
        assertThatThrownBy(() -> CcyPairCrosser.compile("EURGBP", "USDJPY", "EURJPY"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("exactly one USD leg");
        assertThatThrownBy(() -> CcyPairCrosser.compile("USDUSD", "USDJPY", "EURJPY"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("exactly one USD leg");
        assertThatThrownBy(() -> CcyPairCrosser.compile("EURUSD", "USDEUR", "EURUSD"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("distinct non-USD currencies");
        assertThatThrownBy(() -> CcyPairCrosser.compile("EURUSD", "USDJPY", "GBPCHF"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("currency GBP");
        assertThatThrownBy(() -> CcyPairCrosser.compile("EURUSD", "USDJPY", "EUREUR"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("must differ");
    }

    @Test
    void rejectsNonFiniteNonPositiveAndCrossedQuotes() {
        CcyPairCrosser.CompiledCross route = CcyPairCrosser.compile(
                "EURUSD", "USDJPY", "EURJPY");
        LOGGER.info("Verifying runtime rejection of NaN, infinity, zero, and crossed quotes");

        assertThatThrownBy(() -> route.crossRate(Double.NaN, 1.1, 145.30, 145.35))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("finite and positive");
        assertThatThrownBy(() -> route.crossRate(1.0, Double.POSITIVE_INFINITY, 145.30, 145.35))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("finite and positive");
        assertThatThrownBy(() -> route.crossRate(0.0, 1.1, 145.30, 145.35))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("finite and positive");
        assertThatThrownBy(() -> route.crossRate(1.2, 1.1, 145.30, 145.35))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cannot exceed ask");
    }

    @Test
    void rejectsInvalidDestinationAndArithmeticOverflowWithoutPublishingAResult() {
        CcyPairCrosser.CompiledCross route = CcyPairCrosser.compile(
                "EURUSD", "USDJPY", "EURJPY");
        LOGGER.info("Verifying destination bounds and fail-before-publish overflow behavior");

        assertThatThrownBy(() -> route.crossRate(1.0, 1.1, 145.30, 145.35, new double[1]))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("length at least two");

        double[] result = {7.0, 8.0};
        assertThatThrownBy(() -> route.crossRate(
                Double.MAX_VALUE, Double.MAX_VALUE,
                Double.MAX_VALUE, Double.MAX_VALUE,
                result))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Calculated cross");
        assertThat(result).containsExactly(7.0, 8.0);
    }

    private static void assertCross(String pair1, double pair1Bid, double pair1Ask,
                                    String pair2, double pair2Bid, double pair2Ask,
                                    String crossPair, double expectedBid, double expectedAsk) {
        CcyPairCrosser.CompiledCross route = CcyPairCrosser.compile(pair1, pair2, crossPair);
        assertQuote(pair1 + " + " + pair2 + " -> " + crossPair,
                route.crossRate(pair1Bid, pair1Ask, pair2Bid, pair2Ask),
                expectedBid, expectedAsk);
    }

    private static void assertCompiledCross(Object[] pair1, Object[] pair2, String crossPair,
                                            double expectedBid, double expectedAsk) {
        CcyPairCrosser.CompiledCross route = CcyPairCrosser.compile(
                (String) pair1[0], (String) pair2[0], crossPair);
        String scenario = pair1[0] + " + " + pair2[0] + " -> " + crossPair;
        assertQuote(scenario, route.crossRate(
                        (double) pair1[1], (double) pair1[2],
                        (double) pair2[1], (double) pair2[2]),
                expectedBid, expectedAsk);
    }

    private static void assertQuote(String scenario, double[] result,
                                    double expectedBid, double expectedAsk) {
        LOGGER.info("{} | actual bid={} ask={} | expected bid={} ask={} | spread={}",
                scenario, result[0], result[1], expectedBid, expectedAsk, result[1] - result[0]);
        assertThat(result[0]).isCloseTo(expectedBid, within(1.0e-12));
        assertThat(result[1]).isCloseTo(expectedAsk, within(1.0e-12));
        assertThat(result[0]).isLessThanOrEqualTo(result[1]);
    }
}
