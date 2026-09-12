package com.example.fx.backend.pricing.service;

import com.example.fx.backend.pricing.model.Trade;
import com.example.fx.backend.pricing.repository.TradeRepository;
import com.example.fx.backend.support.SequentialIdGenerator;
import com.example.fx.backend.tradingsystem.TradingSystemClientProperties;
import com.example.fx.backend.tradingsystem.TradingSystemContractMapper;
import com.example.fx.backend.tradingsystem.TradingSystemGateway;
import com.example.fx.tradingsystems.api.model.BookedTrade;
import com.example.fx.tradingsystems.api.model.BookingRequest;
import com.example.fx.tradingsystems.api.model.OneWayPriceQuote;
import com.example.fx.tradingsystems.api.model.OneWayPriceRequest;
import com.example.fx.tradingsystems.api.model.PriceQuote;
import com.example.fx.tradingsystems.api.model.Side;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TradeService {
    private static final Logger LOG = LoggerFactory.getLogger(TradeService.class);

    private final TradeRepository tradeRepository;
    private final TradingSystemGateway tradingSystem;
    private final TradingSystemClientProperties properties;
    private final SequentialIdGenerator idGenerator;

    public TradeService(TradeRepository tradeRepository, TradingSystemGateway tradingSystem,
                        TradingSystemClientProperties properties, SequentialIdGenerator idGenerator) {
        this.tradeRepository = tradeRepository;
        this.tradingSystem = tradingSystem;
        this.properties = properties;
        this.idGenerator = idGenerator;
    }

    public List<Trade> getTrades() {
        List<Trade> trades = tradeRepository.findAllByOrderByBookedAtDesc();
        LOG.debug("Loaded trades count={}", trades.size());
        return trades;
    }

    @Transactional
    public Trade bookTrade(Trade draft) {
        validateDraft(draft);
        String requestId = textOr(draft.getRequestId(), idGenerator.generate());
        String channel = textOr(draft.getChannel(), properties.channel());
        String segment = textOr(draft.getSegment(), properties.segment());
        String customerId = textOr(draft.getCustomerId(), properties.customerId());
        String pair = draft.getCcyPair().trim().toUpperCase(Locale.ROOT);
        String quantityCurrency = draft.getDealtCurrency().trim().toUpperCase(Locale.ROOT);
        Side side = TradingSystemContractMapper.toSide(draft.getDirection());
        LOG.info("Booking market trade requestId={} pair={} side={} quantity={} {} tenor={}",
                requestId, pair, side, draft.getQty(), quantityCurrency, draft.getTenor());

        OneWayPriceRequest pricingRequest = new OneWayPriceRequest()
                .requestId(requestId)
                .channel(channel)
                .segment(segment)
                .customerId(customerId)
                .currencyPair(pair)
                .quantity(BigDecimal.valueOf(draft.getQty()))
                .quantityCurrency(quantityCurrency)
                .tenor(TradingSystemContractMapper.toContractTenor(draft.getTenor()))
                .side(side)
                .quoteType("ONE_WAY");
        PriceQuote priced = tradingSystem.requestPrice(pricingRequest);
        if (!(priced instanceof OneWayPriceQuote quote)) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Trading System returned an unexpected quote variant.");
        }

        String bookingRequestId = idGenerator.generate();
        BookingRequest bookingRequest = new BookingRequest()
                .requestId(bookingRequestId)
                .channel(channel)
                .segment(segment)
                .customerId(customerId)
                .quoteId(quote.getQuoteId())
                .side(side);
        String idempotencyKey = textOr(draft.getIdempotencyKey(), requestId);
        Trade trade = record(tradingSystem.bookTrade(idempotencyKey, bookingRequest), draft, "MARKET", null);
        LOG.info("Market trade booked tradeId={} quoteId={} price={}",
                trade.getId(), trade.getQuoteId(), trade.getPrice());
        return trade;
    }

    @Transactional
    public Trade reconcileBooking(UUID tradeId, String requestId, String channel, String segment,
                                  String customerId, Trade metadata, String executionType, String orderId) {
        Trade existing = tradeRepository.findById(tradeId.toString()).orElse(null);
        if (existing != null) {
            LOG.debug("Trade reconciliation skipped because trade already exists tradeId={}", tradeId);
            return existing;
        }
        LOG.info("Reconciling Trading System trade tradeId={} executionType={} orderId={}",
                tradeId, executionType, orderId);
        BookedTrade booked = tradingSystem.getBooking(tradeId, requestId, channel, segment, customerId);
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
        trade.setTenor(TradingSystemContractMapper.toUiTenor(booked.getTenor()));
        trade.setQty(booked.getQuantity().doubleValue());
        trade.setDirection(TradingSystemContractMapper.toDirection(booked.getSide()));
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
        trade.setMarketSource("TRADING_SYSTEM");
        copyDeskMetadata(metadata, trade);
        Trade saved = tradeRepository.save(trade);
        LOG.debug("Trade persisted tradeId={} status={} executionType={} orderId={}",
                saved.getId(), saved.getStatus(), saved.getExecutionType(), saved.getLimitOrderId());
        return saved;
    }

    private void copyDeskMetadata(Trade source, Trade target) {
        if (source == null) {
            target.setCustomer("Trading System customer " + target.getCustomerId());
            target.setTrader("system");
            target.setProductType("SPOT_FWD");
            target.setProductDetails(target.getTenor() + " settle " + target.getSettlementDate());
            return;
        }
        target.setCustomer(textOr(source.getCustomer(), "Trading System customer " + target.getCustomerId()));
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
                    "The Trading System contract currently supports FX spot and outright forwards only.");
        }
    }

    private String textOr(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
