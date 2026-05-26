package com.example.service;

import com.example.model.Trade;
import com.example.repository.TradeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TradeServiceTest {

    @Mock
    private TradeRepository tradeRepository;

    private TradeService tradeService;

    @BeforeEach
    void setUp() {
        Clock fixedClock = Clock.fixed(Instant.parse("2026-05-26T08:00:00Z"), ZoneOffset.UTC);
        tradeService = new TradeService(tradeRepository, fixedClock);
        when(tradeRepository.save(any(Trade.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void persistsProductMetadataWhenBookingTrades() {
        Trade draft = new Trade();
        draft.setCcyPair("EURUSD");
        draft.setTenor("SP");
        draft.setQty(1_000_000);
        draft.setDirection("Buy");
        draft.setDealtCurrency("EUR");
        draft.setPrice(1.0832);
        draft.setTradeDate(LocalDate.parse("2026-05-26"));
        draft.setSettlementDate(LocalDate.parse("2026-05-28"));
        draft.setProductType("SWAP");
        draft.setProductDetails("Near SP settle 2026-05-28 · Far 1M settle 2026-06-26 @ 1.0841");

        Trade bookedTrade = tradeService.bookTrade(draft);

        assertThat(bookedTrade.getProductType()).isEqualTo("SWAP");
        assertThat(bookedTrade.getProductDetails()).contains("Far 1M");
    }
}

