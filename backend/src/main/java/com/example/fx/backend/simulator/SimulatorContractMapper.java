package com.example.fx.backend.simulator;

import com.example.fx.simulator.api.model.Side;
import com.example.fx.simulator.api.model.Tenor;
import java.util.Locale;

public final class SimulatorContractMapper {
    private SimulatorContractMapper() {}

    public static Tenor toContractTenor(String value) {
        return switch (text(value, "SP").toUpperCase(Locale.ROOT)) {
            case "SP", "SPOT" -> Tenor.SPOT;
            case "1W", "ONE_WEEK" -> Tenor.ONE_WEEK;
            case "1M", "ONE_MONTH" -> Tenor.ONE_MONTH;
            case "3M", "THREE_MONTHS" -> Tenor.THREE_MONTHS;
            case "6M", "SIX_MONTHS" -> Tenor.SIX_MONTHS;
            case "1Y", "ONE_YEAR" -> Tenor.ONE_YEAR;
            default -> throw new IllegalArgumentException("Unsupported tenor: " + value);
        };
    }

    public static String toUiTenor(Tenor tenor) {
        return switch (tenor) {
            case SPOT -> "SP";
            case ONE_WEEK -> "1W";
            case ONE_MONTH -> "1M";
            case THREE_MONTHS -> "3M";
            case SIX_MONTHS -> "6M";
            case ONE_YEAR -> "1Y";
        };
    }

    public static Side toSide(String direction) {
        return "SELL".equalsIgnoreCase(direction) ? Side.SELL : Side.BUY;
    }

    public static String toDirection(Side side) {
        return side == Side.SELL ? "Sell" : "Buy";
    }

    public static int tenorOrder(String tenor) {
        return switch (text(tenor, "")) {
            case "SP" -> 0;
            case "1W" -> 1;
            case "1M" -> 2;
            case "3M" -> 3;
            case "6M" -> 4;
            case "1Y" -> 5;
            default -> Integer.MAX_VALUE;
        };
    }

    private static String text(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
