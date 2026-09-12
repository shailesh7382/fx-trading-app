package com.example.fx.backend.support;

import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AlphanumericIdGeneratorTest {

    private final AlphanumericIdGenerator generator = new AlphanumericIdGenerator();

    @Test
    void generatesTwelveCharacterAlphanumericIds() {
        assertThat(generator.generate())
                .hasSize(12)
                .matches("[A-Za-z0-9]{12}");
    }

    @Test
    void doesNotRepeatAcrossARepresentativeSample() {
        Set<String> ids = new HashSet<>();
        for (int count = 0; count < 10_000; count++) {
            ids.add(generator.generate());
        }

        assertThat(ids).hasSize(10_000);
    }
}
