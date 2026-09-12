package com.example.fx.backend.reporting;

import com.example.fx.backend.auth.model.FxUser;
import com.example.fx.backend.auth.model.UserLoginEvent;
import com.example.fx.backend.auth.repository.FxUserRepository;
import com.example.fx.backend.auth.repository.UserLoginEventRepository;
import com.example.fx.backend.pricing.model.LimitOrder;
import com.example.fx.backend.pricing.model.LimitOrderStatus;
import com.example.fx.backend.pricing.model.Trade;
import com.example.fx.backend.pricing.repository.LimitOrderRepository;
import com.example.fx.backend.pricing.repository.TradeRepository;
import com.example.fx.backend.reporting.ReportDocument.ReportColumn;
import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DailyReportService {
    private static final Logger LOG = LoggerFactory.getLogger(DailyReportService.class);
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("uuuu-MM-dd HH:mm:ss");

    private final TradeRepository tradeRepository;
    private final LimitOrderRepository limitOrderRepository;
    private final FxUserRepository userRepository;
    private final UserLoginEventRepository loginEventRepository;
    private final PdfReportWriter pdfWriter;
    private final Clock clock;
    private final DailyReportProperties properties;

    public DailyReportService(TradeRepository tradeRepository, LimitOrderRepository limitOrderRepository,
                              FxUserRepository userRepository, UserLoginEventRepository loginEventRepository,
                              PdfReportWriter pdfWriter, Clock clock, DailyReportProperties properties) {
        this.tradeRepository = tradeRepository;
        this.limitOrderRepository = limitOrderRepository;
        this.userRepository = userRepository;
        this.loginEventRepository = loginEventRepository;
        this.pdfWriter = pdfWriter;
        this.clock = clock;
        this.properties = properties;
    }

    @Transactional(readOnly = true)
    public DailyReport generate(String reportType, LocalDate requestedDate) {
        DailyReportType type;
        try {
            type = DailyReportType.fromSlug(reportType);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, exception.getMessage(), exception);
        }

        LocalDate today = LocalDate.ofInstant(clock.instant(), properties.zoneId());
        LocalDate reportDate = requestedDate == null ? today : requestedDate;
        if (reportDate.isAfter(today)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A daily report date cannot be in the future.");
        }

        OffsetDateTime start = reportDate.atStartOfDay(properties.zoneId()).toOffsetDateTime();
        OffsetDateTime end = reportDate.plusDays(1).atStartOfDay(properties.zoneId()).toOffsetDateTime();
        ReportDocument document = switch (type) {
            case EXECUTED_ORDERS -> executedOrders(reportDate, start, end);
            case TRADES -> trades(reportDate, start, end);
            case USERS_LOGGED_IN -> usersLoggedIn(reportDate, start, end);
            case USERS_TRADED -> usersTraded(reportDate, start, end);
            case LIVE_ORDERS -> liveOrders(reportDate, end);
        };

        try {
            byte[] content = pdfWriter.write(document);
            String filename = "fx-" + type.slug() + "-" + reportDate + ".pdf";
            LOG.info("Daily report generated type={} date={} records={} bytes={}",
                    type.slug(), reportDate, document.rows().size(), content.length);
            return new DailyReport(content, filename, reportDate, document.rows().size());
        } catch (IOException exception) {
            LOG.error("Could not generate daily report type={} date={}", type.slug(), reportDate, exception);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "The PDF report could not be generated.", exception);
        }
    }

    private ReportDocument executedOrders(LocalDate date, OffsetDateTime start, OffsetDateTime end) {
        List<LimitOrder> orders = limitOrderRepository
                .findByStatusAndClosedAtGreaterThanEqualAndClosedAtLessThanOrderByClosedAtAsc(
                        LimitOrderStatus.EXECUTED, start, end);
        List<ReportColumn> columns = List.of(
                column("Order ID", 1.45f), column("Executed At", 1.25f), column("Pair", .65f),
                column("Side", .6f), column("Quantity", .9f), column("Currency", .7f),
                column("Limit", .8f), column("Executed", .8f), column("Trader", .9f),
                column("Trade ID", 1.5f));
        List<List<String>> rows = orders.stream().map(order -> List.of(
                text(order.getId()), dateTime(order.getClosedAt()), text(order.getCcyPair()),
                text(order.getDirection()), quantity(order.getQty()), text(order.getDealtCurrency()),
                price(order.getLimitPrice()), price(order.getExecutedPrice()), text(order.getTrader()),
                text(order.getTradingSystemTradeId()))).toList();
        return document(DailyReportType.EXECUTED_ORDERS, date, columns, rows);
    }

    private ReportDocument trades(LocalDate date, OffsetDateTime start, OffsetDateTime end) {
        List<Trade> trades = dailyTrades(start, end);
        List<ReportColumn> columns = List.of(
                column("Trade ID", 1.6f), column("Booked At", 1.25f), column("Pair", .65f),
                column("Side", .6f), column("Quantity", .9f), column("Currency", .7f),
                column("Price", .8f), column("Tenor", .55f), column("Trader", .9f),
                column("Status", .7f));
        List<List<String>> rows = trades.stream().map(trade -> List.of(
                text(trade.getId()), dateTime(trade.getResponseAt()), text(trade.getCcyPair()),
                text(trade.getDirection()), quantity(trade.getQty()), text(trade.getDealtCurrency()),
                price(trade.getPrice()), text(trade.getTenor()), text(trade.getTrader()),
                text(trade.getStatus()))).toList();
        return document(DailyReportType.TRADES, date, columns, rows);
    }

    private ReportDocument usersLoggedIn(LocalDate date, OffsetDateTime start, OffsetDateTime end) {
        List<UserLoginEvent> events = loginEventRepository
                .findByLoggedAtGreaterThanEqualAndLoggedAtLessThanOrderByLoggedAtAsc(start, end);
        Map<String, List<UserLoginEvent>> eventsByUser = events.stream().collect(Collectors.groupingBy(
                UserLoginEvent::getUsername, LinkedHashMap::new, Collectors.toList()));
        Map<String, FxUser> users = userRepository.findAllById(eventsByUser.keySet()).stream()
                .collect(Collectors.toMap(FxUser::getUsername, user -> user));

        List<ReportColumn> columns = List.of(
                column("Username", 1.1f), column("User Type", .9f), column("Region", .7f),
                column("Email", 1.6f), column("Logins", .55f), column("First Login", 1.25f),
                column("Last Login", 1.25f));
        List<List<String>> rows = eventsByUser.entrySet().stream().map(entry -> {
            List<UserLoginEvent> userEvents = entry.getValue();
            FxUser user = users.get(entry.getKey());
            return List.of(entry.getKey(), user == null ? "" : text(user.getUserType()),
                    user == null ? "" : text(user.getRegion()), user == null ? "" : text(user.getEmail()),
                    Integer.toString(userEvents.size()), dateTime(userEvents.get(0).getLoggedAt()),
                    dateTime(userEvents.get(userEvents.size() - 1).getLoggedAt()));
        }).toList();
        return document(DailyReportType.USERS_LOGGED_IN, date, columns, rows);
    }

    private ReportDocument usersTraded(LocalDate date, OffsetDateTime start, OffsetDateTime end) {
        Map<String, List<Trade>> tradesByUser = dailyTrades(start, end).stream().collect(Collectors.groupingBy(
                trade -> nonBlank(trade.getTrader(), "system"), LinkedHashMap::new, Collectors.toList()));
        List<Map.Entry<String, List<Trade>>> activity = new ArrayList<>(tradesByUser.entrySet());
        activity.sort(Comparator.<Map.Entry<String, List<Trade>>>comparingInt(entry -> entry.getValue().size())
                .reversed().thenComparing(Map.Entry::getKey));

        List<ReportColumn> columns = List.of(
                column("Trader", 1.1f), column("Trades", .55f), column("Currency Pairs", 1.5f),
                column("Customers", 1.7f), column("First Trade", 1.25f), column("Last Trade", 1.25f));
        List<List<String>> rows = activity.stream().map(entry -> {
            List<Trade> userTrades = entry.getValue();
            Set<String> pairs = values(userTrades, Trade::getCcyPair);
            Set<String> customers = values(userTrades, Trade::getCustomer);
            return List.of(entry.getKey(), Integer.toString(userTrades.size()), String.join(", ", pairs),
                    String.join(", ", customers), dateTime(userTrades.get(0).getResponseAt()),
                    dateTime(userTrades.get(userTrades.size() - 1).getResponseAt()));
        }).toList();
        return document(DailyReportType.USERS_TRADED, date, columns, rows);
    }

    private ReportDocument liveOrders(LocalDate date, OffsetDateTime end) {
        List<LimitOrder> orders = limitOrderRepository.findLiveAtEndOfDay(end, LimitOrderStatus.ACTIVE);
        List<ReportColumn> columns = List.of(
                column("Order ID", 1.45f), column("Submitted At", 1.25f), column("Pair", .65f),
                column("Side", .6f), column("Quantity", .9f), column("Currency", .7f),
                column("Limit", .8f), column("TIF", .5f), column("Good Till", .8f),
                column("Trader", .9f));
        List<List<String>> rows = orders.stream().map(order -> List.of(
                text(order.getId()), dateTime(order.getResponseAt()), text(order.getCcyPair()),
                text(order.getDirection()), quantity(order.getQty()), text(order.getDealtCurrency()),
                price(order.getLimitPrice()), text(order.getTimeInForce()), text(order.getGoodTillDate()),
                text(order.getTrader()))).toList();
        return document(DailyReportType.LIVE_ORDERS, date, columns, rows);
    }

    private List<Trade> dailyTrades(OffsetDateTime start, OffsetDateTime end) {
        return tradeRepository.findByResponseAtGreaterThanEqualAndResponseAtLessThanOrderByResponseAtAsc(start, end);
    }

    private ReportDocument document(DailyReportType type, LocalDate date, List<ReportColumn> columns,
                                    List<List<String>> rows) {
        return new ReportDocument(type.title() + " Daily Report", date, properties.zoneId().getId(),
                Instant.now(clock), columns, rows);
    }

    private ReportColumn column(String heading, float weight) {
        return new ReportColumn(heading, weight);
    }

    private String text(Object value) {
        return value == null ? "" : value.toString();
    }

    private String nonBlank(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private String dateTime(OffsetDateTime value) {
        return value == null ? "" : DATE_TIME.format(value.atZoneSameInstant(properties.zoneId()));
    }

    private String quantity(double value) {
        return String.format(Locale.ROOT, "%,.2f", value);
    }

    private String price(Double value) {
        return value == null ? "" : String.format(Locale.ROOT, "%.5f", value);
    }

    private Set<String> values(List<Trade> trades, java.util.function.Function<Trade, String> extractor) {
        return trades.stream().map(extractor).filter(value -> value != null && !value.isBlank())
                .collect(Collectors.toCollection(TreeSet::new));
    }
}
