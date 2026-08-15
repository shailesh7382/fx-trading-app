package com.example.util;

import java.util.EnumMap;

import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

class CcyPairCrosserTest {

    private static final Logger LOGGER = LoggerFactory.getLogger(CcyPairCrosserTest.class);

    @Test
    void keepsPairNamesAndResolvedCurrenciesConsistent() {
        EnumMap<Ccy, CcyPair> usdPairByCcy = new EnumMap<>(Ccy.class);
        for (CcyPair pair : CcyPair.values()) {
            assertThat(pair.name()).isEqualTo(pair.base().name() + pair.quote().name());
            assertThat(pair.base()).isNotEqualTo(pair.quote());
            assertThat(pair.isUsdLeg())
                    .isEqualTo((pair.base() == Ccy.USD) ^ (pair.quote() == Ccy.USD));
            if (pair.isUsdLeg()) {
                assertThat(usdPairByCcy.put(pair.nonUsdCcy(), pair)).isNull();
            } else {
                assertThat(pair.crossRateFormula()).isNotNull();
            }
        }
        for (Ccy ccy : Ccy.values()) {
            if (ccy == Ccy.USD) {
                continue;
            }
            assertThat(usdPairByCcy).containsKey(ccy);
        }
        for (CcyPair pair : CcyPair.values()) {
            if (!pair.isUsdLeg()) {
                assertThat(pair.crossRateFormula())
                        .isEqualTo(expectedFormula(pair, usdPairByCcy));
            }
        }
        assertThat(usdPairByCcy).hasSize(Ccy.values().length - 1);
        LOGGER.info("Verified metadata for {} supported currency pairs", CcyPair.values().length);
    }

    @Test
    void calculatesAllUsdLegOrientationsWithExecutableBidAsk() {
        assertCross(CcyPair.EURUSD, 1.0850, 1.0852,
                CcyPair.GBPUSD, 1.2650, 1.2653, CcyPair.EURGBP,
                1.0850 / 1.2653, 1.0852 / 1.2650);

        assertCross(CcyPair.EURUSD, 1.0850, 1.0852,
                CcyPair.USDJPY, 145.30, 145.35, CcyPair.EURJPY,
                1.0850 * 145.30, 1.0852 * 145.35);

        assertCross(CcyPair.USDJPY, 145.30, 145.35,
                CcyPair.EURUSD, 1.0850, 1.0852, CcyPair.JPYEUR,
                1.0 / (145.35 * 1.0852), 1.0 / (145.30 * 1.0850));

        assertCross(CcyPair.USDJPY, 145.30, 145.35,
                CcyPair.USDCHF, 0.8810, 0.8813, CcyPair.JPYCHF,
                0.8810 / 145.35, 0.8813 / 145.30);

        assertCross(CcyPair.USDJPY, 145.30, 145.35,
                CcyPair.USDSGD, 1.3400, 1.3403, CcyPair.JPYSGD,
                1.3400 / 145.35, 1.3403 / 145.30);
    }

    @Test
    void producesTheSameCrossWhenInputLegsAreSwapped() {
        double[] result = CcyPairCrosser.crossRate(
                CcyPair.USDJPY, 145.30, 145.35,
                CcyPair.EURUSD, 1.0850, 1.0852,
                CcyPair.EURJPY);

        assertQuote("swapped USDJPY + EURUSD -> EURJPY", result,
                1.0850 * 145.30, 1.0852 * 145.35);
    }

    @Test
    void storesTheCanonicalCalculatorFormulaOnEachCrossPair() {
        assertThat(CcyPair.EURGBP.crossRateFormula())
                .isEqualTo(CcyPair.CrossRateFormula.DIVIDE_FIRST_BY_SECOND);
        assertThat(CcyPair.EURJPY.crossRateFormula())
                .isEqualTo(CcyPair.CrossRateFormula.MULTIPLY_FIRST_AND_SECOND);
        assertThat(CcyPair.JPYEUR.crossRateFormula())
                .isEqualTo(CcyPair.CrossRateFormula.RECIPROCAL_OF_PAIR_PRODUCT);
        assertThat(CcyPair.JPYCHF.crossRateFormula())
                .isEqualTo(CcyPair.CrossRateFormula.DIVIDE_SECOND_BY_FIRST);
    }

    @Test
    void copiesEitherCanonicalInputForUsdTargets() {
        assertQuote("direct EURUSD", CcyPairCrosser.crossRate(
                        CcyPair.EURUSD, 1.0850, 1.0852, CcyPair.USDJPY, 145.30, 145.35, CcyPair.EURUSD),
                1.0850, 1.0852);
        assertQuote("direct USDJPY", CcyPairCrosser.crossRate(
                        CcyPair.EURUSD, 1.0850, 1.0852, CcyPair.USDJPY, 145.30, 145.35, CcyPair.USDJPY),
                145.30, 145.35);
    }

