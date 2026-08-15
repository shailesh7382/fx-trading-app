package com.example.util;

/**
 * Derives the bid/ask of a cross currency pair from two USD-legged pairs.
 * e.g. EURUSD + USDJPY -> EURJPY, or USDJPY + USDCHF -> JPYCHF.
 */
public class CcyPairCrosser {

    private static final String USD = "USD";

    /**
     * @param pair1     first USD-legged pair, e.g. EURUSD
     * @param pair1Bid  bid of pair1
     * @param pair1Ask  ask of pair1
     * @param pair2     second USD-legged pair, e.g. USDJPY
     * @param pair2Bid  bid of pair2
     * @param pair2Ask  ask of pair2
     * @param crossPair the cross pair to derive, e.g. EURJPY
     * @return {bid, ask} of crossPair
     */
    public static double[] crossRate(String pair1, double pair1Bid, double pair1Ask,
                                      String pair2, double pair2Bid, double pair2Ask,
                                      String crossPair) {
        validatePair(pair1);
        validatePair(pair2);
        validateQuote(pair1Bid, pair1Ask);
        validateQuote(pair2Bid, pair2Ask);
        requireUsdLeg(pair1);
        requireUsdLeg(pair2);

        if (crossPair == null || crossPair.length() != 6) {
            throw new IllegalArgumentException("Cross ccy pair must be 6 characters, e.g. EURJPY: " + crossPair);
        }
        crossPair = crossPair.toUpperCase();
        String base = crossPair.substring(0, 3);
        String quote = crossPair.substring(3, 6);
        if (base.equals(quote)) {
            throw new IllegalArgumentException("Base and quote currency cannot be the same: " + crossPair);
        }

        if (base.equals(USD) || quote.equals(USD)) {
            return resolveDirectPair(pair1, pair1Bid, pair1Ask, pair2, pair2Bid, pair2Ask, crossPair, base, quote);
        }

        double[] baseVsUsd = ccyPerUsd(pair1, pair1Bid, pair1Ask, pair2, pair2Bid, pair2Ask, base);
        double[] quoteVsUsd = ccyPerUsd(pair1, pair1Bid, pair1Ask, pair2, pair2Bid, pair2Ask, quote);

        double crossBid = baseVsUsd[0] / quoteVsUsd[1];
        double crossAsk = baseVsUsd[1] / quoteVsUsd[0];

        return new double[]{crossBid, crossAsk};
    }

    private static void validatePair(String pair) {
        if (pair == null || pair.length() != 6) {
            throw new IllegalArgumentException("Ccy pair must be 6 characters, e.g. EURUSD: " + pair);
        }
    }

    private static void validateQuote(double bid, double ask) {
        if (bid <= 0 || ask <= 0) {
            throw new IllegalArgumentException("Bid/ask must be positive: bid=" + bid + " ask=" + ask);
        }
        if (bid > ask) {
            throw new IllegalArgumentException("Bid cannot be greater than ask: bid=" + bid + " ask=" + ask);
        }
    }

    private static void requireUsdLeg(String pair) {
        String base = pair.substring(0, 3).toUpperCase();
        String quote = pair.substring(3, 6).toUpperCase();
        if (!base.equals(USD) && !quote.equals(USD)) {
            throw new IllegalArgumentException("Not a USD pair: " + pair);
        }
    }

    private static double[] resolveDirectPair(String pair1, double pair1Bid, double pair1Ask,
                                               String pair2, double pair2Bid, double pair2Ask,
                                               String crossPair, String base, String quote) {
        String[] pairs = {pair1.toUpperCase(), pair2.toUpperCase()};
        double[] bids = {pair1Bid, pair2Bid};
        double[] asks = {pair1Ask, pair2Ask};

        for (int i = 0; i < pairs.length; i++) {
            String p = pairs[i];
            if (p.equals(crossPair)) {
                return new double[]{bids[i], asks[i]};
            }
            String pBase = p.substring(0, 3);
            String pQuote = p.substring(3, 6);
            if (pBase.equals(quote) && pQuote.equals(base)) {
                return invert(bids[i], asks[i]);
            }
        }
        throw new IllegalArgumentException("Neither input pair matches target " + crossPair);
    }

