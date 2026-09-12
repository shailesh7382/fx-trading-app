package com.example.fx.backend.support;

/**
 * Hands out exclusive ranges of counter values.
 *
 * <p>An implementation must guarantee that a value is returned to exactly one caller,
 * once, across every application instance sharing the sequence — that guarantee is
 * what makes {@link SequentialIdGenerator} unique by construction rather than by
 * probability.
 */
public interface IdBlockAllocator {

    /**
     * Reserves the next {@code blockSize} values for the caller alone.
     *
     * @return the reserved half-open range {@code [start, end)}
     */
    IdBlock claim(String sequenceName, int blockSize);

    /** A half-open range of counter values reserved for one instance. */
    record IdBlock(long start, long end) {
        public IdBlock {
            if (end <= start) {
                throw new IllegalArgumentException("Block end must be beyond its start");
            }
        }

        public long size() {
            return end - start;
        }
    }
}
