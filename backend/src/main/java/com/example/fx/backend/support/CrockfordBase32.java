package com.example.fx.backend.support;

/**
 * Crockford base32 — digits and upper-case letters with I, L, O and U removed.
 *
 * <p>Identifiers built from this alphabet survive being read aloud on a support call
 * and retyped from a screenshot: the 0/O and 1/I confusions are not in the character
 * set to begin with.
 *
 * <p>Thirty-two symbols is a power of two, so encoding is a shift rather than a
 * division and a random byte masks to an index with no modulo bias.
 */
public final class CrockfordBase32 {

    public static final String ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

    /** Bits carried by one symbol. */
    public static final int SYMBOL_BITS = 5;

    /** Mask selecting one symbol's worth of bits. */
    public static final int SYMBOL_MASK = (1 << SYMBOL_BITS) - 1;

    static {
        if (ALPHABET.length() != SYMBOL_MASK + 1) {
            throw new ExceptionInInitializerError(
                    "ALPHABET must hold exactly " + (SYMBOL_MASK + 1) + " symbols, was " + ALPHABET.length());
        }
    }

    private CrockfordBase32() {
    }

    /** Largest value that fits in {@code symbols} symbols, exclusive. */
    public static long capacity(int symbols) {
        return 1L << (SYMBOL_BITS * symbols);
    }

    /**
     * Encodes a non-negative value into exactly {@code symbols} characters, most
     * significant first and zero-padded, so encoded values sort in numeric order.
     */
    public static void encodeInto(long value, char[] target, int offset, int symbols) {
        for (int position = offset + symbols - 1; position >= offset; position--) {
            target[position] = ALPHABET.charAt((int) (value & SYMBOL_MASK));
            value >>>= SYMBOL_BITS;
        }
    }

    /** Character class body for a regular expression, without the enclosing brackets. */
    public static String characterClass() {
        return ALPHABET;
    }
}
