package com.example.util;

import java.lang.management.ManagementFactory;
import java.util.Arrays;
import java.util.Locale;

/**
 * Lightweight, dependency-free microbenchmark for local regression checks.
 *
 * <p>This is deliberately outside the unit-test lifecycle because wall-clock assertions are
 * machine-dependent. Use JMH for publication-grade benchmark results.</p>
 */
public final class CcyPairCrosserMicroHarness {

    private static final int DEFAULT_OPERATIONS = 500_000;
    private static final int DEFAULT_WARMUP_ROUNDS = 4;
    private static final int DEFAULT_MEASUREMENT_ROUNDS = 7;
    private static final int ESCAPE_RING_SIZE = 1_024;

    private static final CcyPairCrosser.CrossRateCalculator CALCULATOR =
            CcyPairCrosser.calculatorFor(CcyPair.EURUSD, CcyPair.USDJPY, CcyPair.EURJPY);
    private static final double[] CHECKED_RESULT = new double[2];
    private static final double[] UNCHECKED_RESULT = new double[2];
    private static final double[] ENUM_LOOKUP_RESULT = new double[2];
    private static final double[] STRING_LOOKUP_RESULT = new double[2];
    private static final double[][] ESCAPED_RESULTS = new double[ESCAPE_RING_SIZE][];
    private static final com.sun.management.ThreadMXBean ALLOCATION_BEAN = allocationBean();

    private static volatile double blackHole;

    private CcyPairCrosserMicroHarness() {
    }

    public static void main(String[] args) {
        int operations = positiveArgument(args, 0, DEFAULT_OPERATIONS, "operations");
        int warmupRounds = positiveArgument(args, 1, DEFAULT_WARMUP_ROUNDS, "warmup rounds");
        int measurementRounds = positiveArgument(
                args, 2, DEFAULT_MEASUREMENT_ROUNDS, "measurement rounds");

        printConfiguration(operations, warmupRounds, measurementRounds);
        warmUp(operations, warmupRounds);

        BenchmarkResult checked = measure(
                "retained checked calculator",
                operations, measurementRounds,
                CcyPairCrosserMicroHarness::runChecked);
        BenchmarkResult unchecked = measure(
                "retained unchecked calculator",
                operations, measurementRounds,
                CcyPairCrosserMicroHarness::runUnchecked);
        BenchmarkResult enumCachedLookup = measure(
                "enum cached lookup, reused result",
                operations, measurementRounds,
                CcyPairCrosserMicroHarness::runEnumCachedLookup);
        BenchmarkResult stringCachedLookup = measure(
                "string adapter lookup, reused result",
                operations, measurementRounds,
                CcyPairCrosserMicroHarness::runStringCachedLookup);
        BenchmarkResult oneShotConsumed = measure(
                "enum one-shot, locally consumed",
                operations, measurementRounds,
                CcyPairCrosserMicroHarness::runOneShotConsumed);
        BenchmarkResult oneShotEscaping = measure(
                "enum one-shot, escaping result",
                operations, measurementRounds,
                CcyPairCrosserMicroHarness::runOneShotEscaping);

        verifyEquivalentChecksums(
                checked, unchecked, enumCachedLookup, stringCachedLookup,
                oneShotConsumed, oneShotEscaping);
        printHeader();
        printResult(checked);
        printResult(unchecked);
        printResult(enumCachedLookup);
        printResult(stringCachedLookup);
        printResult(oneShotConsumed);
        printResult(oneShotEscaping);
        System.out.printf(Locale.ROOT, "%nblack-hole checksum: %.6f%n", blackHole);
        System.out.println("Treat results as local regression signals; use JMH for formal comparisons.");
    }

    private static void warmUp(int operations, int rounds) {
        System.out.println("warming up...");
        for (int round = 0; round < rounds; round++) {
            blackHole = runChecked(operations);
            blackHole = runUnchecked(operations);
            blackHole = runEnumCachedLookup(operations);
            blackHole = runStringCachedLookup(operations);
            blackHole = runOneShotConsumed(operations);
            blackHole = runOneShotEscaping(operations);
        }
    }

