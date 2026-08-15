package com.example.util;

/**
 * Derives an executable bid/ask for a currency pair from two USD-legged pairs.
 *
 * <p>For a high-frequency price stream, call {@link #compile(String, String, String)} once
 * per instrument and reuse the returned immutable route. The compiled API performs no
 * allocation on a successful call when the caller supplies a reusable result array.
 * Quote snapshot consistency and staleness checks remain the caller's responsibility.</p>
 */
public final class CcyPairCrosser {

    private static final int USD = ('U' << 16) | ('S' << 8) | 'D';

    private static final byte COPY_PAIR_1 = 0;
    private static final byte INVERT_PAIR_1 = 1;
    private static final byte COPY_PAIR_2 = 2;
    private static final byte INVERT_PAIR_2 = 3;
    private static final byte PAIR_1_OVER_PAIR_2 = 4;
    private static final byte PAIR_1_TIMES_PAIR_2 = 5;
    private static final byte ONE_OVER_PAIR_1_PAIR_2 = 6;
    private static final byte PAIR_2_OVER_PAIR_1 = 7;

    private static final byte USD_SOURCE = 0;
    private static final byte PAIR_1_DIRECT = 1;
    private static final byte PAIR_1_INVERTED = 2;
    private static final byte PAIR_2_DIRECT = 3;
    private static final byte PAIR_2_INVERTED = 4;

    private CcyPairCrosser() {
    }

    /**
     * Compatibility API for one-off calculations. Streaming callers should cache a
     * {@link CompiledCross} instead of parsing the pair symbols on every tick.
     *
     * @return a newly allocated {@code {bid, ask}} array
     */
    public static double[] crossRate(String pair1, double pair1Bid, double pair1Ask,
                                     String pair2, double pair2Bid, double pair2Ask,
                                     String crossPair) {
        return compile(pair1, pair2, crossPair)
                .crossRate(pair1Bid, pair1Ask, pair2Bid, pair2Ask);
    }

    /**
     * Parses and validates the instrument topology once, outside the pricing hot path.
     * Input pairs must contain exactly one USD leg and must represent distinct non-USD
     * currencies. Pair symbols are ASCII case-insensitive.
     */
    public static CompiledCross compile(String pair1, String pair2, String crossPair) {
        long encodedPair1 = encodeUsdPair(pair1, "pair1");
        long encodedPair2 = encodeUsdPair(pair2, "pair2");
        long encodedCross = encodeCrossPair(crossPair);

        int pair1Base = baseOf(encodedPair1);
        int pair1Quote = quoteOf(encodedPair1);
        int pair2Base = baseOf(encodedPair2);
        int pair2Quote = quoteOf(encodedPair2);
        int pair1Currency = pair1Base == USD ? pair1Quote : pair1Base;
        int pair2Currency = pair2Base == USD ? pair2Quote : pair2Base;

        if (pair1Currency == pair2Currency) {
            throw new IllegalArgumentException("Input pairs must have distinct non-USD currencies: "
                    + pair1 + ", " + pair2);
        }

        byte baseSource = findSource(baseOf(encodedCross), pair1Base, pair1Quote, pair2Base, pair2Quote);
        byte quoteSource = findSource(quoteOf(encodedCross), pair1Base, pair1Quote, pair2Base, pair2Quote);
        return new CompiledCross(resolveOperation(baseSource, quoteSource));
    }

    /**
     * Immutable, thread-safe calculation route. The object contains no mutable quote state.
     */
    public static final class CompiledCross {

        private final byte operation;

        private CompiledCross(byte operation) {
            this.operation = operation;
        }

        /**
         * Validates both input quotes and returns a newly allocated {@code {bid, ask}} array.
         */
        public double[] crossRate(double pair1Bid, double pair1Ask,
                                  double pair2Bid, double pair2Ask) {
            double[] result = new double[2];
            crossRate(pair1Bid, pair1Ask, pair2Bid, pair2Ask, result);
            return result;
        }

