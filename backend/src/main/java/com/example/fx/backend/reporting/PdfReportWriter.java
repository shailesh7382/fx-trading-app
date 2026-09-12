package com.example.fx.backend.reporting;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.text.Normalizer;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentInformation;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.PDPageContentStream.AppendMode;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.springframework.stereotype.Component;

@Component
public class PdfReportWriter {
    private static final PDRectangle PAGE_SIZE = new PDRectangle(PDRectangle.A4.getHeight(), PDRectangle.A4.getWidth());
    private static final PDFont REGULAR = PDType1Font.HELVETICA;
    private static final PDFont BOLD = PDType1Font.HELVETICA_BOLD;
    private static final Color NAVY = new Color(18, 46, 79);
    private static final Color BLUE = new Color(39, 105, 165);
    private static final Color HEADER_BACKGROUND = new Color(224, 234, 244);
    private static final Color ALTERNATE_ROW = new Color(246, 249, 252);
    private static final Color BORDER = new Color(204, 214, 224);
    private static final Color TEXT = new Color(30, 42, 54);
    private static final Color MUTED = new Color(91, 105, 120);
    private static final float MARGIN = 34f;
    private static final float TABLE_HEADER_HEIGHT = 24f;
    private static final float ROW_HEIGHT = 20f;
    private static final float FOOTER_HEIGHT = 28f;
    private static final DateTimeFormatter GENERATED_FORMAT =
            DateTimeFormatter.ofPattern("uuuu-MM-dd HH:mm:ss 'UTC'").withZone(ZoneOffset.UTC);

    public byte[] write(ReportDocument report) throws IOException {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            setMetadata(document, report);
            int rowIndex = 0;
            do {
                PDPage page = new PDPage(PAGE_SIZE);
                document.addPage(page);
                try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                    float tableTop = drawPageHeader(content, report);
                    float rowTop = drawTableHeader(content, report.columns(), tableTop);
                    if (report.rows().isEmpty()) {
                        drawEmptyState(content, rowTop);
                    } else {
                        while (rowIndex < report.rows().size() && rowTop - ROW_HEIGHT > FOOTER_HEIGHT + MARGIN) {
                            drawRow(content, report.columns(), report.rows().get(rowIndex), rowTop, rowIndex);
                            rowTop -= ROW_HEIGHT;
                            rowIndex++;
                        }
                    }
                }
            } while (rowIndex < report.rows().size());

