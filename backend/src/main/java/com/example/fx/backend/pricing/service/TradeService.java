package com.example.fx.backend.pricing.service;

import com.example.fx.backend.pricing.model.Trade;
import com.example.fx.backend.pricing.repository.TradeRepository;
import com.example.fx.backend.simulator.SimulatorClientProperties;
import com.example.fx.backend.simulator.SimulatorContractMapper;
import com.example.fx.backend.simulator.SimulatorGateway;
import com.example.fx.simulator.api.model.BookedTrade;
import com.example.fx.simulator.api.model.BookingRequest;
import com.example.fx.simulator.api.model.OneWayPriceQuote;
import com.example.fx.simulator.api.model.OneWayPriceRequest;
import com.example.fx.simulator.api.model.PriceQuote;
import com.example.fx.simulator.api.model.Side;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TradeService {
    private final TradeRepository tradeRepository;
    private final SimulatorGateway simulator;
    private final SimulatorClientProperties properties;

    public TradeService(TradeRepository tradeRepository, SimulatorGateway simulator,
                        SimulatorClientProperties properties) {
        this.tradeRepository = tradeRepository;
        this.simulator = simulator;
        this.properties = properties;
    }

    public List<Trade> getTrades() {
        return tradeRepository.findAllByOrderByBookedAtDesc();
    }

    @Transactional
    public Trade bookTrade(Trade draft) {
        validateDraft(draft);
        String requestId = textOr(draft.getRequestId(), UUID.randomUUID().toString());
        String channel = textOr(draft.getChannel(), properties.channel());
        String segment = textOr(draft.getSegment(), properties.segment());
        String customerId = textOr(draft.getCustomerId(), properties.customerId());
        String pair = draft.getCcyPair().trim().toUpperCase(Locale.ROOT);
        String quantityCurrency = draft.getDealtCurrency().trim().toUpperCase(Locale.ROOT);
        Side side = SimulatorContractMapper.toSide(draft.getDirection());

        OneWayPriceRequest pricingRequest = new OneWayPriceRequest()
                .requestId(requestId)
                .channel(channel)
                .segment(segment)
                .customerId(customerId)
                .currencyPair(pair)
                .quantity(BigDecimal.valueOf(draft.getQty()))
                .quantityCurrency(quantityCurrency)
                .tenor(SimulatorContractMapper.toContractTenor(draft.getTenor()))
                .side(side)
                .quoteType("ONE_WAY");
        PriceQuote priced = simulator.requestPrice(pricingRequest);
        if (!(priced instanceof OneWayPriceQuote quote)) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Simulator returned an unexpected quote variant.");
        }

        String bookingRequestId = UUID.randomUUID().toString();
        BookingRequest bookingRequest = new BookingRequest()
                .requestId(bookingRequestId)
                .channel(channel)
                .segment(segment)
                .customerId(customerId)
                .quoteId(quote.getQuoteId())
                .side(side);
        String idempotencyKey = textOr(draft.getIdempotencyKey(), requestId);
        return record(simulator.bookTrade(idempotencyKey, bookingRequest), draft, "MARKET", null);
    }

    @Transactional
    public Trade reconcileBooking(UUID tradeId, String requestId, String channel, String segment,
                                  String customerId, Trade metadata, String executionType, String orderId) {
        Trade existing = tradeRepository.findById(tradeId.toString()).orElse(null);
        if (existing != null) {
            return existing;
        }
        BookedTrade booked = simulator.getBooking(tradeId, requestId, channel, segment, customerId);
        return record(booked, metadata, executionType, orderId);
    }

    @Transactional
    public Trade record(BookedTrade booked, Trade metadata, String executionType, String orderId) {
        Trade trade = tradeRepository.findById(booked.getTradeId().toString()).orElseGet(Trade::new);
        trade.setId(booked.getTradeId().toString());
        trade.setQuoteId(booked.getQuoteId().toString());
        trade.setRequestId(booked.getRequestId());
        trade.setOriginalRequestId(booked.getOriginalRequestId());
        trade.setResponseId(booked.getResponseId().toString());
        trade.setResponseAt(booked.getResponseAt());
        trade.setChannel(booked.getChannel());
        trade.setSegment(booked.getSegment());
        trade.setCustomerId(booked.getCustomerId());
        trade.setCcyPair(booked.getCurrencyPair());
        trade.setTenor(SimulatorContractMapper.toUiTenor(booked.getTenor()));
        trade.setQty(booked.getQuantity().doubleValue());
        trade.setDirection(SimulatorContractMapper.toDirection(booked.getSide()));
        trade.setDealtCurrency(booked.getQuantityCurrency());
        trade.setQuantityCurrency(booked.getQuantityCurrency());
        trade.setPrice(booked.getClientPrice().doubleValue());
        trade.setCoverPrice(booked.getCoverPrice().doubleValue());
        trade.setSwapPoints(booked.getSwapPoints().doubleValue());
        trade.setBuyCurrency(booked.getBuyCurrency());
        trade.setBuyQuantity(booked.getBuyQuantity().doubleValue());
        trade.setSellCurrency(booked.getSellCurrency());
        trade.setSellQuantity(booked.getSellQuantity().doubleValue());
        trade.setSpotDate(booked.getSpotDate());
        trade.setValueDate(booked.getValueDate());
        trade.setTradeDate(booked.getBookedAt().toLocalDate());
        trade.setSettlementDate(booked.getValueDate());
        trade.setBookedAt(booked.getBookedAt().toLocalDateTime());
        trade.setStatus(booked.getStatus().getValue());
        trade.setBookingMode("live");
        trade.setExecutionType(executionType);
        trade.setLimitOrderId(orderId);
        trade.setMarketSource("SIMULATOR");
        copyDeskMetadata(metadata, trade);
        return tradeRepository.save(trade);
    }

    private void copyDeskMetadata(Trade source, Trade target) {
        if (source == null) {
            target.setCustomer("Simulator customer " + target.getCustomerId());
            target.setTrader("system");
            target.setProductType("SPOT_FWD");
            target.setProductDetails(target.getTenor() + " settle " + target.getSettlementDate());
            return;
        }
        target.setCustomer(textOr(source.getCustomer(), "Simulator customer " + target.getCustomerId()));
        target.setRm(textOr(source.getRm(), "N/A"));
        target.setSales(textOr(source.getSales(), "N/A"));
        target.setComments(textOr(source.getComments(), ""));
        target.setTrader(textOr(source.getTrader(), "system"));
        target.setProductType(textOr(source.getProductType(), "SPOT_FWD"));
        target.setProductDetails(textOr(source.getProductDetails(),
                target.getTenor() + " settle " + target.getSettlementDate()));
    }

    private void validateDraft(Trade draft) {
        if (draft == null || draft.getCcyPair() == null || !draft.getCcyPair().trim().matches("[A-Za-z]{6}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A six-letter currency pair is required.");
        }
        if (draft.getQty() <= 0 || !Double.isFinite(draft.getQty())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Quantity must be positive.");
        }
        String quantityCurrency = textOr(draft.getDealtCurrency(), "").toUpperCase(Locale.ROOT);
        String pair = draft.getCcyPair().trim().toUpperCase(Locale.ROOT);
        if (!(quantityCurrency.equals(pair.substring(0, 3)) || quantityCurrency.equals(pair.substring(3)))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Dealt currency must be one leg of the currency pair.");
        }
        if (!"SPOT_FWD".equalsIgnoreCase(textOr(draft.getProductType(), "SPOT_FWD"))) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "The simulator contract currently supports FX spot and outright forwards only.");
        }
    }

    private String textOr(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
