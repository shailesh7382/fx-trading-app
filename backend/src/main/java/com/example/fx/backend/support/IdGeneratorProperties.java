package com.example.fx.backend.support;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Settings for {@link SequentialIdGenerator}.
 *
 * @param systemIdentifier single upper-case letter stamped as the first character of
 *                         every identifier this process mints. Each deployable system
 *                         gets its own letter, which keeps their identifiers distinct
 *                         even where they share a counter value.
 * @param blockSize        how many counter values an instance claims from the database
 *                         at a time. Larger blocks mean fewer round trips and more
 *                         identifiers discarded when a process stops mid-block; both
 *                         are cheap against a 1.1 trillion capacity.
 */
@ConfigurationProperties("fx.id")
public record IdGeneratorProperties(String systemIdentifier, Integer blockSize) {

    public IdGeneratorProperties {
        systemIdentifier = systemIdentifier == null || systemIdentifier.isBlank()
                ? "B"
                : systemIdentifier.trim().toUpperCase(java.util.Locale.ROOT);
        blockSize = blockSize == null || blockSize < 1 ? 1_000 : blockSize;
    }

    public char systemIdentifierChar() {
        return systemIdentifier.charAt(0);
    }
}
