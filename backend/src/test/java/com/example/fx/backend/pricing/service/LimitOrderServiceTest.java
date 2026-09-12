package com.example.fx.backend.pricing.service;

import com.example.fx.backend.pricing.dto.LimitOrderAmendRequest;
import com.example.fx.backend.pricing.dto.LimitOrderRequest;
import com.example.fx.backend.pricing.model.LimitOrder;
import com.example.fx.backend.pricing.model.LimitOrderStatus;
import com.example.fx.backend.pricing.repository.LimitOrderRepository;
import com.example.fx.backend.simulator.SimulatorClientProperties;
import com.example.fx.backend.simulator.SimulatorGateway;
import com.example.fx.backend.support.SequentialIdGenerator;
import com.example.fx.simulator.api.model.CallbackStatus;
import com.example.fx.simulator.api.model.RestingOrderAmendRequest;
import com.example.fx.simulator.api.model.RestingOrderTriggeredEvent;
import com.example.fx.simulator.api.model.Side;
import com.example.fx.simulator.api.model.Tenor;
import java.math.BigDecimal;
import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LimitOrderServiceTest {
    @Mock LimitOrderRepository repository;
    @Mock SimulatorGateway simulator;
    @Mock TradeService trades;
    @Mock SequentialIdGenerator idGenerator;
    private LimitOrderService service;
    private final OffsetDateTime now = OffsetDateTime.parse("2026-09-08T08:00:00Z");

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(Instant.parse("2026-09-08T08:00:00Z"), ZoneOffset.UTC);
        service = new LimitOrderService(repository, simulator, properties(), trades, clock, idGenerator);
        lenient().when(idGenerator.generate()).thenReturn("B00000001");
        lenient().when(repository.save(any(LimitOrder.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void placesAndAmendsUsingTheGeneratedRestingOrderContract() {
        when(simulator.placeRestingOrder(any())).thenAnswer(invocation -> {
            com.example.fx.simulator.api.model.RestingOrderRequest input = invocation.getArgument(0);
            return remote(input.getOrderId(), input.getRequestId(), input.getQuantity(), input.getLimitPrice());
        });
        LimitOrderRequest input = new LimitOrderRequest();
        input.setRequestId("place-request");
        input.setCcyPair("EURUSD");
        input.setTenor("1M");
        input.setQty(1_000_000);
        input.setDirection("Buy");
        input.setDealtCurrency("EUR");
        input.setLimitPrice(1.09);
        input.setTimeInForce("GTC");
        input.setTrader("alice");

        LimitOrder placed = service.submitLimitOrder(input);
        assertThat(placed.getStatus()).isEqualTo(LimitOrderStatus.ACTIVE);
        assertThat(placed.getId()).isEqualTo("B00000001");
        assertThat(placed.getOriginalRequestId()).isEqualTo("place-request");
        assertThat(placed.getCallbackStatus()).isEqualTo("NOT_REQUIRED");

        when(repository.findById(placed.getId())).thenReturn(Optional.of(placed));
        when(simulator.amendRestingOrder(eq(placed.getId()), any())).thenAnswer(invocation -> {
            RestingOrderAmendRequest amendment = invocation.getArgument(1);
            return remote(placed.getId(), amendment.getRequestId(), amendment.getQuantity(), amendment.getLimitPrice());
        });
        LimitOrderAmendRequest amendment = new LimitOrderAmendRequest();
        amendment.setQty(2_000_000);
        amendment.setLimitPrice(1.08);
        amendment.setTimeInForce("GTD");
        amendment.setGoodTillDate(LocalDate.parse("2026-09-08"));

        LimitOrder amended = service.amendLimitOrder(placed.getId(), amendment);
        ArgumentCaptor<RestingOrderAmendRequest> captured = ArgumentCaptor.forClass(RestingOrderAmendRequest.class);
        verify(simulator).amendRestingOrder(eq(placed.getId()), captured.capture());
        assertThat(captured.getValue().getTimeInForce())
                .isEqualTo(com.example.fx.simulator.api.model.TimeInForce.GOOD_TILL_TIME);
        assertThat(captured.getValue().getExpiresAt()).isAfter(now);
        assertThat(amended.getQty()).isEqualTo(2_000_000);
    }

    @Test
    void deduplicatesTriggeredCallbacksAndReconcilesTheBookedTrade() {
        LimitOrder order = new LimitOrder();
        order.setId("ORD-1");
        order.setStatus(LimitOrderStatus.ACTIVE);
        order.setChannel("WEB");
        order.setSegment("C");
        order.setCustomerId("0000123456");
        order.setTenor("SP");
        when(repository.findById("ORD-1")).thenReturn(Optional.of(order));
        UUID eventId = UUID.randomUUID();
        UUID tradeId = UUID.randomUUID();
        RestingOrderTriggeredEvent event = new RestingOrderTriggeredEvent()
                .eventId(eventId).eventType("TRIGGERED").occurredAt(now).attempt(1).orderId("ORD-1")
                .originalRequestId("place").channel("WEB").segment("C").customerId("0000123456")
                .currencyPair("EURUSD").quantity(new BigDecimal("1000000")).quantityCurrency("EUR")
                .tenor(Tenor.SPOT).side(Side.BUY).limitPrice(new BigDecimal("1.1"))
                .status(com.example.fx.simulator.api.model.RestingOrderStatus.TRIGGERED)
                .tradeId(tradeId).coverPrice(new BigDecimal("1.09")).clientPrice(new BigDecimal("1.091"))
                .swapPoints(BigDecimal.ZERO).buyCurrency("EUR").buyQuantity(new BigDecimal("1000000"))
                .sellCurrency("USD").sellQuantity(new BigDecimal("1091000"))
                .spotDate(LocalDate.parse("2026-09-10")).valueDate(LocalDate.parse("2026-09-10"));

        service.receiveEvent(event);
        service.receiveEvent(event);

        assertThat(order.getStatus()).isEqualTo(LimitOrderStatus.EXECUTED);
        assertThat(order.getSimulatorTradeId()).isEqualTo(tradeId.toString());
        verify(trades, times(1)).reconcileBooking(eq(tradeId), anyString(), eq("WEB"), eq("C"),
                eq("0000123456"), any(), eq("LIMIT"), eq("ORD-1"));
        verify(repository, times(1)).save(order);
    }

    @Test
    void reconcilesTerminalOrdersUntilCallbackDeliveryIsSettled() {
        LimitOrder order = new LimitOrder();
        order.setId("ORD-PENDING");
        order.setStatus(LimitOrderStatus.EXECUTED);
        order.setCallbackStatus(CallbackStatus.PENDING.getValue());
        order.setChannel("WEB");
        order.setSegment("C");
        order.setCustomerId("0000123456");
        UUID tradeId = UUID.randomUUID();
        com.example.fx.simulator.api.model.RestingOrder delivered = remote(
                        order.getId(), "status-request", new BigDecimal("1000000"), new BigDecimal("1.1"))
                .status(com.example.fx.simulator.api.model.RestingOrderStatus.TRIGGERED)
                .closedAt(now)
                .lastEvaluatedAt(now)
                .lastEvaluatedPrice(new BigDecimal("1.091"))
                .tradeId(tradeId)
                .callbackStatus(CallbackStatus.DELIVERED)
                .callbackAttempts(1);
        when(repository.findByStatusOrderBySubmittedAtDesc(LimitOrderStatus.ACTIVE)).thenReturn(List.of());
        when(repository.findByCallbackStatusOrderBySubmittedAtDesc(CallbackStatus.PENDING.getValue()))
                .thenReturn(List.of(order));
        when(repository.findAllByOrderBySubmittedAtDesc()).thenReturn(List.of(order));
        when(simulator.getRestingOrder(eq(order.getId()), anyString(), eq("WEB"), eq("C"), eq("0000123456")))
                .thenReturn(delivered);

        List<LimitOrder> result = service.getOrders("ALL", null);

        assertThat(result).containsExactly(order);
        assertThat(order.getCallbackStatus()).isEqualTo(CallbackStatus.DELIVERED.getValue());
        assertThat(order.getCallbackAttempts()).isEqualTo(1);
        verify(trades).reconcileBooking(eq(tradeId), anyString(), eq("WEB"), eq("C"),
                eq("0000123456"), any(), eq("LIMIT"), eq("ORD-PENDING"));
    }

    @Test
    void skipsReconciliationForOrdersWithIncompleteRequestContext() {
        LimitOrder order = new LimitOrder();
        order.setId("ORD-INCOMPLETE");
        order.setStatus(LimitOrderStatus.ACTIVE);
        when(repository.findByStatusOrderBySubmittedAtDesc(LimitOrderStatus.ACTIVE)).thenReturn(List.of(order));
        when(repository.findByCallbackStatusOrderBySubmittedAtDesc(CallbackStatus.PENDING.getValue()))
                .thenReturn(List.of());
        when(repository.findAllByOrderBySubmittedAtDesc()).thenReturn(List.of(order));

        List<LimitOrder> result = service.getOrders("ALL", null);

        assertThat(result).containsExactly(order);
        verifyNoInteractions(simulator);
    }

    private com.example.fx.simulator.api.model.RestingOrder remote(
            String orderId, String requestId, BigDecimal quantity, BigDecimal limitPrice) {
        return new com.example.fx.simulator.api.model.RestingOrder()
                .requestId(requestId).channel("WEB").segment("C").customerId("0000123456")
                .originalRequestId("place-request").responseId(UUID.randomUUID()).responseAt(now)
                .orderId(orderId).currencyPair("EURUSD").quantity(quantity).quantityCurrency("EUR")
                .tenor(Tenor.ONE_MONTH).side(Side.BUY).limitPrice(limitPrice)
                .timeInForce(com.example.fx.simulator.api.model.TimeInForce.GOOD_TILL_CANCELLED)
                .status(com.example.fx.simulator.api.model.RestingOrderStatus.WORKING).placedAt(now)
                .callbackUrl("http://localhost:8080/api/resting-orders/events")
                .callbackStatus(CallbackStatus.NOT_REQUIRED).callbackAttempts(0);
    }

    private SimulatorClientProperties properties() {
        return new SimulatorClientProperties(URI.create("http://localhost:8090"), Duration.ofSeconds(2),
                Duration.ofSeconds(5), "WEB", "C", "0000123456",
                URI.create("http://localhost:8080/api/resting-orders/events"),
                new BigDecimal("1000000"), List.of("EURUSD"));
    }
}
