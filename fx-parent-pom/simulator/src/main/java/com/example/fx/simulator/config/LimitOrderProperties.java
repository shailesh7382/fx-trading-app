package com.example.fx.simulator.config;

import java.net.URI;
import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("simulator.limit-orders")
public record LimitOrderProperties(int maxOrders, Duration retention, Callback callback) {
    public LimitOrderProperties {
        if (maxOrders <= 0 || retention == null || retention.isNegative() || retention.isZero() || callback == null) {
            throw new IllegalArgumentException("Positive order capacity and retention, and a callback section, are required.");
        }
    }

    /**
     * Deliveries only ever go to a configured prefix, so a caller cannot aim the simulator at an
     * arbitrary host. Attempts are bounded, and backoff doubles from the first retry.
     */
    public record Callback(List<String> allowedPrefixes, int maxAttempts, Duration initialBackoff, Duration timeout) {
        public Callback {
            allowedPrefixes = allowedPrefixes == null ? List.of() : List.copyOf(allowedPrefixes);
            if (allowedPrefixes.isEmpty() || allowedPrefixes.stream().anyMatch(prefix -> !prefix.startsWith("http"))) {
                throw new IllegalArgumentException("At least one http(s) callback prefix must be configured.");
            }
            if (maxAttempts <= 0 || initialBackoff == null || initialBackoff.isNegative() || initialBackoff.isZero()
                    || timeout == null || timeout.isNegative() || timeout.isZero()) {
                throw new IllegalArgumentException("Positive callback attempts, backoff, and timeout are required.");
            }
        }

        public boolean allows(URI callbackUrl) {
            String target = callbackUrl.toString();
            return allowedPrefixes.stream().anyMatch(target::startsWith);
        }

        /** Exponential, capped so a long-lived retry chain cannot overflow or stall for hours. */
        public Duration backoffAfter(int attempts) {
            return initialBackoff.multipliedBy(1L << Math.min(attempts - 1, 8));
        }
    }
}
