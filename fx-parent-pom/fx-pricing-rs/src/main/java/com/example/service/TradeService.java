package com.example.service;

import com.example.model.LimitOrder;
import com.example.model.Trade;
import com.example.repository.TradeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

@Service
public class TradeService {

    private static final DateTimeFormatter TRADE_ID_DATE = DateTimeFormatter.ofPattern("yyMMdd");

    private final TradeRepository tradeRepository;
    private final Clock clock;

    public TradeService(TradeRepository tradeRepository, Clock clock) {
        this.tradeRepository = tradeRepository;
        this.clock = clock;
    }

    public List<Trade> getTrades() {
        return tradeRepository.findAllByOrderByBookedAtDesc();
    }

    @Transactional
    public Trade bookTrade(Trade tradeDraft) {
        Trade trade = new Trade();
        LocalDate tradeDate = tradeDraft.getTradeDate() != null ? tradeDraft.getTradeDate() : LocalDate.now(clock);

        trade.setId(hasText(tradeDraft.getId()) ? tradeDraft.getId() : nextTradeId());
        trade.setCcyPair(normalizeText(tradeDraft.getCcyPair()));
        trade.setTenor(hasText(tradeDraft.getTenor()) ? tradeDraft.getTenor().trim().toUpperCase(Locale.ROOT) : "SP");
        trade.setQty(tradeDraft.getQty());
        trade.setDirection(normalizeDirection(tradeDraft.getDirection()));
        trade.setDealtCurrency(normalizeText(tradeDraft.getDealtCurrency()));
        trade.setPrice(tradeDraft.getPrice());
        trade.setCustomer(defaultText(tradeDraft.getCustomer(), "Desk order"));
        trade.setRm(defaultText(tradeDraft.getRm(), "N/A"));
        trade.setSales(defaultText(tradeDraft.getSales(), "N/A"));
        trade.setTradeDate(tradeDate);
        trade.setSettlementDate(tradeDraft.getSettlementDate() != null ? tradeDraft.getSettlementDate() : tradeDate);
        trade.setComments(defaultText(tradeDraft.getComments(), ""));
        trade.setTrader(defaultText(tradeDraft.getTrader(), "system"));
        trade.setStatus(defaultText(tradeDraft.getStatus(), "BOOKED"));
        trade.setBookingMode(defaultText(tradeDraft.getBookingMode(), "live"));
        trade.setExecutionType(defaultText(tradeDraft.getExecutionType(), "MARKET"));
        trade.setLimitOrderId(tradeDraft.getLimitOrderId());
        trade.setProductType(defaultText(tradeDraft.getProductType(), "SPOT_FWD"));
        trade.setProductDetails(defaultText(tradeDraft.getProductDetails(), ""));
        trade.setBookedAt(tradeDraft.getBookedAt() != null ? tradeDraft.getBookedAt() : LocalDateTime.now(clock));

        return tradeRepository.save(trade);
    }

    @Transactional
    public Trade bookExecutedLimitOrder(LimitOrder order, double executionPrice) {
        Trade trade = new Trade();
        trade.setCcyPair(order.getCcyPair());
        trade.setTenor(order.getTenor());
        trade.setQty(order.getQty());
        trade.setDirection(order.getDirection());
        trade.setDealtCurrency(order.getDealtCurrency());
        trade.setPrice(executionPrice);
        trade.setCustomer(defaultText(order.getCustomer(), "System limit order"));
        trade.setRm(defaultText(order.getRm(), "N/A"));
        trade.setSales(defaultText(order.getSales(), "N/A"));
        trade.setTradeDate(order.getTradeDate() != null ? order.getTradeDate() : LocalDate.now(clock));
        trade.setSettlementDate(order.getSettlementDate() != null ? order.getSettlementDate() : trade.getTradeDate());
        trade.setComments(defaultText(order.getComments(), "Auto-executed from spot limit order."));
        trade.setTrader(defaultText(order.getTrader(), "system"));
        trade.setStatus("BOOKED");
        trade.setBookingMode("live");
        trade.setExecutionType("LIMIT");
        trade.setLimitOrderId(order.getId());
        trade.setProductType("SPOT_FWD");
        trade.setProductDetails(defaultText(order.getTenor(), "SP") + " settle " + trade.getSettlementDate());
        trade.setBookedAt(LocalDateTime.now(clock));
        return bookTrade(trade);
    }

    private String nextTradeId() {
        return "FX-" + LocalDate.now(clock).format(TRADE_ID_DATE) + "-" + System.currentTimeMillis();
    }

    private String normalizeDirection(String direction) {
        return "SELL".equalsIgnoreCase(direction) ? "Sell" : "Buy";
    }

    private String normalizeText(String value) {
        return value == null ? null : value.trim();
    }

    private String defaultText(String value, String fallback) {
        return hasText(value) ? value.trim() : fallback;
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}

