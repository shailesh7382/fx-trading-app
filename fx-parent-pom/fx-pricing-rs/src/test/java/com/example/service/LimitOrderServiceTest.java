package com.example.service;

import com.example.LimitOrderAmendRequest;
import com.example.LimitOrderRequest;
import com.example.model.FxPrice;
import com.example.model.LimitOrder;
import com.example.model.LimitOrderStatus;
import com.example.model.Source;
import com.example.model.Status;
import com.example.model.TimeInForce;
import com.example.repository.FxPriceRepository;
import com.example.repository.LimitOrderRepository;
import com.example.Tenor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LimitOrderServiceTest {

    @Mock
    private LimitOrderRepository limitOrderRepository;

    @Mock
    private FxPriceRepository fxPriceRepository;

    @Mock
    private TradeService tradeService;

    private LimitOrderService limitOrderService;

    @BeforeEach
    void setUp() {
        Clock fixedClock = Clock.fixed(Instant.parse("2026-05-26T08:00:00Z"), ZoneOffset.UTC);
        limitOrderService = new LimitOrderService(limitOrderRepository, fxPriceRepository, tradeService, fixedClock);
        when(limitOrderRepository.findByStatusAndTimeInForceAndGoodTillDateBefore(any(LimitOrderStatus.class), any(TimeInForce.class), any(LocalDate.class)))
                .thenReturn(Collections.emptyList());
    }

    @Test
    void rejectsNonSpotLimitOrders() {
        LimitOrderRequest request = new LimitOrderRequest();
        request.setCcyPair("EURUSD");
        request.setTenor("1M");
        request.setQty(1_000_000);
        request.setDirection("Buy");
        request.setDealtCurrency("EUR");
        request.setLimitPrice(1.0831);
        request.setTimeInForce("GTC");

        assertThatThrownBy(() -> limitOrderService.submitLimitOrder(request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("spot instruments");
    }

    @Test
    void executesBuyOrderWhenAskTradesThroughLimit() {
        LimitOrder activeOrder = new LimitOrder();
        activeOrder.setId("LO-1");
        activeOrder.setCcyPair("EURUSD");
        activeOrder.setTenor("SP");
        activeOrder.setQty(1_000_000);
        activeOrder.setDirection("Buy");
        activeOrder.setDealtCurrency("EUR");
        activeOrder.setLimitPrice(1.08320);
        activeOrder.setStatus(LimitOrderStatus.ACTIVE);
        activeOrder.setTradeDate(LocalDate.parse("2026-05-26"));
        activeOrder.setSettlementDate(LocalDate.parse("2026-05-28"));

        when(limitOrderRepository.findByStatusAndCcyPairAndTenorOrderBySubmittedAtAsc(LimitOrderStatus.ACTIVE, "EURUSD", "SP"))
                .thenReturn(List.of(activeOrder));
        when(limitOrderRepository.save(any(LimitOrder.class))).thenAnswer(invocation -> invocation.getArgument(0));

        FxPrice executablePrice = new FxPrice(
                "EURUSD",
                1.08310,
                1.08318,
                0,
                0,
                Tenor.SP,
                LocalDateTime.parse("2026-05-26T08:00:00"),
                Source.AUTO,
                2_000_000,
                Status.ACTIVE
        );

        limitOrderService.evaluateTriggeredOrders("EURUSD", "SP", List.of(executablePrice));

        ArgumentCaptor<LimitOrder> orderCaptor = ArgumentCaptor.forClass(LimitOrder.class);
        verify(limitOrderRepository).save(orderCaptor.capture());
        verify(tradeService).bookExecutedLimitOrder(activeOrder, 1.08318);

        LimitOrder savedOrder = orderCaptor.getValue();
        assertThat(savedOrder.getStatus()).isEqualTo(LimitOrderStatus.EXECUTED);
        assertThat(savedOrder.getExecutedPrice()).isEqualTo(1.08318);
        assertThat(savedOrder.getExecutedAt()).isNotNull();
    }

    @Test
    void immediatelyExecutesNewSpotOrderWhenCurrentMarketAlreadyMatches() {
        LimitOrderRequest request = new LimitOrderRequest();
        request.setCcyPair("EURUSD");
        request.setTenor("SP");
        request.setQty(1_000_000);
        request.setDirection("Buy");
        request.setDealtCurrency("EUR");
        request.setLimitPrice(1.08320);
        request.setTimeInForce("GTC");

        FxPrice executablePrice = new FxPrice(
                "EURUSD",
                1.08310,
                1.08318,
                0,
                0,
                Tenor.SP,
                LocalDateTime.parse("2026-05-26T08:00:00"),
                Source.AUTO,
                2_000_000,
                Status.ACTIVE
        );

        AtomicReference<LimitOrder> savedOrderRef = new AtomicReference<>();

        when(limitOrderRepository.save(any(LimitOrder.class))).thenAnswer(invocation -> {
            LimitOrder savedOrder = invocation.getArgument(0);
            savedOrderRef.set(savedOrder);
            return savedOrder;
        });
        when(fxPriceRepository.findByCcyPairAndTenor("EURUSD", Tenor.SP)).thenReturn(List.of(executablePrice));
        when(limitOrderRepository.findByStatusAndCcyPairAndTenorOrderBySubmittedAtAsc(LimitOrderStatus.ACTIVE, "EURUSD", "SP"))
                .thenAnswer(invocation -> savedOrderRef.get() == null ? Collections.emptyList() : List.of(savedOrderRef.get()));
        when(limitOrderRepository.findById(anyString())).thenAnswer(invocation -> Optional.ofNullable(savedOrderRef.get()));

        LimitOrder submittedOrder = limitOrderService.submitLimitOrder(request);

        verify(tradeService).bookExecutedLimitOrder(any(LimitOrder.class), eq(1.08318));
        assertThat(submittedOrder.getId()).isNotBlank();
    }

    @Test
    void expiresPastGtdOrdersBeforeReturningCurrentOrders() {
        LimitOrder staleOrder = new LimitOrder();
        staleOrder.setId("LO-STALE");
        staleOrder.setStatus(LimitOrderStatus.ACTIVE);
        staleOrder.setTimeInForce(TimeInForce.GTD);
        staleOrder.setGoodTillDate(LocalDate.parse("2026-05-25"));

        when(limitOrderRepository.findByStatusAndTimeInForceAndGoodTillDateBefore(LimitOrderStatus.ACTIVE, TimeInForce.GTD, LocalDate.parse("2026-05-26")))
                .thenReturn(List.of(staleOrder));
        when(limitOrderRepository.findByStatusOrderBySubmittedAtDesc(LimitOrderStatus.ACTIVE)).thenReturn(Collections.emptyList());

        List<LimitOrder> currentOrders = limitOrderService.getCurrentOrders();

        assertThat(currentOrders).isEmpty();
        assertThat(staleOrder.getStatus()).isEqualTo(LimitOrderStatus.EXPIRED);
        verify(limitOrderRepository).saveAll(List.of(staleOrder));
        verify(tradeService, never()).bookExecutedLimitOrder(any(LimitOrder.class), any(Double.class));
    }

    @Test
    void cancelsActiveLimitOrder() {
        LimitOrder activeOrder = new LimitOrder();
        activeOrder.setId("LO-CANCEL");
        activeOrder.setStatus(LimitOrderStatus.ACTIVE);

        when(limitOrderRepository.findById("LO-CANCEL")).thenReturn(Optional.of(activeOrder));
        when(limitOrderRepository.save(activeOrder)).thenReturn(activeOrder);

        LimitOrder cancelledOrder = limitOrderService.cancelLimitOrder("LO-CANCEL");

        assertThat(cancelledOrder.getStatus()).isEqualTo(LimitOrderStatus.CANCELLED);
        verify(limitOrderRepository).save(activeOrder);
    }

    @Test
    void amendsActiveOrderAndExecutesIfNewPriceIsMarketable() {
        LimitOrder activeOrder = new LimitOrder();
        activeOrder.setId("LO-AMEND");
        activeOrder.setStatus(LimitOrderStatus.ACTIVE);
        activeOrder.setCcyPair("EURUSD");
        activeOrder.setTenor("SP");
        activeOrder.setDirection("Buy");
        activeOrder.setQty(1_000_000);
        activeOrder.setLimitPrice(1.08300);
        activeOrder.setTimeInForce(TimeInForce.GTC);

        LimitOrderAmendRequest request = new LimitOrderAmendRequest();
        request.setQty(1_500_000);
        request.setLimitPrice(1.08320);
        request.setTimeInForce("GTD");
        request.setGoodTillDate(LocalDate.parse("2026-05-30"));
        request.setComments("Amended from rates panel");

        FxPrice executablePrice = new FxPrice(
                "EURUSD",
                1.08310,
                1.08318,
                0,
                0,
                Tenor.SP,
                LocalDateTime.parse("2026-05-26T08:00:00"),
                Source.AUTO,
                2_000_000,
                Status.ACTIVE
        );

        when(limitOrderRepository.findById("LO-AMEND")).thenReturn(Optional.of(activeOrder), Optional.of(activeOrder));
        when(limitOrderRepository.save(any(LimitOrder.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(fxPriceRepository.findByCcyPairAndTenor("EURUSD", Tenor.SP)).thenReturn(List.of(executablePrice));
        when(limitOrderRepository.findByStatusAndCcyPairAndTenorOrderBySubmittedAtAsc(LimitOrderStatus.ACTIVE, "EURUSD", "SP"))
                .thenReturn(List.of(activeOrder));

        LimitOrder amendedOrder = limitOrderService.amendLimitOrder("LO-AMEND", request);

        assertThat(amendedOrder.getQty()).isEqualTo(1_500_000);
        assertThat(amendedOrder.getTimeInForce()).isEqualTo(TimeInForce.GTD);
        assertThat(amendedOrder.getGoodTillDate()).isEqualTo(LocalDate.parse("2026-05-26"));
        assertThat(amendedOrder.getComments()).isEqualTo("Amended from rates panel");
        assertThat(amendedOrder.getStatus()).isEqualTo(LimitOrderStatus.EXECUTED);
        verify(limitOrderRepository, times(2)).save(activeOrder);
        verify(tradeService).bookExecutedLimitOrder(activeOrder, 1.08318);
    }
}






