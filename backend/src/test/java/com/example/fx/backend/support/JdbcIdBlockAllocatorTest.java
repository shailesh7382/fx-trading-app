package com.example.fx.backend.support;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.stream.IntStream;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.embedded.EmbeddedDatabaseBuilder;
import org.springframework.jdbc.datasource.embedded.EmbeddedDatabaseType;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Exercises the allocator against a real database, because the guarantee it makes —
 * that no value is ever handed out twice — lives in the row lock, not in Java.
 */
class JdbcIdBlockAllocatorTest {

    private DataSource dataSource;
    private JdbcTemplate jdbc;
    private TransactionTemplate transactions;

    @BeforeEach
    void createSchema() {
        dataSource = new EmbeddedDatabaseBuilder()
                .setType(EmbeddedDatabaseType.H2)
                .generateUniqueName(true)
                .build();
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("""
                CREATE TABLE id_block_allocation (
                    sequence_name VARCHAR(64) NOT NULL PRIMARY KEY,
                    next_value BIGINT NOT NULL
                )
                """);
        transactions = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
    }

    /** The allocator relies on Spring's transaction proxy, which a plain unit test lacks. */
    private IdBlockAllocator.IdBlock claim(String sequenceName, int blockSize) {
        JdbcIdBlockAllocator allocator = new JdbcIdBlockAllocator(jdbc);
        return transactions.execute(status -> allocator.claim(sequenceName, blockSize));
    }

    @Test
    void createsTheCounterOnFirstUseAndStartsFromZero() {
        IdBlockAllocator.IdBlock block = claim("B", 100);

        assertThat(block.start()).isZero();
        assertThat(block.end()).isEqualTo(100);
        assertThat(block.size()).isEqualTo(100);
    }

    @Test
    void handsOutBlocksThatButtUpAgainstEachOtherWithoutOverlapping() {
        IdBlockAllocator.IdBlock first = claim("B", 100);
        IdBlockAllocator.IdBlock second = claim("B", 100);
        IdBlockAllocator.IdBlock third = claim("B", 50);

        assertThat(second.start()).isEqualTo(first.end());
        assertThat(third.start()).isEqualTo(second.end());
        assertThat(third.end()).isEqualTo(250);
    }

    @Test
    void countsEachSystemSeparately() {
        claim("B", 100);
        claim("B", 100);

        IdBlockAllocator.IdBlock simulator = claim("S", 100);

        assertThat(simulator.start()).isZero();
        assertThat(jdbc.queryForObject(
                "SELECT next_value FROM id_block_allocation WHERE sequence_name = 'B'", Long.class))
                .isEqualTo(200);
    }

    @Test
    void neverOverlapsWhenInstancesReserveConcurrently() throws Exception {
        int instances = 8;
        int claimsEach = 40;
        int blockSize = 25;

        try (ExecutorService pool = Executors.newFixedThreadPool(instances)) {
            List<Callable<List<IdBlockAllocator.IdBlock>>> jobs = IntStream.range(0, instances)
                    .<Callable<List<IdBlockAllocator.IdBlock>>>mapToObj(ignored -> () -> {
                        List<IdBlockAllocator.IdBlock> blocks = new ArrayList<>();
                        for (int count = 0; count < claimsEach; count++) {
                            blocks.add(claim("B", blockSize));
                        }
                        return blocks;
                    })
                    .toList();

            Set<Long> values = new HashSet<>();
            int expected = 0;
            for (Future<List<IdBlockAllocator.IdBlock>> result : pool.invokeAll(jobs)) {
                for (IdBlockAllocator.IdBlock block : result.get()) {
                    for (long value = block.start(); value < block.end(); value++) {
                        values.add(value);
                    }
                    expected += blockSize;
                }
            }

            // Any overlap between two instances' blocks collapses the set.
            assertThat(values).hasSize(expected);
            assertThat(values).containsExactlyInAnyOrderElementsOf(
                    IntStream.range(0, expected).mapToObj(Long::valueOf).toList());
        }
    }

    @Test
    void survivesTwoInstancesSeedingTheSameSequenceAtOnce() throws Exception {
        try (ExecutorService pool = Executors.newFixedThreadPool(4)) {
            List<Callable<IdBlockAllocator.IdBlock>> jobs = IntStream.range(0, 4)
                    .<Callable<IdBlockAllocator.IdBlock>>mapToObj(ignored -> () -> claim("N", 10))
                    .toList();

            Set<Long> starts = new HashSet<>();
            for (Future<IdBlockAllocator.IdBlock> result : pool.invokeAll(jobs)) {
                starts.add(result.get().start());
            }

            assertThat(starts).containsExactlyInAnyOrder(0L, 10L, 20L, 30L);
        }
    }
}
