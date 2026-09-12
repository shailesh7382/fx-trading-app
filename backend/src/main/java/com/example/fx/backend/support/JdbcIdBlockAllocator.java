package com.example.fx.backend.support;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reserves identifier blocks against a single database row.
 *
 * <p>The row is the only place allocation happens, so two application instances can
 * never be given the same value: the {@code UPDATE} takes an exclusive row lock, and
 * whichever instance arrives second waits and then reads a range starting where the
 * first one's ended.
 *
 * <p>The claim runs in its own transaction ({@link Propagation#REQUIRES_NEW}) so the
 * row lock is released as soon as the range is reserved, rather than being held for
 * the length of whatever business transaction happened to trigger the refill. That is
 * what keeps a shared counter from serialising unrelated work across the cluster.
 */
@Component
public class JdbcIdBlockAllocator implements IdBlockAllocator {

    private static final Logger LOG = LoggerFactory.getLogger(JdbcIdBlockAllocator.class);

    private static final String RESERVE =
            "UPDATE id_block_allocation SET next_value = next_value + ? WHERE sequence_name = ?";
    private static final String READ =
            "SELECT next_value FROM id_block_allocation WHERE sequence_name = ?";
    private static final String SEED =
            "INSERT INTO id_block_allocation (sequence_name, next_value) VALUES (?, 0)";

    private final JdbcTemplate jdbc;

    public JdbcIdBlockAllocator(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Reserves the next {@code blockSize} values for the caller alone.
     *
     * @return the reserved half-open range {@code [start, end)}
     */
    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW, isolation = Isolation.READ_COMMITTED)
    public IdBlock claim(String sequenceName, int blockSize) {
        if (jdbc.update(RESERVE, blockSize, sequenceName) == 0) {
            seed(sequenceName);

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

        LOG.debug("Reserved identifier block sequence={} start={} end={}", sequenceName, end - blockSize, end);
        return new IdBlock(end - blockSize, end);
    }

    /** Creates the counter row, tolerating another instance winning the same race. */
    private void seed(String sequenceName) {
        try {
            jdbc.update(SEED, sequenceName);
            LOG.info("Created identifier sequence sequenceName={}", sequenceName);
        } catch (DuplicateKeyException alreadyCreated) {
            LOG.debug("Identifier sequence sequenceName={} was created concurrently", sequenceName);
        }
    }

}
