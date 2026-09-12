package com.example.fx.backend.reporting;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

class PdfReportWriterTest {
    private final PdfReportWriter writer = new PdfReportWriter();

    @Test
    void createsPaginatedPdfWithRepeatedHeadersAndFooters() throws Exception {
        List<List<String>> rows = new ArrayList<>();
        for (int index = 1; index <= 75; index++) {
            rows.add(List.of("trade-" + index, "EURUSD", "alice", "1,000,000.00"));
        }
        ReportDocument report = new ReportDocument("Trades Daily Report", LocalDate.parse("2026-09-13"),
                "Asia/Singapore", Instant.parse("2026-09-13T08:00:00Z"), List.of(
                new ReportDocument.ReportColumn("Trade ID", 2f),
                new ReportDocument.ReportColumn("Pair", 1f),
                new ReportDocument.ReportColumn("Trader", 1f),
                new ReportDocument.ReportColumn("Quantity", 1f)), rows);

        byte[] pdf = writer.write(report);

        assertThat(new String(pdf, 0, 5, java.nio.charset.StandardCharsets.US_ASCII)).isEqualTo("%PDF-");
        try (PDDocument document = PDDocument.load(pdf)) {
            String text = new PDFTextStripper().getText(document);
            assertThat(document.getNumberOfPages()).isGreaterThan(1);
            assertThat(text).contains("Trades Daily Report", "trade-1", "trade-75", "Page 1 of");
        }
    }

    @Test
    void createsValidEmptyReport() throws Exception {
        ReportDocument report = new ReportDocument("Live Orders Daily Report", LocalDate.parse("2026-09-13"),
                "Asia/Singapore", Instant.parse("2026-09-13T08:00:00Z"),
                List.of(new ReportDocument.ReportColumn("Order ID", 1f)), List.of());

        byte[] pdf = writer.write(report);

        try (PDDocument document = PDDocument.load(pdf)) {
            assertThat(new PDFTextStripper().getText(document))
                    .contains("No records found for this business date.", "Records: 0");
        }
    }
}