    private static BenchmarkResult measure(String name, int operations, int rounds,
                                           BenchmarkScenario scenario) {
        long[] elapsedNanos = new long[rounds];
        long[] allocatedBytes = ALLOCATION_BEAN == null ? null : new long[rounds];
        double checksum = 0.0d;

        for (int round = 0; round < rounds; round++) {
            long allocatedBefore = currentThreadAllocatedBytes();
            long startedAt = System.nanoTime();
            checksum = scenario.run(operations);
            elapsedNanos[round] = System.nanoTime() - startedAt;
            long allocatedAfter = currentThreadAllocatedBytes();
            if (allocatedBytes != null) {
                allocatedBytes[round] = allocatedAfter - allocatedBefore;
            }
            blackHole = checksum;
        }

        Arrays.sort(elapsedNanos);
        if (allocatedBytes != null) {
            Arrays.sort(allocatedBytes);
        }
        return new BenchmarkResult(
                name,
                elapsedNanos[rounds / 2] / (double) operations,
                elapsedNanos[0] / (double) operations,
                allocatedBytes == null ? Double.NaN : allocatedBytes[rounds / 2] / (double) operations,
                checksum);
    }

    private static double runChecked(int operations) {
        double checksum = 0.0d;
        for (int operation = 0; operation < operations; operation++) {
            double shift = (operation & 1_023) * 1.0e-9d;
            double pair1Bid = 1.0850d + shift;
            double pair1Ask = pair1Bid + 0.0002d;
            double pair2Bid = 145.30d + shift;
            double pair2Ask = pair2Bid + 0.05d;
            CALCULATOR.crossRate(pair1Bid, pair1Ask, pair2Bid, pair2Ask, CHECKED_RESULT);
            checksum += CHECKED_RESULT[0] + CHECKED_RESULT[1];
        }
        return checksum;
    }

    private static double runUnchecked(int operations) {
        double checksum = 0.0d;
        for (int operation = 0; operation < operations; operation++) {
            double shift = (operation & 1_023) * 1.0e-9d;
            double pair1Bid = 1.0850d + shift;
            double pair1Ask = pair1Bid + 0.0002d;
            double pair2Bid = 145.30d + shift;
            double pair2Ask = pair2Bid + 0.05d;
            CALCULATOR.crossRateUnchecked(
                    pair1Bid, pair1Ask, pair2Bid, pair2Ask, UNCHECKED_RESULT);
            checksum += UNCHECKED_RESULT[0] + UNCHECKED_RESULT[1];
        }
        return checksum;
    }

    private static double runOneShotConsumed(int operations) {
        double checksum = 0.0d;
        for (int operation = 0; operation < operations; operation++) {
            double shift = (operation & 1_023) * 1.0e-9d;
            double pair1Bid = 1.0850d + shift;
            double pair1Ask = pair1Bid + 0.0002d;
            double pair2Bid = 145.30d + shift;
            double pair2Ask = pair2Bid + 0.05d;
            double[] result = CcyPairCrosser.crossRate(
                    CcyPair.EURUSD, pair1Bid, pair1Ask,
                    CcyPair.USDJPY, pair2Bid, pair2Ask,
                    CcyPair.EURJPY);
            checksum += result[0] + result[1];
        }
        return checksum;
    }

    private static double runEnumCachedLookup(int operations) {
        double checksum = 0.0d;
        for (int operation = 0; operation < operations; operation++) {
            double shift = (operation & 1_023) * 1.0e-9d;
            double pair1Bid = 1.0850d + shift;
            double pair1Ask = pair1Bid + 0.0002d;
            double pair2Bid = 145.30d + shift;
            double pair2Ask = pair2Bid + 0.05d;
            CcyPairCrosser.CrossRateCalculator calculator = CcyPairCrosser.calculatorFor(
                    CcyPair.EURUSD, CcyPair.USDJPY, CcyPair.EURJPY);
            calculator.crossRateUnchecked(
                    pair1Bid, pair1Ask, pair2Bid, pair2Ask, ENUM_LOOKUP_RESULT);
            checksum += ENUM_LOOKUP_RESULT[0] + ENUM_LOOKUP_RESULT[1];
        }
        return checksum;
    }

    private static double runStringCachedLookup(int operations) {
        double checksum = 0.0d;
        for (int operation = 0; operation < operations; operation++) {
            double shift = (operation & 1_023) * 1.0e-9d;
            double pair1Bid = 1.0850d + shift;
            double pair1Ask = pair1Bid + 0.0002d;
            double pair2Bid = 145.30d + shift;
            double pair2Ask = pair2Bid + 0.05d;
            CcyPairCrosser.CrossRateCalculator calculator = CcyPairCrosser.calculatorFor(
                    "EURUSD", "USDJPY", "EURJPY");
            calculator.crossRateUnchecked(
                    pair1Bid, pair1Ask, pair2Bid, pair2Ask, STRING_LOOKUP_RESULT);
            checksum += STRING_LOOKUP_RESULT[0] + STRING_LOOKUP_RESULT[1];
        }
        return checksum;
    }

