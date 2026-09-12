package com.example.fx.backend.support;

import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.locks.ReentrantLock;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Mints nine-character identifiers that are unique by construction rather than by
 * probability: a system letter followed by eight symbols encoding a counter no two
 * instances can ever draw twice.
 *
 * <pre>
 *   B 0 0 0 0 0 0 1 F
 *   ^ ^-------------^
 *   |      counter, Crockford base32, most significant symbol first
 *   system identifier
 * </pre>
 *
 * <p><strong>Uniqueness.</strong> {@link IdBlockAllocator} reserves ranges of counter
 * values from one database row, so a value is handed to exactly one instance, once.
 * There is no birthday problem and no retry loop — a duplicate is not unlikely, it is
 * impossible while the counter row is intact.
 *
 * <p><strong>Cost.</strong> The database is touched once per {@code blockSize} values
 * (a thousand by default); every identifier in between is an uncontended
 * {@link AtomicLong#getAndIncrement()}. Refills take a short lock so exactly one
 * thread reserves the next range while the others wait and retry.
 *
 * <p><strong>Ordering.</strong> The counter is encoded most significant symbol first,
 * so identifiers sort in the order they were issued. As a primary key that appends to
 * the index rather than scattering across it, which a random identifier cannot do.
 *
 * <p><strong>Gaps.</strong> Values left in a block when a process stops are never
 * reused. Identifiers are unique and increasing, not contiguous — with 32^8 values per
 * system letter, a process could restart a billion times and still not run short.
 *
 * <p>Instances are thread-safe and meant to be shared as a singleton.
 */
@Component
public class SequentialIdGenerator {

    private static final Logger LOG = LoggerFactory.getLogger(SequentialIdGenerator.class);

    /** Symbols carrying the counter, after the leading system identifier. */
    public static final int COUNTER_SYMBOLS = 8;

    /** Total identifier length, system identifier included. */
    public static final int ID_LENGTH = COUNTER_SYMBOLS + 1;

    /** Counter values available to one system identifier: 32^8, about 1.1 trillion. */
    public static final long CAPACITY = CrockfordBase32.capacity(COUNTER_SYMBOLS);

    /** Matches exactly what {@link #generate()} produces, anchored. */
    public static final Pattern ID_PATTERN = Pattern.compile(
            "^[A-Z][" + CrockfordBase32.characterClass() + "]{" + COUNTER_SYMBOLS + "}$");

    private final IdBlockAllocator allocator;
    private final char systemIdentifier;
    private final String sequenceName;
    private final int blockSize;

    private final ReentrantLock refillLock = new ReentrantLock();
    private volatile Block block = Block.exhausted();

    public SequentialIdGenerator(IdBlockAllocator allocator, IdGeneratorProperties properties) {
        this(allocator, properties.systemIdentifierChar(), properties.blockSize());
    }

    SequentialIdGenerator(IdBlockAllocator allocator, char systemIdentifier, int blockSize) {
        if (systemIdentifier < 'A' || systemIdentifier > 'Z') {
            throw new IllegalArgumentException(
                    "System identifier must be a single upper-case letter, was '" + systemIdentifier + "'");
        }
        if (blockSize < 1) {
            throw new IllegalArgumentException("Block size must be at least 1, was " + blockSize);
        }

        this.allocator = allocator;
        this.systemIdentifier = systemIdentifier;
        this.sequenceName = String.valueOf(systemIdentifier);
        this.blockSize = blockSize;
    }

    /** @return an identifier no other caller, in this process or any other, will receive. */
    public String generate() {
        long value = nextValue();

        if (value >= CAPACITY) {
            throw new IllegalStateException("Identifier space for system '" + systemIdentifier
                    + "' is exhausted after " + CAPACITY + " identifiers");
        }

        char[] id = new char[ID_LENGTH];
        id[0] = systemIdentifier;
        CrockfordBase32.encodeInto(value, id, 1, COUNTER_SYMBOLS);
        return new String(id);
    }

    public char systemIdentifier() {
        return systemIdentifier;
    }

    /** Whether a string could have been produced by some instance of this generator. */
    public static boolean isValid(String candidate) {
        return candidate != null && ID_PATTERN.matcher(candidate).matches();
    }

    /**
     * Takes the next counter value, reserving a fresh block when the current one runs
     * out. The common path never blocks; only the thread that finds the block empty
     * takes the refill lock, and the rest re-read the new block and carry on.
     */
    private long nextValue() {
        while (true) {
            Block current = block;
            long claimed = current.claim();

            if (claimed >= 0) {
                return claimed;
            }

            refill(current);
        }
    }

    private void refill(Block exhausted) {
        refillLock.lock();
        try {
            if (block != exhausted) {
                // Another thread reserved a block while this one waited for the lock.
                return;
            }

            IdBlockAllocator.IdBlock reserved = allocator.claim(sequenceName, blockSize);
            LOG.debug("Refilled identifier block system={} start={} end={}",
                    systemIdentifier, reserved.start(), reserved.end());
            block = new Block(reserved.start(), reserved.end());
        } finally {
            refillLock.unlock();
        }
    }

    /** A reserved range being handed out; {@code claim} returns -1 once it is spent. */
    private static final class Block {
        private final AtomicLong cursor;
        private final long end;

        private Block(long start, long end) {
            this.cursor = new AtomicLong(start);
            this.end = end;
        }

        private static Block exhausted() {
            return new Block(0, 0);
        }

        private long claim() {
            long candidate = cursor.get();

            while (candidate < end) {
                if (cursor.compareAndSet(candidate, candidate + 1)) {
                    return candidate;
                }
                candidate = cursor.get();
            }

            return -1;
        }
    }
}
