package com.example.service;

import com.example.WorkspaceNotificationResponse;
import com.example.Tenor;
import com.example.model.FxPrice;
import com.example.model.LimitOrder;
import com.example.model.LimitOrderStatus;
import com.example.model.Source;
import com.example.model.Status;
import com.example.model.TimeInForce;
import com.example.model.Trade;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private TradeService tradeService;

    @Mock
    private LimitOrderService limitOrderService;

    @Mock
    private FxPriceService fxPriceService;

    private NotificationService notificationService;

    @BeforeEach
    void setUp() {
        Clock fixedClock = Clock.fixed(Instant.parse("2026-05-26T08:00:00Z"), ZoneOffset.UTC);
        notificationService = new NotificationService(tradeService, limitOrderService, fxPriceService, fixedClock);
    }

    @Test
    void buildsNotificationsFromTradesOrdersAndMarketCommentary() {
        Trade trade = new Trade();
        trade.setId("FX-TEST-1");
        trade.setCcyPair("EURUSD");
        trade.setDirection("Buy");
        trade.setQty(1_000_000);
        trade.setDealtCurrency("EUR");
        trade.setPrice(1.08321);
        trade.setTrader("demo.trader");
        trade.setExecutionType("MARKET");
        trade.setBookedAt(LocalDateTime.parse("2026-05-26T07:55:00"));

        LimitOrder order = new LimitOrder();
        order.setId("LO-TEST-1");
        order.setCcyPair("GBPUSD");
        order.setDirection("Sell");
        order.setQty(2_000_000);
        order.setDealtCurrency("GBP");
        order.setLimitPrice(1.27410);
        order.setStatus(LimitOrderStatus.ACTIVE);
        order.setTimeInForce(TimeInForce.GTC);
        order.setSubmittedAt(LocalDateTime.parse("2026-05-26T07:50:00"));

        FxPrice price = new FxPrice(
                "USDJPY",
                156.281,
                156.309,
                0,
                0,
                Tenor.SP,
                LocalDateTime.parse("2026-05-26T07:59:00"),
                Source.AUTO,
                5_000_000,
                Status.ACTIVE
        );

        when(tradeService.getTrades()).thenReturn(List.of(trade));
        when(limitOrderService.getOrders("ALL", null)).thenReturn(List.of(order));
        when(fxPriceService.getAllPrices()).thenReturn(List.of(price));

        WorkspaceNotificationResponse response = notificationService.getNotifications(12);

        assertThat(response.getNotifications()).hasSize(4);
        assertThat(response.getUnreadCount()).isEqualTo(4);
        assertThat(response.getNotifications())
                .extracting(notification -> notification.getCategory())
                .contains("TRADE", "ORDER_STATUS", "MARKET_COMMENTARY");
        assertThat(response.getNotifications())
                .extracting(notification -> notification.getTitle())
                .anyMatch(title -> title.contains("trade booked"))
                .anyMatch(title -> title.contains("limit order working"))
                .anyMatch(title -> title.contains("widest live spread"));
    }

    @Test
    void respectsNotificationLimit() {
        Trade marketTrade = new Trade();
        marketTrade.setId("FX-TRADE-1");
        marketTrade.setCcyPair("EURUSD");
        marketTrade.setDirection("Buy");
        marketTrade.setQty(1_000_000);
        marketTrade.setDealtCurrency("EUR");
        marketTrade.setPrice(1.08321);
        marketTrade.setExecutionType("MARKET");
        marketTrade.setBookedAt(LocalDateTime.parse("2026-05-26T07:55:00"));

        Trade limitTrade = new Trade();
        limitTrade.setId("FX-TRADE-2");
        limitTrade.setLimitOrderId("LO-EXEC-1");
        limitTrade.setCcyPair("GBPUSD");
        limitTrade.setDirection("Sell");
        limitTrade.setQty(1_500_000);
        limitTrade.setDealtCurrency("GBP");
        limitTrade.setPrice(1.27401);
        limitTrade.setExecutionType("LIMIT");
        limitTrade.setBookedAt(LocalDateTime.parse("2026-05-26T07:56:00"));

        FxPrice price = new FxPrice(
                "USDJPY",
                156.281,
                156.309,
                0,
                0,
                Tenor.SP,
                LocalDateTime.parse("2026-05-26T07:59:00"),
                Source.AUTO,
                5_000_000,
                Status.ACTIVE
        );

        when(tradeService.getTrades()).thenReturn(List.of(limitTrade, marketTrade));
        when(limitOrderService.getOrders("ALL", null)).thenReturn(List.of());
        when(fxPriceService.getAllPrices()).thenReturn(List.of(price));

        WorkspaceNotificationResponse response = notificationService.getNotifications(2);

        assertThat(response.getNotifications()).hasSize(2);
    }
}

