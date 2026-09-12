package com.example.fx.backend.support;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SequentialIdGeneratorTest {

    private JdbcTemplate jdbc;
    private DataSourceTransactionManager transactionManager;

    @BeforeEach
    void createDatabase() {
        DataSource dataSource = new EmbeddedDatabaseBuilder()
                .setType(EmbeddedDatabaseType.H2)
                .generateUniqueName(true)
                .build();
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("""
                CREATE TABLE BKND_ID_BLOCK_ALLOCATION (
                    sequence_name VARCHAR(64) NOT NULL PRIMARY KEY,
                    next_value BIGINT NOT NULL
                )
                """);
        transactionManager = new DataSourceTransactionManager(dataSource);
    }

    private SequentialIdGenerator generator(String systemIdentifier, int blockSize) {
        return new SequentialIdGenerator(jdbc, transactionManager, systemIdentifier, blockSize);
    }

    @Test
    void stampsTheSystemLetterAndEncodesTheCounterInNineCharacters() {
        String first = generator("B", 10).generate();

        assertThat(first).hasSize(SequentialIdGenerator.ID_LENGTH).isEqualTo("B00000000");
        assertThat(SequentialIdGenerator.isValid(first)).isTrue();
    }

    @Test
    void countsUpwardsInCrockfordBase32() {
        SequentialIdGenerator generator = generator("B", 64);

        List<String> ids = IntStream.range(0, 34).mapToObj(index -> generator.generate()).toList();

        assertThat(ids.get(1)).isEqualTo("B00000001");
        assertThat(ids.get(9)).isEqualTo("B00000009");
        assertThat(ids.get(10)).isEqualTo("B0000000A");
        assertThat(ids.get(17)).isEqualTo("B0000000H");
        // 'I' is not in the alphabet, so H is followed by J rather than by I.
        assertThat(ids.get(18)).isEqualTo("B0000000J");
        assertThat(ids.get(31)).isEqualTo("B0000000Z");
        assertThat(ids.get(32)).isEqualTo("B00000010");
    }

    @Test
    void issuesIdentifiersThatSortIntoIssueOrder() {
        SequentialIdGenerator generator = generator("B", 1_000);

        List<String> ids = IntStream.range(0, 5_000).mapToObj(index -> generator.generate()).toList();

        assertThat(ids).isSorted();
    }

    @Test
    void touchesTheDatabaseOncePerBlockRatherThanOncePerIdentifier() {
        SequentialIdGenerator generator = generator("B", 250);

        for (int count = 0; count < 1_000; count++) {
            generator.generate();
        }

        assertThat(jdbc.queryForObject(
                "SELECT next_value FROM BKND_ID_BLOCK_ALLOCATION WHERE sequence_name = 'B'", Long.class))
                .isEqualTo(1_000);
    }

    @Test
    void neverRepeatsAcrossBlockBoundaries() {
        SequentialIdGenerator generator = generator("B", 7);

        Set<String> ids = new HashSet<>();
        for (int count = 0; count < 5_000; count++) {
            ids.add(generator.generate());
        }

        assertThat(ids).hasSize(5_000);
    }

    @Test
    void keepsInstancesApartWhenTheyShareTheCounter() {
        SequentialIdGenerator first = generator("B", 100);
        SequentialIdGenerator second = generator("B", 100);

        Set<String> ids = new HashSet<>();
        for (int count = 0; count < 500; count++) {
            ids.add(first.generate());
            ids.add(second.generate());
        }

        assertThat(ids).hasSize(1_000);
    }

    @Test
    void differentSystemLettersCannotCollideOnTheSameCounterValue() {
        SequentialIdGenerator backend = generator("B", 10);
        SequentialIdGenerator tradingSystem = generator("S", 10);

        assertThat(backend.generate()).isEqualTo("B00000000");
        assertThat(tradingSystem.generate()).isEqualTo("S00000000");
    }

    @Test
    void staysUniqueUnderConcurrentDemandAcrossManyBlocks() throws Exception {
        int instances = 8;
        int perInstance = 1_000;

        try (ExecutorService pool = Executors.newFixedThreadPool(instances)) {
            List<Future<List<String>>> results = IntStream.range(0, instances)
                    .mapToObj(ignored -> generator("B", 16))
                    .map(instance -> pool.submit(() -> IntStream.range(0, perInstance)
                            .mapToObj(ignored -> instance.generate())
                            .toList()))
                    .toList();

            Set<String> all = new HashSet<>();
            for (Future<List<String>> result : results) {
                all.addAll(result.get());
            }

            assertThat(all).hasSize(instances * perInstance);
            assertThat(all).allMatch(SequentialIdGenerator::isValid);
        }
    }

    @Test
    void refusesToSilentlyWrapWhenTheCounterSpaceRunsOut() {
        jdbc.update("INSERT INTO BKND_ID_BLOCK_ALLOCATION (sequence_name, next_value) VALUES ('B', ?)",
                SequentialIdGenerator.CAPACITY - 1);
        SequentialIdGenerator generator = generator("B", 10);

        assertThat(generator.generate()).isEqualTo("BZZZZZZZZ");
        assertThatThrownBy(generator::generate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("exhausted");
    }

    @Test
    void rejectsConfigurationThatCouldNotProduceValidIdentifiers() {
        assertThat(generator(" b ", 10).systemIdentifier()).isEqualTo('B');
        assertThatThrownBy(() -> generator("BB", 10))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("single upper-case");
        assertThatThrownBy(() -> generator("1", 10))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> generator("B", 0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Block size");
    }

    @Test
    void rejectsAnythingItWouldNotHaveProduced() {
        assertThat(SequentialIdGenerator.isValid(null)).isFalse();
        assertThat(SequentialIdGenerator.isValid("")).isFalse();
        assertThat(SequentialIdGenerator.isValid("B0000000")).isFalse();
        assertThat(SequentialIdGenerator.isValid("B000000000")).isFalse();
        assertThat(SequentialIdGenerator.isValid("b00000000")).isFalse();
        assertThat(SequentialIdGenerator.isValid("00000000B")).isFalse();
        assertThat(SequentialIdGenerator.isValid("B0000000I")).isFalse();
        assertThat(SequentialIdGenerator.isValid("B0000000O")).isFalse();
    }

}
