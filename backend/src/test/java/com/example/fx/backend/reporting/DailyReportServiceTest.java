package com.example.fx.backend.reporting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.example.fx.backend.auth.model.FxUser;
import com.example.fx.backend.auth.model.Region;
import com.example.fx.backend.auth.model.UserLoginEvent;
import com.example.fx.backend.auth.model.UserType;
import com.example.fx.backend.auth.repository.FxUserRepository;
import com.example.fx.backend.auth.repository.UserLoginEventRepository;
import com.example.fx.backend.pricing.model.Trade;
import com.example.fx.backend.pricing.repository.LimitOrderRepository;
import com.example.fx.backend.pricing.repository.TradeRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class DailyReportServiceTest {
    private static final LocalDate REPORT_DATE = LocalDate.parse("2026-09-13");

    @Mock TradeRepository trades;
    @Mock LimitOrderRepository orders;
    @Mock FxUserRepository users;
    @Mock UserLoginEventRepository logins;

    private DailyReportService service;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(Instant.parse("2026-09-13T08:30:00Z"), ZoneOffset.UTC);
        service = new DailyReportService(trades, orders, users, logins, new PdfReportWriter(), clock,
                new DailyReportProperties(ZoneId.of("Asia/Singapore")));
    }

    @Test
    void generatesEverySupportedReportEvenWhenThereAreNoRows() throws Exception {
        when(trades.findByResponseAtGreaterThanEqualAndResponseAtLessThanOrderByResponseAtAsc(any(), any()))
                .thenReturn(List.of());
        when(orders.findByStatusAndClosedAtGreaterThanEqualAndClosedAtLessThanOrderByClosedAtAsc(
                any(), any(), any())).thenReturn(List.of());
        when(orders.findLiveAtEndOfDay(any(), any())).thenReturn(List.of());
        when(logins.findByLoggedAtGreaterThanEqualAndLoggedAtLessThanOrderByLoggedAtAsc(any(), any()))
                .thenReturn(List.of());
        when(users.findAllById(any())).thenReturn(List.of());

        for (DailyReportType type : DailyReportType.values()) {
            DailyReport report = service.generate(type.slug(), REPORT_DATE);
            assertThat(report.filename()).isEqualTo("fx-" + type.slug() + "-2026-09-13.pdf");
            assertThat(report.recordCount()).isZero();
            assertThat(report.content()).startsWith("%PDF-".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
        }
    }

    @Test
    void createsTradeAndUserActivityRowsFromDailyTrades() throws Exception {
        Trade first = trade("T-1", "alice", "EURUSD", "Acme", LocalDateTime.parse("2026-09-13T08:00:00"));
        Trade second = trade("T-2", "alice", "GBPUSD", "Globex", LocalDateTime.parse("2026-09-13T09:00:00"));
        when(trades.findByResponseAtGreaterThanEqualAndResponseAtLessThanOrderByResponseAtAsc(any(), any()))
                .thenReturn(List.of(first, second));

        DailyReport tradeReport = service.generate("trades", REPORT_DATE);
        DailyReport userReport = service.generate("users-traded", REPORT_DATE);

        assertThat(tradeReport.recordCount()).isEqualTo(2);
        assertThat(pdfText(tradeReport)).contains("T-1", "T-2", "alice");
        assertThat(userReport.recordCount()).isEqualTo(1);
        assertThat(pdfText(userReport)).contains("alice", "EURUSD, GBPUSD", "Acme, Globex");
    }

    @Test
    void aggregatesSuccessfulLoginEventsWithoutIncludingPasswords() throws Exception {
        UserLoginEvent first = login("L-1", "alice", "2026-09-13T08:00:00");
        UserLoginEvent second = login("L-2", "alice", "2026-09-13T09:00:00");
        FxUser user = new FxUser();
        user.setUsername("alice");
        user.setPassword("secret-value");
        user.setEmail("alice@example.com");
        user.setUserType(UserType.TRADER);
        user.setRegion(Region.SG);
        when(logins.findByLoggedAtGreaterThanEqualAndLoggedAtLessThanOrderByLoggedAtAsc(any(), any()))
                .thenReturn(List.of(first, second));
        when(users.findAllById(any())).thenReturn(List.of(user));

        DailyReport report = service.generate("users-logged-in", REPORT_DATE);

        assertThat(report.recordCount()).isEqualTo(1);
        assertThat(pdfText(report)).contains("alice", "alice@example.com", "2", "TRADER", "SG")
                .doesNotContain("secret-value");
    }

    @Test
    void rejectsUnknownAndFutureReports() {
        assertThatThrownBy(() -> service.generate("unknown", REPORT_DATE))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Unsupported report type");
        assertThatThrownBy(() -> service.generate("trades", REPORT_DATE.plusDays(1)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("cannot be in the future");
    }

    private Trade trade(String id, String trader, String pair, String customer, LocalDateTime bookedAt) {
        Trade trade = new Trade();
        trade.setId(id);
        trade.setTrader(trader);
        trade.setCcyPair(pair);
        trade.setCustomer(customer);
        trade.setBookedAt(bookedAt);
        trade.setResponseAt(bookedAt.atOffset(ZoneOffset.UTC));
        trade.setDirection("Buy");
        trade.setQty(1_000_000);
        trade.setDealtCurrency(pair.substring(0, 3));
        trade.setPrice(1.10234);
        trade.setTenor("SP");
        trade.setStatus("BOOKED");
        return trade;
    }

    private UserLoginEvent login(String id, String username, String loggedAt) {
        UserLoginEvent event = new UserLoginEvent();
        event.setId(id);
        event.setUsername(username);
        event.setLoggedAt(OffsetDateTime.parse(loggedAt + "Z"));
        return event;
    }

    private String pdfText(DailyReport report) throws Exception {
        try (PDDocument document = PDDocument.load(report.content())) {
            return new PDFTextStripper().getText(document);
        }
    }
}