        /**
         * Validates both input quotes and writes into a caller-owned array of length at least two.
         * This method does not allocate on successful calls.
         */
        public void crossRate(double pair1Bid, double pair1Ask,
                              double pair2Bid, double pair2Ask,
                              double[] result) {
            validateDestination(result);
            validateQuote(pair1Bid, pair1Ask, "pair1");
            validateQuote(pair2Bid, pair2Ask, "pair2");
            calculate(pair1Bid, pair1Ask, pair2Bid, pair2Ask, result, true);
        }

        /**
         * Allocation-free calculation for feeds that already guarantee finite, positive,
         * non-crossed quotes. Invalid inputs produce undefined output. The result array must
         * have length at least two and must not be shared concurrently by callers.
         */
        public void crossRateUnchecked(double pair1Bid, double pair1Ask,
                                       double pair2Bid, double pair2Ask,
                                       double[] result) {
            calculate(pair1Bid, pair1Ask, pair2Bid, pair2Ask, result, false);
        }

        private void calculate(double pair1Bid, double pair1Ask,
                               double pair2Bid, double pair2Ask,
                               double[] result, boolean validateResult) {
            switch (operation) {
                case COPY_PAIR_1:
                    writeResult(result, pair1Bid, pair1Ask, validateResult);
                    return;
                case INVERT_PAIR_1:
                    writeResult(result, 1.0d / pair1Ask, 1.0d / pair1Bid, validateResult);
                    return;
                case COPY_PAIR_2:
                    writeResult(result, pair2Bid, pair2Ask, validateResult);
                    return;
                case INVERT_PAIR_2:
                    writeResult(result, 1.0d / pair2Ask, 1.0d / pair2Bid, validateResult);
                    return;
                case PAIR_1_OVER_PAIR_2:
                    writeResult(result, pair1Bid / pair2Ask, pair1Ask / pair2Bid, validateResult);
                    return;
                case PAIR_1_TIMES_PAIR_2:
                    writeResult(result, pair1Bid * pair2Bid, pair1Ask * pair2Ask, validateResult);
                    return;
                case ONE_OVER_PAIR_1_PAIR_2:
                    writeResult(result, 1.0d / (pair1Ask * pair2Ask),
                            1.0d / (pair1Bid * pair2Bid), validateResult);
                    return;
                case PAIR_2_OVER_PAIR_1:
                    writeResult(result, pair2Bid / pair1Ask, pair2Ask / pair1Bid, validateResult);
                    return;
                default:
                    throw new AssertionError("Unknown cross-rate operation: " + operation);
            }
        }
    }

    private static long encodeUsdPair(String pair, String argumentName) {
        long encoded = encodePair(pair, argumentName);
        int base = baseOf(encoded);
        int quote = quoteOf(encoded);
        if ((base == USD) == (quote == USD)) {
            throw new IllegalArgumentException(argumentName
                    + " must contain exactly one USD leg: " + pair);
        }
        return encoded;
    }

    private static long encodeCrossPair(String pair) {
        long encoded = encodePair(pair, "crossPair");
        if (baseOf(encoded) == quoteOf(encoded)) {
            throw new IllegalArgumentException("Cross pair base and quote must differ: " + pair);
        }
        return encoded;
    }

    private static long encodePair(String pair, String argumentName) {
        if (pair == null || pair.length() != 6) {
            throw new IllegalArgumentException(argumentName
                    + " must be a six-letter currency pair, e.g. EURUSD: " + pair);
        }
        int base = encodeCurrency(pair, 0, argumentName);
        int quote = encodeCurrency(pair, 3, argumentName);
        return ((long) base << 32) | (quote & 0xffffffffL);
    }