    @Test
    void stringAdapterAcceptsExactUppercaseSymbolsWithoutCaseNormalization() {
        double[] result = CcyPairCrosser.crossRate(
                "EURUSD", 1.0850, 1.0852,
                "USDJPY", 145.30, 145.35,
                "EURJPY");

        assertQuote("uppercase string adapter", result,
                1.0850 * 145.30, 1.0852 * 145.35);
        assertThatThrownBy(() -> CcyPairCrosser.crossRate(
                "eurusd", 1.0850, 1.0852, "USDJPY", 145.30, 145.35, "EURJPY"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> CcyPairCrosser.crossRate(
                "USDEUR", 1.0850, 1.0852, "USDJPY", 145.30, 145.35, "EURJPY"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsUnsupportedOrAmbiguousInstrumentTopology() {
        LOGGER.info("Verifying rejection of unsupported and ambiguous currency routes");

        assertThatThrownBy(() -> CcyPairCrosser.crossRate(
                null, 1.0850, 1.0852, CcyPair.USDJPY, 145.30, 145.35, CcyPair.EURJPY))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> CcyPairCrosser.crossRate(
                "EURUS1", 1.0850, 1.0852, "USDJPY", 145.30, 145.35, "EURJPY"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("No enum constant");
        assertThatThrownBy(() -> CcyPairCrosser.crossRate(
                CcyPair.EURGBP, 0.8560, 0.8563, CcyPair.USDJPY, 145.30, 145.35, CcyPair.EURJPY))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("must be a USD leg");
        assertThatThrownBy(() -> CcyPairCrosser.crossRate(
                "USDUSD", 1.0, 1.0, "USDJPY", 145.30, 145.35, "EURJPY"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("No enum constant");
        assertThatThrownBy(() -> CcyPairCrosser.crossRate(
                CcyPair.EURUSD, 1.0850, 1.0852, CcyPair.EURUSD, 1.0850, 1.0852, CcyPair.EURUSD))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("distinct non-USD currencies");
        assertThatThrownBy(() -> CcyPairCrosser.crossRate(
                CcyPair.EURUSD, 1.0850, 1.0852, CcyPair.USDJPY, 145.30, 145.35, CcyPair.GBPCHF))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("currency GBP");
        assertThatThrownBy(() -> CcyPairCrosser.crossRate(
                "EURUSD", 1.0850, 1.0852, "USDJPY", 145.30, 145.35, "EUREUR"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("No enum constant");
    }

    @Test
    void rejectsNonFiniteNonPositiveAndCrossedQuotes() {
        LOGGER.info("Verifying rejection of NaN, infinity, zero, and crossed quotes");

        assertThatThrownBy(() -> CcyPairCrosser.crossRate(
                CcyPair.EURUSD, Double.NaN, 1.1, CcyPair.USDJPY, 145.30, 145.35, CcyPair.EURJPY))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("finite and positive");
        assertThatThrownBy(() -> CcyPairCrosser.crossRate(
                CcyPair.EURUSD, 1.0, Double.POSITIVE_INFINITY, CcyPair.USDJPY, 145.30, 145.35, CcyPair.EURJPY))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("finite and positive");
        assertThatThrownBy(() -> CcyPairCrosser.crossRate(
                CcyPair.EURUSD, 0.0, 1.1, CcyPair.USDJPY, 145.30, 145.35, CcyPair.EURJPY))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("finite and positive");
        assertThatThrownBy(() -> CcyPairCrosser.crossRate(
                CcyPair.EURUSD, 1.2, 1.1, CcyPair.USDJPY, 145.30, 145.35, CcyPair.EURJPY))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cannot exceed ask");
    }

    @Test
    void rejectsArithmeticOverflowOnTheComputedCross() {
        LOGGER.info("Verifying rejection of an out-of-range computed cross");

        assertThatThrownBy(() -> CcyPairCrosser.crossRate(
                CcyPair.EURUSD, Double.MAX_VALUE, Double.MAX_VALUE,
                CcyPair.USDJPY, Double.MAX_VALUE, Double.MAX_VALUE,
                CcyPair.EURJPY))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Calculated cross");
    }

    private static void assertCross(CcyPair pair1, double pair1Bid, double pair1Ask,
                                    CcyPair pair2, double pair2Bid, double pair2Ask,
                                    CcyPair crossPair, double expectedBid, double expectedAsk) {
        double[] result = CcyPairCrosser.crossRate(
                pair1, pair1Bid, pair1Ask, pair2, pair2Bid, pair2Ask, crossPair);
        assertQuote(pair1 + " + " + pair2 + " -> " + crossPair, result, expectedBid, expectedAsk);
    }

    private static void assertQuote(String scenario, double[] result,
                                    double expectedBid, double expectedAsk) {
        LOGGER.info("{} | actual bid={} ask={} | expected bid={} ask={} | spread={}",
                scenario, result[0], result[1], expectedBid, expectedAsk, result[1] - result[0]);
        assertThat(result[0]).isCloseTo(expectedBid, within(1.0e-12));
        assertThat(result[1]).isCloseTo(expectedAsk, within(1.0e-12));
        assertThat(result[0]).isLessThanOrEqualTo(result[1]);
    }

    private static CcyPair.CrossRateFormula expectedFormula(
            CcyPair crossPair, EnumMap<Ccy, CcyPair> usdPairByCcy) {
        CcyPair baseUsdPair = usdPairByCcy.get(crossPair.base());
        CcyPair quoteUsdPair = usdPairByCcy.get(crossPair.quote());
        boolean baseIsCcyUsd = baseUsdPair.base() == crossPair.base();
        boolean quoteIsCcyUsd = quoteUsdPair.base() == crossPair.quote();

        if (baseIsCcyUsd && quoteIsCcyUsd) {
            return CcyPair.CrossRateFormula.DIVIDE_FIRST_BY_SECOND;
        }
        if (baseIsCcyUsd) {
            return CcyPair.CrossRateFormula.MULTIPLY_FIRST_AND_SECOND;
        }
        if (quoteIsCcyUsd) {
            return CcyPair.CrossRateFormula.RECIPROCAL_OF_PAIR_PRODUCT;
        }
        return CcyPair.CrossRateFormula.DIVIDE_SECOND_BY_FIRST;
    }
}