    private static double runOneShotEscaping(int operations) {
        double checksum = 0.0d;
        for (int operation = 0; operation < operations; operation++) {
            double shift = (operation & 1_023) * 1.0e-9d;
            double pair1Bid = 1.0850d + shift;
            double pair1Ask = pair1Bid + 0.0002d;
            double pair2Bid = 145.30d + shift;
            double pair2Ask = pair2Bid + 0.05d;
            double[] result = CcyPairCrosser.crossRate(
                    CcyPair.EURUSD, pair1Bid, pair1Ask,
                    CcyPair.USDJPY, pair2Bid, pair2Ask,
                    CcyPair.EURJPY);
            ESCAPED_RESULTS[operation & (ESCAPE_RING_SIZE - 1)] = result;
            checksum += result[0] + result[1];
        }
        return checksum;
    }

    private static int positiveArgument(String[] args, int index, int defaultValue, String name) {
        if (args.length <= index) {
            return defaultValue;
        }
        int value;
        try {
            value = Integer.parseInt(args[index]);
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException(name + " must be an integer: " + args[index], exception);
        }
        if (value <= 0) {
            throw new IllegalArgumentException(name + " must be positive: " + value);
        }
        return value;
    }

    private static void printConfiguration(int operations, int warmupRounds, int measurementRounds) {
        System.out.println("CcyPairCrosser micro-harness");
        System.out.println("java: " + System.getProperty("java.vm.name")
                + " " + System.getProperty("java.runtime.version"));
        System.out.printf(Locale.ROOT,
                "operations/round: %,d | warmup rounds: %d | measurement rounds: %d%n",
                operations, warmupRounds, measurementRounds);
        System.out.println("thread allocation metrics: "
                + (ALLOCATION_BEAN == null ? "unavailable" : "available"));
    }

    private static void printHeader() {
        System.out.printf(Locale.ROOT, "%n%-38s %12s %12s %14s %14s%n",
                "scenario", "median ns/op", "best ns/op", "ops/second", "bytes/op");
        System.out.println("-".repeat(96));
    }

    private static void printResult(BenchmarkResult result) {
        String bytesPerOperation = Double.isNaN(result.bytesPerOperation)
                ? "n/a"
                : String.format(Locale.ROOT, "%.2f", result.bytesPerOperation);
        System.out.printf(Locale.ROOT, "%-38s %,12.2f %,12.2f %,14.0f %14s%n",
                result.name,
                result.medianNanosPerOperation,
                result.bestNanosPerOperation,
                1_000_000_000.0d / result.medianNanosPerOperation,
                bytesPerOperation);
    }

    private static void verifyEquivalentChecksums(BenchmarkResult reference,
                                                   BenchmarkResult... comparisons) {
        double tolerance = Math.abs(reference.checksum) * 1.0e-12d;
        for (BenchmarkResult comparison : comparisons) {
            if (Math.abs(reference.checksum - comparison.checksum) > tolerance) {
                throw new AssertionError("Benchmark scenarios produced different results: "
                        + reference.name + "=" + reference.checksum + ", "
                        + comparison.name + "=" + comparison.checksum);
            }
        }
    }

    private static com.sun.management.ThreadMXBean allocationBean() {
        java.lang.management.ThreadMXBean platformBean = ManagementFactory.getThreadMXBean();
        if (!(platformBean instanceof com.sun.management.ThreadMXBean)) {
            return null;
        }
        com.sun.management.ThreadMXBean bean = (com.sun.management.ThreadMXBean) platformBean;
        if (!bean.isThreadAllocatedMemorySupported()) {
            return null;
        }
        try {
            if (!bean.isThreadAllocatedMemoryEnabled()) {
                bean.setThreadAllocatedMemoryEnabled(true);
            }
        } catch (SecurityException | UnsupportedOperationException exception) {
            return null;
        }
        return bean;
    }

    @SuppressWarnings("deprecation")
    private static long currentThreadAllocatedBytes() {
        return ALLOCATION_BEAN == null
                ? 0L
                : ALLOCATION_BEAN.getThreadAllocatedBytes(Thread.currentThread().getId());
    }

    @FunctionalInterface
    private interface BenchmarkScenario {
        double run(int operations);
    }

    private static final class BenchmarkResult {
        private final String name;
        private final double medianNanosPerOperation;
        private final double bestNanosPerOperation;
        private final double bytesPerOperation;
        private final double checksum;

        private BenchmarkResult(String name,
                                double medianNanosPerOperation,
                                double bestNanosPerOperation,
                                double bytesPerOperation,
                                double checksum) {
            this.name = name;
            this.medianNanosPerOperation = medianNanosPerOperation;
            this.bestNanosPerOperation = bestNanosPerOperation;
            this.bytesPerOperation = bytesPerOperation;
            this.checksum = checksum;
        }
    }
}
