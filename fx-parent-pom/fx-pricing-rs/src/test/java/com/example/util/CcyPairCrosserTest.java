package com.example.util;

import java.util.EnumMap;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.IntStream;

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
    }

    @Test
    void producesTheSameCrossWhenInputLegsAreSwapped() {
        CcyPairCrosser.CrossRateCalculator calculator = CcyPairCrosser.calculatorFor(
                CcyPair.USDJPY, CcyPair.EURUSD, CcyPair.EURJPY);

        double[] result = calculator.crossRate(145.30, 145.35, 1.0850, 1.0852);

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
        CcyPairCrosser.CrossRateCalculator eurUsd = CcyPairCrosser.calculatorFor(
                CcyPair.EURUSD, CcyPair.USDJPY, CcyPair.EURUSD);
        CcyPairCrosser.CrossRateCalculator usdJpy = CcyPairCrosser.calculatorFor(
                CcyPair.EURUSD, CcyPair.USDJPY, CcyPair.USDJPY);

        assertQuote("direct EURUSD", eurUsd.crossRate(1.0850, 1.0852, 145.30, 145.35),
                1.0850, 1.0852);
        assertQuote("direct USDJPY", usdJpy.crossRate(1.0850, 1.0852, 145.30, 145.35),
                145.30, 145.35);
    }

    @Test
    void reusesCallerOwnedStorageOnTheCheckedAndUncheckedHotPaths() {
        CcyPairCrosser.CrossRateCalculator calculator = CcyPairCrosser.calculatorFor(
                CcyPair.EURUSD, CcyPair.USDJPY, CcyPair.EURJPY);
        double[] result = {-1.0, -1.0};

        calculator.crossRate(1.0850, 1.0852, 145.30, 145.35, result);
        assertQuote("checked reusable result", result,
                1.0850 * 145.30, 1.0852 * 145.35);

        calculator.crossRateUnchecked(1.0860, 1.0862, 145.40, 145.45, result);
        assertQuote("unchecked reusable result", result,
                1.0860 * 145.40, 1.0862 * 145.45);
    }

    @Test
    void stringAdapterAcceptsExactUppercaseSymbolsWithoutCaseNormalization() {
        double[] result = CcyPairCrosser.crossRate(
                "EURUSD", 1.0850, 1.0852,
                "USDJPY", 145.30, 145.35,
                "EURJPY");

        assertQuote("uppercase string adapter", result,
                1.0850 * 145.30, 1.0852 * 145.35);
        assertThatThrownBy(() -> CcyPairCrosser.calculatorFor(
                "eurusd", "USDJPY", "EURJPY"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> CcyPairCrosser.calculatorFor(
                "USDEUR", "USDJPY", "EURJPY"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void cachesCalculatorByOrderedEnumCombination() {
        CcyPairCrosser.CrossRateCalculator first = CcyPairCrosser.calculatorFor(
                CcyPair.EURUSD, CcyPair.USDJPY, CcyPair.EURJPY);
        CcyPairCrosser.CrossRateCalculator repeated = CcyPairCrosser.calculatorFor(
                CcyPair.EURUSD, CcyPair.USDJPY, CcyPair.EURJPY);
        CcyPairCrosser.CrossRateCalculator stringAdapter = CcyPairCrosser.calculatorFor(
                "EURUSD", "USDJPY", "EURJPY");
        CcyPairCrosser.CrossRateCalculator reversedInputs = CcyPairCrosser.calculatorFor(
                CcyPair.USDJPY, CcyPair.EURUSD, CcyPair.EURJPY);

        LOGGER.info("Calculator cache identities | first={} repeated={} adapter={} reversed={}",
                System.identityHashCode(first),
                System.identityHashCode(repeated),
                System.identityHashCode(stringAdapter),
                System.identityHashCode(reversedInputs));
        assertThat(repeated).isSameAs(first);
        assertThat(stringAdapter).isSameAs(first);
        assertThat(reversedInputs).isNotSameAs(first);
    }

    @Test
    void publishesOneSharedCalculatorDuringConcurrentFirstLookup() {
        Set<CcyPairCrosser.CrossRateCalculator> calculators = ConcurrentHashMap.newKeySet();

        IntStream.range(0, 1_000).parallel().forEach(ignored -> calculators.add(
                CcyPairCrosser.calculatorFor(
                        CcyPair.XAUUSD, CcyPair.USDSGD, CcyPair.XAUSGD)));

        LOGGER.info("Concurrent first lookup returned {} unique calculator instance(s)",
                calculators.size());
        assertThat(calculators).hasSize(1);
    }

    @Test
    void rejectsUnsupportedOrAmbiguousInstrumentTopologyDuringCalculatorLookup() {
        LOGGER.info("Verifying lookup-time rejection of unsupported and ambiguous currency routes");

        assertThatThrownBy(() -> CcyPairCrosser.calculatorFor(
                null, CcyPair.USDJPY, CcyPair.EURJPY))
                .isInstanceOf(NullPointerException.class)
                .hasMessageContaining("firstUsdPair");
        assertThatThrownBy(() -> CcyPairCrosser.calculatorFor("EURUS1", "USDJPY", "EURJPY"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("No enum constant");
        assertThatThrownBy(() -> CcyPairCrosser.calculatorFor(
                CcyPair.EURGBP, CcyPair.USDJPY, CcyPair.EURJPY))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("must be a USD leg");
        assertThatThrownBy(() -> CcyPairCrosser.calculatorFor("USDUSD", "USDJPY", "EURJPY"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("No enum constant");
        assertThatThrownBy(() -> CcyPairCrosser.calculatorFor(
                CcyPair.EURUSD, CcyPair.EURUSD, CcyPair.EURUSD))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("distinct non-USD currencies");
        assertThatThrownBy(() -> CcyPairCrosser.calculatorFor(
                CcyPair.EURUSD, CcyPair.USDJPY, CcyPair.GBPCHF))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("currency GBP");
        assertThatThrownBy(() -> CcyPairCrosser.calculatorFor("EURUSD", "USDJPY", "EUREUR"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("No enum constant");
    }

    @Test
    void rejectsNonFiniteNonPositiveAndCrossedQuotes() {
        CcyPairCrosser.CrossRateCalculator calculator = CcyPairCrosser.calculatorFor(
                CcyPair.EURUSD, CcyPair.USDJPY, CcyPair.EURJPY);
        LOGGER.info("Verifying runtime rejection of NaN, infinity, zero, and crossed quotes");

        assertThatThrownBy(() -> calculator.crossRate(Double.NaN, 1.1, 145.30, 145.35))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("finite and positive");
        assertThatThrownBy(() -> calculator.crossRate(1.0, Double.POSITIVE_INFINITY, 145.30, 145.35))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("finite and positive");
        assertThatThrownBy(() -> calculator.crossRate(0.0, 1.1, 145.30, 145.35))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("finite and positive");
        assertThatThrownBy(() -> calculator.crossRate(1.2, 1.1, 145.30, 145.35))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cannot exceed ask");
    }

    @Test
    void rejectsInvalidDestinationAndArithmeticOverflowWithoutPublishingAResult() {
        CcyPairCrosser.CrossRateCalculator calculator = CcyPairCrosser.calculatorFor(
                CcyPair.EURUSD, CcyPair.USDJPY, CcyPair.EURJPY);
        LOGGER.info("Verifying destination bounds and fail-before-publish overflow behavior");

        assertThatThrownBy(() -> calculator.crossRate(1.0, 1.1, 145.30, 145.35, new double[1]))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("length at least two");

        double[] result = {7.0, 8.0};
        assertThatThrownBy(() -> calculator.crossRate(
                Double.MAX_VALUE, Double.MAX_VALUE,
                Double.MAX_VALUE, Double.MAX_VALUE,
                result))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Calculated cross");
        assertThat(result).containsExactly(7.0, 8.0);
    }

    private static void assertCross(CcyPair pair1, double pair1Bid, double pair1Ask,
                                    CcyPair pair2, double pair2Bid, double pair2Ask,
                                    CcyPair crossPair, double expectedBid, double expectedAsk) {
        CcyPairCrosser.CrossRateCalculator calculator =
                CcyPairCrosser.calculatorFor(pair1, pair2, crossPair);
        assertQuote(pair1 + " + " + pair2 + " -> " + crossPair,
                calculator.crossRate(pair1Bid, pair1Ask, pair2Bid, pair2Ask),
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