    private static int encodeCurrency(String pair, int offset, String argumentName) {
        int encoded = 0;
        for (int index = offset; index < offset + 3; index++) {
            char character = pair.charAt(index);
            if (character >= 'a' && character <= 'z') {
                character = (char) (character - ('a' - 'A'));
            }
            if (character < 'A' || character > 'Z') {
                throw new IllegalArgumentException(argumentName
                        + " must contain ASCII letters only: " + pair);
            }
            encoded = (encoded << 8) | character;
        }
        return encoded;
    }

    private static int baseOf(long encodedPair) {
        return (int) (encodedPair >>> 32);
    }

    private static int quoteOf(long encodedPair) {
        return (int) encodedPair;
    }

    private static byte findSource(int currency,
                                   int pair1Base, int pair1Quote,
                                   int pair2Base, int pair2Quote) {
        if (currency == USD) {
            return USD_SOURCE;
        }
        if (currency == pair1Base) {
            return PAIR_1_DIRECT;
        }
        if (currency == pair1Quote) {
            return PAIR_1_INVERTED;
        }
        if (currency == pair2Base) {
            return PAIR_2_DIRECT;
        }
        if (currency == pair2Quote) {
            return PAIR_2_INVERTED;
        }
        throw new IllegalArgumentException("No input pair contains currency " + decodeCurrency(currency));
    }

    private static byte resolveOperation(byte baseSource, byte quoteSource) {
        if (baseSource == USD_SOURCE) {
            switch (quoteSource) {
                case PAIR_1_DIRECT:
                    return INVERT_PAIR_1;
                case PAIR_1_INVERTED:
                    return COPY_PAIR_1;
                case PAIR_2_DIRECT:
                    return INVERT_PAIR_2;
                case PAIR_2_INVERTED:
                    return COPY_PAIR_2;
                default:
                    throw new AssertionError("Invalid USD-base route");
            }
        }
        if (quoteSource == USD_SOURCE) {
            switch (baseSource) {
                case PAIR_1_DIRECT:
                    return COPY_PAIR_1;
                case PAIR_1_INVERTED:
                    return INVERT_PAIR_1;
                case PAIR_2_DIRECT:
                    return COPY_PAIR_2;
                case PAIR_2_INVERTED:
                    return INVERT_PAIR_2;
                default:
                    throw new AssertionError("Invalid USD-quote route");
            }
        }

        if (baseSource == PAIR_1_DIRECT && quoteSource == PAIR_2_DIRECT) {
            return PAIR_1_OVER_PAIR_2;
        }
        if (baseSource == PAIR_1_DIRECT && quoteSource == PAIR_2_INVERTED) {
            return PAIR_1_TIMES_PAIR_2;
        }
        if (baseSource == PAIR_1_INVERTED && quoteSource == PAIR_2_DIRECT) {
            return ONE_OVER_PAIR_1_PAIR_2;
        }
        if (baseSource == PAIR_1_INVERTED && quoteSource == PAIR_2_INVERTED) {
            return PAIR_2_OVER_PAIR_1;
        }
        if (baseSource == PAIR_2_DIRECT && quoteSource == PAIR_1_DIRECT) {
            return PAIR_2_OVER_PAIR_1;
        }
        if (baseSource == PAIR_2_DIRECT && quoteSource == PAIR_1_INVERTED) {
            return PAIR_1_TIMES_PAIR_2;
        }
        if (baseSource == PAIR_2_INVERTED && quoteSource == PAIR_1_DIRECT) {
            return ONE_OVER_PAIR_1_PAIR_2;
        }
        if (baseSource == PAIR_2_INVERTED && quoteSource == PAIR_1_INVERTED) {
            return PAIR_1_OVER_PAIR_2;
        }
        throw new AssertionError("Input currencies do not form a valid cross route");
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

    private static String decodeCurrency(int currency) {
        return new String(new char[]{
                (char) ((currency >>> 16) & 0xff),
                (char) ((currency >>> 8) & 0xff),
                (char) (currency & 0xff)
        });
    }
}
