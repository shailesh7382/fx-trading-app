package com.example.fx.backend.tradingsystem;

import java.math.BigDecimal;
import java.net.URI;
import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("trading-system.client")
public record TradingSystemClientProperties(
        URI baseUrl,
        Duration connectTimeout,
        Duration readTimeout,
        String channel,
        String segment,
        String customerId,
        URI callbackUrl,
        BigDecimal defaultQuantity,
        List<String> instruments
) {
    public TradingSystemClientProperties {
        baseUrl = baseUrl == null ? URI.create("http://localhost:8090") : baseUrl;
        connectTimeout = connectTimeout == null ? Duration.ofSeconds(2) : connectTimeout;
        readTimeout = readTimeout == null ? Duration.ofSeconds(5) : readTimeout;
        channel = textOr(channel, "WEB");
        segment = textOr(segment, "C");
        customerId = textOr(customerId, "0000123456");
        callbackUrl = callbackUrl == null
                ? URI.create("http://localhost:8080/api/resting-orders/events") : callbackUrl;
        defaultQuantity = defaultQuantity == null ? new BigDecimal("1000000") : defaultQuantity;
        instruments = instruments == null || instruments.isEmpty()
                ? List.of("EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "USDCHF")
                : List.copyOf(instruments);
    }

    private static String textOr(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
