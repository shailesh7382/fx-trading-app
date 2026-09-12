package com.example.fx.backend.support;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SequentialIdGeneratorTest {

    /** Stands in for the database row: hands out consecutive blocks and counts the round trips. */
    private static final class CountingAllocator implements IdBlockAllocator {
        private final AtomicLong nextValue;
        private final AtomicInteger claims = new AtomicInteger();

        private CountingAllocator(long startAt) {
            this.nextValue = new AtomicLong(startAt);
        }

        @Override
        public IdBlock claim(String sequenceName, int blockSize) {
            claims.incrementAndGet();
            long start = nextValue.getAndAdd(blockSize);
            return new IdBlock(start, start + blockSize);
        }
    }

    private static SequentialIdGenerator generator(CountingAllocator allocator, int blockSize) {
        return new SequentialIdGenerator(allocator, 'B', blockSize);
    }

    @Test
    void stampsTheSystemLetterAndEncodesTheCounterInNineCharacters() {
        CountingAllocator allocator = new CountingAllocator(0);

        String first = generator(allocator, 10).generate();

        assertThat(first).hasSize(SequentialIdGenerator.ID_LENGTH).isEqualTo("B00000000");
        assertThat(SequentialIdGenerator.isValid(first)).isTrue();
    }

    @Test
    void countsUpwardsInCrockfordBase32() {
        SequentialIdGenerator generator = generator(new CountingAllocator(0), 64);

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
        SequentialIdGenerator generator = generator(new CountingAllocator(0), 1_000);

        List<String> ids = IntStream.range(0, 5_000).mapToObj(index -> generator.generate()).toList();

        assertThat(ids).isSorted();
    }

    @Test
    void touchesTheDatabaseOncePerBlockRatherThanOncePerIdentifier() {
        CountingAllocator allocator = new CountingAllocator(0);
        SequentialIdGenerator generator = generator(allocator, 250);

        for (int count = 0; count < 1_000; count++) {
            generator.generate();
        }

        assertThat(allocator.claims).hasValue(4);
    }

    @Test
    void neverRepeatsAcrossBlockBoundaries() {
        CountingAllocator allocator = new CountingAllocator(0);
        SequentialIdGenerator generator = generator(allocator, 7);

        Set<String> ids = new HashSet<>();
        for (int count = 0; count < 5_000; count++) {
            ids.add(generator.generate());
        }

        assertThat(ids).hasSize(5_000);
    }

    @Test
    void keepsInstancesApartWhenTheyShareTheCounter() {
        // One allocator, two generators: what two application instances see.
        CountingAllocator shared = new CountingAllocator(0);
        SequentialIdGenerator first = generator(shared, 100);
        SequentialIdGenerator second = generator(shared, 100);

        Set<String> ids = new HashSet<>();
        for (int count = 0; count < 500; count++) {
            ids.add(first.generate());
            ids.add(second.generate());
        }

        assertThat(ids).hasSize(1_000);
    }

    @Test
    void differentSystemLettersCannotCollideOnTheSameCounterValue() {
        SequentialIdGenerator backend = new SequentialIdGenerator(new CountingAllocator(0), 'B', 10);
        SequentialIdGenerator simulator = new SequentialIdGenerator(new CountingAllocator(0), 'S', 10);

        assertThat(backend.generate()).isEqualTo("B00000000");
        assertThat(simulator.generate()).isEqualTo("S00000000");
    }

    @Test
    void staysUniqueUnderConcurrentDemandAcrossManyBlocks() throws Exception {
        CountingAllocator allocator = new CountingAllocator(0);
        SequentialIdGenerator generator = generator(allocator, 16);
        int threads = 8;
        int perThread = 5_000;

        try (ExecutorService pool = Executors.newFixedThreadPool(threads)) {
            List<Callable<List<String>>> jobs = IntStream.range(0, threads)
                    .<Callable<List<String>>>mapToObj(ignored -> () -> {
                        List<String> batch = new ArrayList<>(perThread);
                        for (int count = 0; count < perThread; count++) {
                            batch.add(generator.generate());
                        }
                        return batch;
                    })
                    .toList();

            Set<String> all = new HashSet<>();
            for (Future<List<String>> result : pool.invokeAll(jobs)) {
                all.addAll(result.get());
            }

            // A lost update in the refill path shows up here as a short set.
            assertThat(all).hasSize(threads * perThread);
            assertThat(all).allMatch(SequentialIdGenerator::isValid);
        }
    }

    @Test
    void refusesToSilentlyWrapWhenTheCounterSpaceRunsOut() {
        SequentialIdGenerator generator =
                generator(new CountingAllocator(SequentialIdGenerator.CAPACITY - 1), 10);

        assertThat(generator.generate()).isEqualTo("BZZZZZZZZ");
        assertThatThrownBy(generator::generate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("exhausted");
    }

    @Test
    void rejectsConfigurationThatCouldNotProduceValidIdentifiers() {
        CountingAllocator allocator = new CountingAllocator(0);

        assertThatThrownBy(() -> new SequentialIdGenerator(allocator, 'b', 10))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("upper-case");
        assertThatThrownBy(() -> new SequentialIdGenerator(allocator, '1', 10))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new SequentialIdGenerator(allocator, 'B', 0))
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

    @Test
    void defaultsAreUsableWithoutConfiguration() {
        IdGeneratorProperties defaults = new IdGeneratorProperties(null, null);

        assertThat(defaults.systemIdentifierChar()).isEqualTo('B');
        assertThat(defaults.blockSize()).isEqualTo(1_000);
        assertThat(new IdGeneratorProperties(" s ", -4).systemIdentifierChar()).isEqualTo('S');
        assertThat(new IdGeneratorProperties("S", -4).blockSize()).isEqualTo(1_000);
    }
}
