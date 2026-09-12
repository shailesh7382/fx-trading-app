package com.example.fx.backend.reporting;

import java.util.Arrays;
import java.util.Locale;
import java.util.stream.Collectors;

public enum DailyReportType {
    EXECUTED_ORDERS("executed-orders", "Executed Orders"),
    TRADES("trades", "Trades"),
    USERS_LOGGED_IN("users-logged-in", "Users Logged In"),
    USERS_TRADED("users-traded", "Users Traded"),
    LIVE_ORDERS("live-orders", "Live Orders");

    private final String slug;
    private final String title;

    DailyReportType(String slug, String title) {
        this.slug = slug;
        this.title = title;
    }

    public String slug() {
        return slug;
    }

    public String title() {
        return title;
    }

    public static DailyReportType fromSlug(String value) {
        String normalized = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        return Arrays.stream(values())
                .filter(type -> type.slug.equals(normalized))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "Unsupported report type. Expected one of: " + supportedTypes()));
    }

    public static String supportedTypes() {
        return Arrays.stream(values()).map(DailyReportType::slug).collect(Collectors.joining(", "));
    }
}
