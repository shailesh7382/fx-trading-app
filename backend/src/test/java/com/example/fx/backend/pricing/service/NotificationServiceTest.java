package com.example.fx.backend.pricing.service;

import com.example.fx.backend.pricing.dto.FxPriceDTO;
import com.example.fx.backend.pricing.dto.WorkspaceNotificationResponse;
import com.example.fx.backend.pricing.model.LimitOrder;
import com.example.fx.backend.pricing.model.LimitOrderStatus;
import com.example.fx.backend.pricing.model.TimeInForce;
import com.example.fx.backend.pricing.model.Trade;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {
    @Mock TradeService trades;
    @Mock LimitOrderService orders;
    @Mock FxPriceService prices;
    @Mock FxPriceDTO price;
    private NotificationService service;

    @BeforeEach
    void setUp() {
        service = new NotificationService(trades, orders, prices,
                Clock.fixed(Instant.parse("2026-05-26T08:00:00Z"), ZoneOffset.UTC));
    }

    @Test
    void buildsNotificationsFromTradingSystemTradesOrdersAndQuotes() {
        Trade trade = new Trade();
        trade.setId("trade-1");
        trade.setCcyPair("EURUSD");
        trade.setDirection("Buy");
        trade.setQty(1_000_000);
        trade.setDealtCurrency("EUR");
        trade.setPrice(1.08321);
        trade.setExecutionType("MARKET");
        trade.setBookedAt(LocalDateTime.parse("2026-05-26T07:55:00"));
        LimitOrder order = new LimitOrder();
        order.setId("order-1");
        order.setCcyPair("GBPUSD");
        order.setDirection("Sell");
        order.setQty(2_000_000);
        order.setDealtCurrency("GBP");
        order.setLimitPrice(1.27410);
        order.setStatus(LimitOrderStatus.ACTIVE);
        order.setTimeInForce(TimeInForce.GTC);
        order.setSubmittedAt(LocalDateTime.parse("2026-05-26T07:50:00"));
        when(price.getCcyPair()).thenReturn("USDJPY");
        when(price.getTenor()).thenReturn("SP");
        when(price.getBid()).thenReturn(new BigDecimal("156.281"));
        when(price.getAsk()).thenReturn(new BigDecimal("156.309"));
        when(price.getQty()).thenReturn(new BigDecimal("5000000"));
        when(price.getSource()).thenReturn("TRADING_SYSTEM");
        when(price.getUpdatedAt()).thenReturn(OffsetDateTime.parse("2026-05-26T07:59:00Z"));
        when(trades.getTrades()).thenReturn(List.of(trade));
        when(orders.getOrders("ALL", null)).thenReturn(List.of(order));
        when(prices.getAllPrices()).thenReturn(List.of(price));

        WorkspaceNotificationResponse response = service.getNotifications(12);

        assertThat(response.getNotifications()).hasSize(4);
        assertThat(response.getNotifications()).extracting(item -> item.getCategory())
                .contains("TRADE", "ORDER_STATUS", "MARKET_COMMENTARY");
    }
}
