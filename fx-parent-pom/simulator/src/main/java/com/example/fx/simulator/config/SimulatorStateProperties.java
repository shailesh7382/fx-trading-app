package com.example.fx.simulator.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("simulator.state")
public record SimulatorStateProperties(int maxQuotes, int maxTrades, int maxIdempotencyKeys,
                                       Duration quoteRetention, Duration tradeRetention,
                                       Duration idempotencyRetention) {
    public SimulatorStateProperties {
        if (maxQuotes <= 0 || maxTrades <= 0 || maxIdempotencyKeys <= 0
                || quoteRetention == null || quoteRetention.isNegative() || quoteRetention.isZero()
                || tradeRetention == null || tradeRetention.isNegative() || tradeRetention.isZero()
                || idempotencyRetention == null || idempotencyRetention.isNegative() || idempotencyRetention.isZero()
                || tradeRetention.compareTo(idempotencyRetention) < 0) {
            throw new IllegalArgumentException("Positive capacities/retentions required; trade retention must cover idempotency retention.");
        }
    }
}
