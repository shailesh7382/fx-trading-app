package com.example.fx.simulator.config;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("simulator.settlement")
public record SettlementProperties(Map<String, Integer> spotLags, Map<String, List<LocalDate>> holidays) {
    public SettlementProperties {
        spotLags = spotLags == null ? Map.of() : Map.copyOf(spotLags);
        holidays = holidays == null ? Map.of() : holidays.entrySet().stream()
                .collect(Collectors.toUnmodifiableMap(Map.Entry::getKey, e -> List.copyOf(e.getValue())));
        if (spotLags.values().stream().anyMatch(lag -> lag < 0 || lag > 10)) {
            throw new IllegalArgumentException("Spot lags must be between zero and ten business days.");
        }
    }
}
