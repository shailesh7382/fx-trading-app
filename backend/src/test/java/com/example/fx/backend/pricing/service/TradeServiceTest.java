package com.example.fx.backend.pricing.service;

import com.example.fx.backend.pricing.model.Trade;
import com.example.fx.backend.pricing.repository.TradeRepository;
import com.example.fx.backend.simulator.SimulatorClientProperties;
import com.example.fx.backend.simulator.SimulatorGateway;
import com.example.fx.backend.support.SequentialIdGenerator;
import com.example.fx.simulator.api.model.BookedTrade;
import com.example.fx.simulator.api.model.BookingRequest;
import com.example.fx.simulator.api.model.OneWayPriceQuote;
import com.example.fx.simulator.api.model.OneWayPriceRequest;
import com.example.fx.simulator.api.model.QuoteStatus;
import com.example.fx.simulator.api.model.Side;
import com.example.fx.simulator.api.model.Tenor;
import com.example.fx.simulator.api.model.TradeStatus;
import java.math.BigDecimal;
import java.net.URI;
import java.time.Duration;
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
class TradeServiceTest {
    @Mock TradeRepository repository;
    @Mock SimulatorGateway simulator;
    @Mock SequentialIdGenerator idGenerator;
    private TradeService service;

    @BeforeEach
    void setUp() {
        service = new TradeService(repository, simulator, properties(), idGenerator);
        lenient().when(idGenerator.generate()).thenReturn("B00000002");
        when(repository.findById(anyString())).thenReturn(Optional.empty());
        when(repository.save(any(Trade.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void pricesAndBooksThroughGeneratedContractAndPersistsAllExecutionFields() {
        UUID quoteId = UUID.randomUUID();
        UUID tradeId = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.of(2026, 9, 8, 8, 0, 0, 0, ZoneOffset.UTC);
        OneWayPriceQuote quote = new OneWayPriceQuote()
                .quoteType("ONE_WAY").requestId("price-request").channel("WEB").segment("C")
                .customerId("0000123456").originalRequestId("price-request").responseId(UUID.randomUUID())
                .responseAt(now).quoteId(quoteId).currencyPair("EURUSD").quantity(new BigDecimal("1000000"))
                .quantityCurrency("EUR").tenor(Tenor.ONE_MONTH).spotDate(LocalDate.parse("2026-09-10"))
                .valueDate(LocalDate.parse("2026-10-12")).quotedAt(now).expiresAt(now.plusSeconds(30))
                .status(QuoteStatus.ACTIVE).side(Side.BUY).coverPrice(new BigDecimal("1.10100"))
                .clientPrice(new BigDecimal("1.10105")).swapPoints(new BigDecimal("0.00100"));
        BookedTrade booked = new BookedTrade()
                .requestId("book-request").channel("WEB").segment("C").customerId("0000123456")
                .originalRequestId("book-request").responseId(UUID.randomUUID()).responseAt(now)
                .tradeId(tradeId).quoteId(quoteId).currencyPair("EURUSD").quantity(new BigDecimal("1000000"))
                .quantityCurrency("EUR").tenor(Tenor.ONE_MONTH).side(Side.BUY)
                .coverPrice(new BigDecimal("1.10100")).clientPrice(new BigDecimal("1.10105"))
                .swapPoints(new BigDecimal("0.00100")).buyCurrency("EUR").buyQuantity(new BigDecimal("1000000"))
                .sellCurrency("USD").sellQuantity(new BigDecimal("1101050.00"))
                .spotDate(LocalDate.parse("2026-09-10")).valueDate(LocalDate.parse("2026-10-12"))
                .bookedAt(now).status(TradeStatus.BOOKED);
        when(simulator.requestPrice(any())).thenReturn(quote);
        when(simulator.bookTrade(eq("idem-1"), any())).thenReturn(booked);

        Trade draft = new Trade();
        draft.setRequestId("price-request");
        draft.setIdempotencyKey("idem-1");
        draft.setCcyPair("EURUSD");
        draft.setTenor("1M");
        draft.setQty(1_000_000);
        draft.setDirection("Buy");
        draft.setDealtCurrency("EUR");
        draft.setProductType("SPOT_FWD");
        draft.setTrader("alice");

        Trade result = service.bookTrade(draft);

        ArgumentCaptor<OneWayPriceRequest> priceRequest = ArgumentCaptor.forClass(OneWayPriceRequest.class);
        verify(simulator).requestPrice(priceRequest.capture());
        assertThat(priceRequest.getValue().getTenor()).isEqualTo(Tenor.ONE_MONTH);
        assertThat(priceRequest.getValue().getSide()).isEqualTo(Side.BUY);
        ArgumentCaptor<BookingRequest> bookingRequest = ArgumentCaptor.forClass(BookingRequest.class);
        verify(simulator).bookTrade(eq("idem-1"), bookingRequest.capture());
        assertThat(bookingRequest.getValue().getQuoteId()).isEqualTo(quoteId);
        assertThat(result.getId()).isEqualTo(tradeId.toString());
        assertThat(result.getQuoteId()).isEqualTo(quoteId.toString());
        assertThat(result.getCoverPrice()).isEqualTo(1.10100);
        assertThat(result.getSwapPoints()).isEqualTo(0.00100);
        assertThat(result.getBuyQuantity()).isEqualTo(1_000_000);
        assertThat(result.getSellQuantity()).isEqualTo(1_101_050);
        assertThat(result.getTrader()).isEqualTo("alice");
    }

    private SimulatorClientProperties properties() {
        return new SimulatorClientProperties(URI.create("http://localhost:8090"), Duration.ofSeconds(2),
                Duration.ofSeconds(5), "WEB", "C", "0000123456",
                URI.create("http://localhost:8080/api/resting-orders/events"),
                new BigDecimal("1000000"), List.of("EURUSD"));
    }
}
