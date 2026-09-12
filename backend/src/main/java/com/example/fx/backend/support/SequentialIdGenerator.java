package com.example.fx.backend.support;

import java.util.Locale;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/** Generates sortable, nine-character IDs backed by a durable database counter. */
@Component
public class SequentialIdGenerator {

    private static final Logger LOG = LoggerFactory.getLogger(SequentialIdGenerator.class);
    private static final String ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    private static final int COUNTER_SYMBOLS = 8;
    private static final int SYMBOL_BITS = 5;
    private static final int SYMBOL_MASK = 31;
    private static final String RESERVE =
            "UPDATE BKND_ID_BLOCK_ALLOCATION SET next_value = next_value + ? WHERE sequence_name = ?";
    private static final String READ =
            "SELECT next_value FROM BKND_ID_BLOCK_ALLOCATION WHERE sequence_name = ?";
    private static final String SEED =
            "INSERT INTO BKND_ID_BLOCK_ALLOCATION (sequence_name, next_value) VALUES (?, 0)";

    public static final int ID_LENGTH = COUNTER_SYMBOLS + 1;
    public static final long CAPACITY = 1L << (SYMBOL_BITS * COUNTER_SYMBOLS);
    public static final Pattern ID_PATTERN = Pattern.compile(
            "^[A-Z][" + ALPHABET + "]{" + COUNTER_SYMBOLS + "}$");

    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactions;
    private final char systemIdentifier;
    private final String sequenceName;
    private final int blockSize;

    private long nextValue;
    private long blockEnd;

    public SequentialIdGenerator(
            JdbcTemplate jdbc,
            PlatformTransactionManager transactionManager,
            @Value("${fx.id.system-identifier:B}") String systemIdentifier,
            @Value("${fx.id.block-size:1000}") int blockSize) {
        String normalized = systemIdentifier == null
                ? ""
                : systemIdentifier.trim().toUpperCase(Locale.ROOT);
        if (!normalized.matches("[A-Z]")) {
            throw new IllegalArgumentException(
                    "System identifier must be a single upper-case letter, was '" + systemIdentifier + "'");
        }
        if (blockSize < 1) {
            throw new IllegalArgumentException("Block size must be at least 1, was " + blockSize);
        }

        this.jdbc = jdbc;
        this.transactions = new TransactionTemplate(transactionManager);
        this.transactions.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.transactions.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
        this.systemIdentifier = normalized.charAt(0);
        this.sequenceName = normalized;
        this.blockSize = blockSize;
    }

    /** @return an ID that remains unique across threads, restarts, and application instances. */
    public synchronized String generate() {
        if (nextValue >= blockEnd) {
            reserveBlock();
        }

        long value = nextValue++;
        if (value >= CAPACITY) {
            throw new IllegalStateException("Identifier space for system '" + systemIdentifier
                    + "' is exhausted after " + CAPACITY + " identifiers");
        }

        char[] id = new char[ID_LENGTH];
        id[0] = systemIdentifier;
        for (int position = ID_LENGTH - 1; position > 0; position--) {
            id[position] = ALPHABET.charAt((int) (value & SYMBOL_MASK));
            value >>>= SYMBOL_BITS;
        }
        return new String(id);
    }

    public char systemIdentifier() {
        return systemIdentifier;
    }

    public static boolean isValid(String candidate) {
        return candidate != null && ID_PATTERN.matcher(candidate).matches();
    }

    private void reserveBlock() {
        long[] block = transactions.execute(status -> {
            if (jdbc.update(RESERVE, blockSize, sequenceName) == 0) {
                seedCounter();
                if (jdbc.update(RESERVE, blockSize, sequenceName) == 0) {
                    throw new IllegalStateException(
                            "Could not reserve an identifier block for sequence " + sequenceName);
                }
            }

            Long end = jdbc.queryForObject(READ, Long.class, sequenceName);
            if (end == null) {
                throw new IllegalStateException(
                        "Identifier sequence " + sequenceName + " disappeared while being reserved");
            }
            return new long[]{end - blockSize, end};
        });

        if (block == null) {
            throw new IllegalStateException("Identifier block transaction returned no result");
        }
        nextValue = block[0];
        blockEnd = block[1];
        LOG.debug("Reserved identifier block system={} start={} end={}",
                systemIdentifier, nextValue, blockEnd);
    }

    private void seedCounter() {
        try {
            jdbc.update(SEED, sequenceName);
        } catch (DuplicateKeyException alreadyCreated) {
            LOG.debug("Identifier sequence {} was created concurrently", sequenceName);
        }
    }
}