            addFooters(document);
            document.save(output);
            return output.toByteArray();
        }
    }

    private void setMetadata(PDDocument document, ReportDocument report) {
        PDDocumentInformation information = document.getDocumentInformation();
        information.setTitle(report.title() + " - " + report.reportDate());
        information.setAuthor("FX Backend Reporting");
        information.setSubject("Daily operational report");
    }

    private float drawPageHeader(PDPageContentStream content, ReportDocument report) throws IOException {
        float width = PAGE_SIZE.getWidth();
        float height = PAGE_SIZE.getHeight();
        content.setNonStrokingColor(NAVY);
        content.addRect(0, height - 68f, width, 68f);
        content.fill();

        drawText(content, BOLD, 17f, Color.WHITE, MARGIN, height - 32f, report.title());
        drawText(content, REGULAR, 8.5f, Color.WHITE, MARGIN, height - 50f,
                "Business date: " + report.reportDate() + " (" + report.businessZone() + ")  |  Generated: "
                        + GENERATED_FORMAT.format(report.generatedAt()));
        drawText(content, BOLD, 9f, Color.WHITE, width - 142f, height - 41f,
                "Records: " + report.rows().size());

        drawText(content, REGULAR, 8f, MUTED, MARGIN, height - 83f,
                "FX Backend - Daily operational reporting");
        return height - 94f;
    }

    private float drawTableHeader(PDPageContentStream content, List<ReportDocument.ReportColumn> columns,
                                  float top) throws IOException {
        float tableWidth = PAGE_SIZE.getWidth() - (2 * MARGIN);
        content.setNonStrokingColor(HEADER_BACKGROUND);
        content.addRect(MARGIN, top - TABLE_HEADER_HEIGHT, tableWidth, TABLE_HEADER_HEIGHT);
        content.fill();
        content.setStrokingColor(BORDER);
        content.addRect(MARGIN, top - TABLE_HEADER_HEIGHT, tableWidth, TABLE_HEADER_HEIGHT);
        content.stroke();

        float x = MARGIN;
        float totalWeight = totalWeight(columns);
        for (ReportDocument.ReportColumn column : columns) {
            float width = tableWidth * column.weight() / totalWeight;
            drawText(content, BOLD, 7.4f, NAVY, x + 5f, top - 15f,
                    fit(BOLD, 7.4f, column.heading().toUpperCase(), width - 10f));
            x += width;
        }
        return top - TABLE_HEADER_HEIGHT;
    }

    private void drawRow(PDPageContentStream content, List<ReportDocument.ReportColumn> columns,
                         List<String> values, float top, int rowIndex) throws IOException {
        float tableWidth = PAGE_SIZE.getWidth() - (2 * MARGIN);
        if (rowIndex % 2 == 1) {
            content.setNonStrokingColor(ALTERNATE_ROW);
            content.addRect(MARGIN, top - ROW_HEIGHT, tableWidth, ROW_HEIGHT);
            content.fill();
        }
        content.setStrokingColor(BORDER);
        content.moveTo(MARGIN, top - ROW_HEIGHT);
        content.lineTo(MARGIN + tableWidth, top - ROW_HEIGHT);
        content.stroke();

        float x = MARGIN;
        float totalWeight = totalWeight(columns);
        for (int index = 0; index < columns.size(); index++) {
            float width = tableWidth * columns.get(index).weight() / totalWeight;
            drawText(content, REGULAR, 7.2f, TEXT, x + 5f, top - 13.5f,
                    fit(REGULAR, 7.2f, values.get(index), width - 10f));
            x += width;
        }
    }

    private void drawEmptyState(PDPageContentStream content, float top) throws IOException {
        float tableWidth = PAGE_SIZE.getWidth() - (2 * MARGIN);
        content.setNonStrokingColor(ALTERNATE_ROW);
        content.addRect(MARGIN, top - 54f, tableWidth, 54f);
        content.fill();
        drawText(content, BOLD, 10f, BLUE, MARGIN + 12f, top - 24f,
                "No records found for this business date.");
        drawText(content, REGULAR, 8f, MUTED, MARGIN + 12f, top - 40f,
                "The report completed successfully and contains no data rows.");
    }

    private void addFooters(PDDocument document) throws IOException {
        int pageCount = document.getNumberOfPages();
        for (int index = 0; index < pageCount; index++) {
            PDPage page = document.getPage(index);
            try (PDPageContentStream content = new PDPageContentStream(
                    document, page, AppendMode.APPEND, true, true)) {
                content.setStrokingColor(BORDER);
                content.moveTo(MARGIN, 29f);
                content.lineTo(PAGE_SIZE.getWidth() - MARGIN, 29f);
                content.stroke();
                drawText(content, REGULAR, 7f, MUTED, MARGIN, 17f,
                        "Internal use - Generated by FX Backend");
                String pageNumber = "Page " + (index + 1) + " of " + pageCount;
                float textWidth = textWidth(REGULAR, 7f, pageNumber);
                drawText(content, REGULAR, 7f, MUTED, PAGE_SIZE.getWidth() - MARGIN - textWidth, 17f,
                        pageNumber);
            }
        }
    }

    private void drawText(PDPageContentStream content, PDFont font, float size, Color color,
                          float x, float y, String value) throws IOException {
        content.beginText();
        content.setFont(font, size);
        content.setNonStrokingColor(color);
        content.newLineAtOffset(x, y);
        content.showText(ascii(value));
        content.endText();
    }

    private String fit(PDFont font, float size, String value, float maxWidth) throws IOException {
        String text = ascii(value);
        if (textWidth(font, size, text) <= maxWidth) {
            return text;
        }
        String suffix = "...";
        int end = text.length();
        while (end > 0 && textWidth(font, size, text.substring(0, end) + suffix) > maxWidth) {
            end--;
        }
        return end == 0 ? "" : text.substring(0, end) + suffix;
    }

    private float textWidth(PDFont font, float size, String value) throws IOException {
        return font.getStringWidth(ascii(value)) / 1000f * size;
    }

    private float totalWeight(List<ReportDocument.ReportColumn> columns) {
        return (float) columns.stream().mapToDouble(ReportDocument.ReportColumn::weight).sum();
    }

    private String ascii(String value) {
        if (value == null) {
            return "";
        }
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFKD)
                .replaceAll("\\p{M}+", "")
                .replaceAll("[\\r\\n\\t]+", " ");
        StringBuilder result = new StringBuilder(normalized.length());
        for (int index = 0; index < normalized.length(); index++) {
            char character = normalized.charAt(index);
            result.append(character >= 32 && character <= 126 ? character : '?');
        }
        return result.toString();
    }
}
