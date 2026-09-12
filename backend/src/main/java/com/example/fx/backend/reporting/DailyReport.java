package com.example.fx.backend.reporting;

import java.time.LocalDate;

public record DailyReport(byte[] content, String filename, LocalDate reportDate, int recordCount) {
}
