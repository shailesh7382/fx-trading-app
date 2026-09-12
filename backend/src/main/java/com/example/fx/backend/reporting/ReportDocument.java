package com.example.fx.backend.reporting;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

record ReportDocument(String title, LocalDate reportDate, String businessZone, Instant generatedAt,
                      List<ReportColumn> columns, List<List<String>> rows) {
    ReportDocument {
        if (title == null || title.isBlank() || businessZone == null || businessZone.isBlank()) {
            throw new IllegalArgumentException("A report requires a title and business timezone.");
        }
        List<ReportColumn> immutableColumns = List.copyOf(columns);
        List<List<String>> immutableRows = rows.stream().map(List::copyOf).toList();
        if (immutableColumns.isEmpty()) {
            throw new IllegalArgumentException("A report must contain at least one column.");
        }
        if (immutableRows.stream().anyMatch(row -> row.size() != immutableColumns.size())) {
            throw new IllegalArgumentException("Each report row must match the configured columns.");
        }
        columns = immutableColumns;
        rows = immutableRows;
    }

    record ReportColumn(String heading, float weight) {
        ReportColumn {
            if (heading == null || heading.isBlank() || weight <= 0) {
                throw new IllegalArgumentException("Report columns require a heading and positive weight.");
            }
        }
    }
}
