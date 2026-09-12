package com.example.fx.backend.reporting;

import java.time.ZoneId;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("reports")
public record DailyReportProperties(ZoneId zoneId) {
    public DailyReportProperties {
        zoneId = zoneId == null ? ZoneId.of("Asia/Singapore") : zoneId;
    }
}
