package com.example.fx.backend.reporting;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class DailyReportControllerTest {
    @Mock DailyReportService service;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(new DailyReportController(service)).build();
    }

    @Test
    void returnsPdfBlobWithBatchFriendlyHeaders() throws Exception {
        byte[] pdf = "%PDF-sample".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        LocalDate date = LocalDate.parse("2026-09-13");
        when(service.generate("trades", date))
                .thenReturn(new DailyReport(pdf, "fx-trades-2026-09-13.pdf", date, 12));

        mvc.perform(get("/api/reports/daily/trades").queryParam("date", "2026-09-13"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/pdf"))
                .andExpect(content().bytes(pdf))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"fx-trades-2026-09-13.pdf\""))
                .andExpect(header().string("X-Report-Date", "2026-09-13"))
                .andExpect(header().string("X-Report-Record-Count", "12"))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"));
    }
}
