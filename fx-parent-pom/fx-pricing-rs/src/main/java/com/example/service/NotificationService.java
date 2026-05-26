package com.example.service;

import com.example.WorkspaceNotification;
import com.example.WorkspaceNotificationResponse;
import com.example.model.FxPrice;
import com.example.model.LimitOrder;
import com.example.model.LimitOrderStatus;
import com.example.model.Trade;
import org.springframework.stereotype.Service;

import java.text.NumberFormat;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class NotificationService {

    private final TradeService tradeService;
    private final LimitOrderService limitOrderService;
    private final FxPriceService fxPriceService;
    private final Clock clock;

    public NotificationService(TradeService tradeService, LimitOrderService limitOrderService, FxPriceService fxPriceService, Clock clock) {
        this.tradeService = tradeService;
        this.limitOrderService = limitOrderService;
        this.fxPriceService = fxPriceService;
        this.clock = clock;
    }

    public WorkspaceNotificationResponse getNotifications(int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 25));
        LocalDateTime now = LocalDateTime.now(clock);

        List<WorkspaceNotification> notifications = new ArrayList<>();
        notifications.addAll(buildTradeNotifications(now));
        notifications.addAll(buildOrderNotifications(now));
        notifications.addAll(buildMarketCommentaryNotifications(now));

        List<WorkspaceNotification> visibleNotifications = notifications.stream()
                .sorted(Comparator.comparing(WorkspaceNotification::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(WorkspaceNotification::getId))
                .limit(safeLimit)
                .collect(Collectors.toList());

        WorkspaceNotificationResponse response = new WorkspaceNotificationResponse();
        response.setNotifications(visibleNotifications);
        response.setUnreadCount((int) visibleNotifications.stream().filter(WorkspaceNotification::isUnread).count());
        response.setGeneratedAt(now);
        return response;
    }

    private List<WorkspaceNotification> buildTradeNotifications(LocalDateTime now) {
        return tradeService.getTrades().stream()
                .limit(10)
                .map(trade -> toTradeNotification(trade, now))
                .collect(Collectors.toList());
    }

    private List<WorkspaceNotification> buildOrderNotifications(LocalDateTime now) {
        return limitOrderService.getOrders("ALL", null).stream()
                .filter(order -> order.getStatus() != LimitOrderStatus.EXECUTED)
                .limit(10)
                .map(order -> toOrderNotification(order, now))
                .collect(Collectors.toList());
    }

    private List<WorkspaceNotification> buildMarketCommentaryNotifications(LocalDateTime now) {
        List<FxPrice> displayPrices = new ArrayList<>(compressLatestPrices(fxPriceService.getAllPrices()).values());
        if (displayPrices.isEmpty()) {
            return List.of();
        }

        List<WorkspaceNotification> notifications = new ArrayList<>();
        FxPrice widestSpread = displayPrices.stream()
                .max(Comparator.comparingDouble(this::getSpreadPips))
                .orElse(null);
        FxPrice deepestLiquidity = displayPrices.stream()
                .max(Comparator.comparingDouble(FxPrice::getQty))
                .orElse(null);

        if (widestSpread != null) {
            notifications.add(buildMarketNotification(
                    "MARKET-SPREAD-" + instrumentKey(widestSpread),
                    widestSpread.getCcyPair() + " shows the widest live spread",
                    widestSpread.getTenorLabel() + " spread is " + formatSpread(widestSpread) + " across " + formatQuantity(widestSpread.getQty())
                            + " with " + defaultText(widestSpread.getSource() == null ? null : widestSpread.getSource().name(), "STREAM") + " pricing.",
                    widestSpread,
                    getSpreadPips(widestSpread) >= 5 ? "warning" : "info",
                    now
            ));
        }

        if (deepestLiquidity != null) {
            notifications.add(buildMarketNotification(
                    "MARKET-LIQUIDITY-" + instrumentKey(deepestLiquidity),
                    deepestLiquidity.getCcyPair() + " carries the deepest displayed size",
                    deepestLiquidity.getTenorLabel() + " liquidity shows " + formatQuantity(deepestLiquidity.getQty())
                            + " available at " + formatRate(deepestLiquidity.getBid()) + " / " + formatRate(deepestLiquidity.getAsk()) + ".",
                    deepestLiquidity,
                    "info",
                    now
            ));
        }

        return notifications;
    }

    private WorkspaceNotification toTradeNotification(Trade trade, LocalDateTime now) {
        boolean limitExecution = "LIMIT".equalsIgnoreCase(trade.getExecutionType());
        WorkspaceNotification notification = new WorkspaceNotification();
        notification.setId((limitExecution ? "ORDER-EXEC-" : "TRADE-") + defaultText(trade.getId(), String.valueOf(System.nanoTime())));
        notification.setCategory(limitExecution ? "ORDER_EXECUTION" : "TRADE");
        notification.setSeverity(limitExecution ? "success" : "info");
        notification.setTitle(limitExecution
                ? defaultText(trade.getCcyPair(), "Trade") + " limit order executed"
                : defaultText(trade.getCcyPair(), "Trade") + " trade booked");
        notification.setMessage(defaultText(trade.getDirection(), "Buy") + " "
                + formatQuantity(trade.getQty()) + " "
                + defaultText(trade.getDealtCurrency(), defaultText(trade.getCcyPair(), ""))
                + " at " + formatRate(trade.getPrice())
                + " · Trader " + defaultText(trade.getTrader(), "system"));
        notification.setSource(limitExecution ? "Execution engine" : "Trade capture");
        notification.setRelatedId(limitExecution ? defaultText(trade.getLimitOrderId(), trade.getId()) : trade.getId());
        LocalDateTime eventTime = trade.getBookedAt() != null ? trade.getBookedAt() : now;
        notification.setCreatedAt(eventTime);
        notification.setUnread(eventTime.isAfter(now.minusHours(12)));
        return notification;
    }

    private WorkspaceNotification toOrderNotification(LimitOrder order, LocalDateTime now) {
        WorkspaceNotification notification = new WorkspaceNotification();
        notification.setId("ORDER-" + defaultText(order.getId(), String.valueOf(System.nanoTime())) + "-" + order.getStatus());
        notification.setCategory("ORDER_STATUS");
        notification.setSeverity(resolveOrderSeverity(order.getStatus()));
        notification.setTitle(defaultText(order.getCcyPair(), "Limit order") + " " + resolveOrderHeadline(order.getStatus()));
        notification.setMessage(defaultText(order.getDirection(), "Buy") + " "
                + formatQuantity(order.getQty()) + " "
                + defaultText(order.getDealtCurrency(), defaultText(order.getCcyPair(), ""))
                + " target " + formatRate(order.getLimitPrice())
                + " · " + (order.getTimeInForce() == null || "GTC".equalsIgnoreCase(order.getTimeInForce().name()) ? "Until cancelled" : "Today only"));
        notification.setSource("Order management");
        notification.setRelatedId(order.getId());
        LocalDateTime eventTime = order.getExecutedAt() != null ? order.getExecutedAt() : order.getSubmittedAt();
        notification.setCreatedAt(eventTime != null ? eventTime : now.minusDays(1));
        notification.setUnread(notification.getCreatedAt().isAfter(now.minusHours(12)));
        return notification;
    }

    private WorkspaceNotification buildMarketNotification(
            String id,
            String title,
            String message,
            FxPrice price,
            String severity,
            LocalDateTime now
    ) {
        WorkspaceNotification notification = new WorkspaceNotification();
        notification.setId(id);
        notification.setCategory("MARKET_COMMENTARY");
        notification.setSeverity(severity);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setSource("Market commentary");
        notification.setRelatedId(instrumentKey(price));
        LocalDateTime eventTime = price.getUpdatedAt() != null ? price.getUpdatedAt() : now;
        notification.setCreatedAt(eventTime);
        notification.setUnread(eventTime.isAfter(now.minusMinutes(30)));
        return notification;
    }

    private Map<String, FxPrice> compressLatestPrices(List<FxPrice> prices) {
        return prices.stream().collect(Collectors.toMap(
                this::instrumentKey,
                price -> price,
                this::pickDisplayPrice,
                LinkedHashMap::new
        ));
    }

    private FxPrice pickDisplayPrice(FxPrice left, FxPrice right) {
        Comparator<FxPrice> comparator = Comparator
                .comparing(FxPrice::getUpdatedAt, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(FxPrice::getQty, Comparator.reverseOrder());
        return comparator.compare(left, right) >= 0 ? left : right;
    }

    private double getSpreadPips(FxPrice price) {
        double multiplier = price.getBid() > 20 ? 100 : 10000;
        return Math.abs(price.getAsk() - price.getBid()) * multiplier;
    }

    private String formatSpread(FxPrice price) {
        return String.format(Locale.US, "%.1f pips", getSpreadPips(price));
    }

    private String formatQuantity(double qty) {
        return NumberFormat.getIntegerInstance(Locale.US).format(Math.round(qty));
    }

    private String formatRate(double value) {
        return String.format(Locale.US, value > 20 ? "%.3f" : "%.5f", value);
    }

    private String resolveOrderHeadline(LimitOrderStatus status) {
        if (status == LimitOrderStatus.CANCELLED) {
            return "limit order cancelled";
        }
        if (status == LimitOrderStatus.EXPIRED) {
            return "limit order expired";
        }
        return "limit order working";
    }

    private String resolveOrderSeverity(LimitOrderStatus status) {
        if (status == LimitOrderStatus.EXPIRED) {
            return "warning";
        }
        if (status == LimitOrderStatus.CANCELLED) {
            return "info";
        }
        return "primary";
    }

    private String instrumentKey(FxPrice price) {
        return defaultText(price.getCcyPair(), "UNKNOWN") + "-" + defaultText(price.getTenorLabel(), "SP");
    }

    private String defaultText(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }
}