    /** Returns {bid, ask} of ccy expressed as ccy/USD (i.e. USD value of 1 unit of ccy), found in one of the two legs. */
    private static double[] ccyPerUsd(String pair1, double pair1Bid, double pair1Ask,
                                       String pair2, double pair2Bid, double pair2Ask,
                                       String ccy) {
        String[] pairs = {pair1.toUpperCase(), pair2.toUpperCase()};
        double[] bids = {pair1Bid, pair2Bid};
        double[] asks = {pair1Ask, pair2Ask};

        for (int i = 0; i < pairs.length; i++) {
            String base = pairs[i].substring(0, 3);
            String quote = pairs[i].substring(3, 6);
            if (base.equals(ccy)) {
                // already CCY/USD
                return new double[]{bids[i], asks[i]};
            }
            if (quote.equals(ccy)) {
                // USD/CCY -> invert to CCY/USD
                return invert(bids[i], asks[i]);
            }
        }
        throw new IllegalArgumentException("No input pair contains currency " + ccy);
    }

    private static double[] invert(double bid, double ask) {
        return new double[]{1.0 / ask, 1.0 / bid};
    }

    public static void main(String[] args) {
        System.out.println("=== Scenario 1: EURUSD + USDJPY -> EURJPY (mixed direction legs) ===");
        run("EURUSD", 1.0850, 1.0852, "USDJPY", 145.30, 145.35, "EURJPY");

        System.out.println("\n=== Scenario 2: EURUSD + GBPUSD -> EURGBP (both USD as quote) ===");
        run("EURUSD", 1.0850, 1.0852, "GBPUSD", 1.2650, 1.2653, "EURGBP");

        System.out.println("\n=== Scenario 3: USDJPY + USDCHF -> JPYCHF (both USD as base) ===");
        run("USDJPY", 145.30, 145.35, "USDCHF", 0.8810, 0.8813, "JPYCHF");

        System.out.println("\n=== Scenario 4: USDCAD + AUDUSD -> AUDCAD (mixed direction legs) ===");
        run("USDCAD", 1.3720, 1.3724, "AUDUSD", 0.6510, 0.6513, "AUDCAD");

        System.out.println("\n=== Scenario 5: inverse cross target -> GBPEUR (reverse of scenario 2) ===");
        run("EURUSD", 1.0850, 1.0852, "GBPUSD", 1.2650, 1.2653, "GBPEUR");

        System.out.println("\n=== Scenario 6: target pair equals an input pair directly -> EURUSD ===");
        run("EURUSD", 1.0850, 1.0852, "USDJPY", 145.30, 145.35, "EURUSD");

        System.out.println("\n=== Scenario 7: target pair is inverse of an input pair -> USDEUR ===");
        run("EURUSD", 1.0850, 1.0852, "USDJPY", 145.30, 145.35, "USDEUR");

        System.out.println("\n=== Scenario 8: order of legs swapped, same result expected -> EURJPY ===");
        run("USDJPY", 145.30, 145.35, "EURUSD", 1.0850, 1.0852, "EURJPY");

        System.out.println("\n=== Scenario 9 (error): currencies don't match either leg -> GBPCHF ===");
        run("EURUSD", 1.0850, 1.0852, "USDJPY", 145.30, 145.35, "GBPCHF");

        System.out.println("\n=== Scenario 10 (error): input leg is not a USD pair ===");
        run("EURGBP", 0.8560, 0.8563, "USDJPY", 145.30, 145.35, "EURJPY");

        System.out.println("\n=== Scenario 11 (error): target base equals target quote -> EUREUR ===");
        run("EURUSD", 1.0850, 1.0852, "USDJPY", 145.30, 145.35, "EUREUR");

        System.out.println("\n=== Scenario 12 (error): malformed target pair length ===");
        run("EURUSD", 1.0850, 1.0852, "USDJPY", 145.30, 145.35, "EURJP");

        System.out.println("\n=== Scenario 13: USDJPY + USDSGD -> JPYSGD (both USD as base) ===");
        run("USDJPY", 145.30, 145.35, "USDSGD", 1.3400, 1.3403, "JPYSGD");
    }

    private static void run(String pair1, double pair1Bid, double pair1Ask,
                             String pair2, double pair2Bid, double pair2Ask,
                             String crossPair) {
        System.out.printf("Input 1: %s bid=%.6f ask=%.6f%n", pair1, pair1Bid, pair1Ask);
        System.out.printf("Input 2: %s bid=%.6f ask=%.6f%n", pair2, pair2Bid, pair2Ask);
        System.out.println("Target : " + crossPair);
        try {
            double[] result = crossRate(pair1, pair1Bid, pair1Ask, pair2, pair2Bid, pair2Ask, crossPair);
            System.out.printf("Result : %s bid=%.6f ask=%.6f%n", crossPair, result[0], result[1]);
        } catch (IllegalArgumentException e) {
            System.out.println("Error  : " + e.getMessage());
        }
    }
}
