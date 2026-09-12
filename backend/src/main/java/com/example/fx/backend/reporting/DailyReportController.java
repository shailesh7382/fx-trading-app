package com.example.fx.backend.reporting;

import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reports/daily")
public class DailyReportController {
    private final DailyReportService reportService;

    public DailyReportController(DailyReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping(value = "/{reportType}", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> generate(
            @PathVariable String reportType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        DailyReport report = reportService.generate(reportType, date);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(report.content().length)
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(report.filename()).build().toString())
                .header("X-Report-Date", report.reportDate().toString())
                .header("X-Report-Record-Count", Integer.toString(report.recordCount()))
                .body(report.content());
    }
}
