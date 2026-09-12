package com.example.fx.backend.pricing.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;

@Entity
@Table(name = "BKND_LIMIT_ORDER")
public class LimitOrder {

    @Id
    private String id;

    private String requestId;
    private String originalRequestId;
    private String responseId;
    private OffsetDateTime responseAt;
    private String channel;
    private String segment;
    private String customerId;

    private String ccyPair;
    private String tenor;
    private double qty;
    private String direction;
    private String dealtCurrency;
    private String quantityCurrency;
    private String contractTenor;
    private double limitPrice;

    @Enumerated(EnumType.STRING)
    private TimeInForce timeInForce;

    private LocalDate goodTillDate;
    private LocalDate tradeDate;
    private LocalDate settlementDate;
    private String customer;
    private String rm;
    private String sales;

    @Column(length = 1024)
    private String comments;

    private String trader;

    @Enumerated(EnumType.STRING)
    private LimitOrderStatus status;

    private LocalDateTime submittedAt;
    private LocalDateTime executedAt;
    private Double executedPrice;
    private OffsetDateTime expiresAt;
    private OffsetDateTime lastEvaluatedAt;
    private Double lastEvaluatedPrice;
    private OffsetDateTime closedAt;
    @Column(name = "TRADING_SYSTEM_TRADE_ID")
    private String tradingSystemTradeId;
    private String callbackUrl;
    private String callbackStatus;
    private Integer callbackAttempts;
    private String lastEventId;
    private OffsetDateTime eventReceivedAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    public String getOriginalRequestId() { return originalRequestId; }
    public void setOriginalRequestId(String originalRequestId) { this.originalRequestId = originalRequestId; }
    public String getResponseId() { return responseId; }
    public void setResponseId(String responseId) { this.responseId = responseId; }
    public OffsetDateTime getResponseAt() { return responseAt; }
    public void setResponseAt(OffsetDateTime responseAt) { this.responseAt = responseAt; }
    public String getChannel() { return channel; }
    public void setChannel(String channel) { this.channel = channel; }
    public String getSegment() { return segment; }
    public void setSegment(String segment) { this.segment = segment; }
    public String getCustomerId() { return customerId; }
    public void setCustomerId(String customerId) { this.customerId = customerId; }

    public String getCcyPair() {
        return ccyPair;
    }

    public void setCcyPair(String ccyPair) {
        this.ccyPair = ccyPair;
    }

    public String getTenor() {
        return tenor;
    }

    public void setTenor(String tenor) {
        this.tenor = tenor;
    }

    public double getQty() {
        return qty;
    }

    public void setQty(double qty) {
        this.qty = qty;
    }

    public String getDirection() {
        return direction;
    }

    public void setDirection(String direction) {
        this.direction = direction;
    }

    public String getDealtCurrency() {
        return dealtCurrency;
    }

    public void setDealtCurrency(String dealtCurrency) {
        this.dealtCurrency = dealtCurrency;
    }

    public String getQuantityCurrency() { return quantityCurrency; }
    public void setQuantityCurrency(String quantityCurrency) { this.quantityCurrency = quantityCurrency; }
    public String getContractTenor() { return contractTenor; }
    public void setContractTenor(String contractTenor) { this.contractTenor = contractTenor; }

    public double getLimitPrice() {
        return limitPrice;
    }

    public void setLimitPrice(double limitPrice) {
        this.limitPrice = limitPrice;
    }

    public TimeInForce getTimeInForce() {
        return timeInForce;
    }

    public void setTimeInForce(TimeInForce timeInForce) {
        this.timeInForce = timeInForce;
    }

    public LocalDate getGoodTillDate() {
        return goodTillDate;
    }

    public void setGoodTillDate(LocalDate goodTillDate) {
        this.goodTillDate = goodTillDate;
    }

    public LocalDate getTradeDate() {
        return tradeDate;
    }

    public void setTradeDate(LocalDate tradeDate) {
        this.tradeDate = tradeDate;
    }

    public LocalDate getSettlementDate() {
        return settlementDate;
    }

    public void setSettlementDate(LocalDate settlementDate) {
        this.settlementDate = settlementDate;
    }

    public String getCustomer() {
        return customer;
    }

    public void setCustomer(String customer) {
        this.customer = customer;
    }

    public String getRm() {
        return rm;
    }

    public void setRm(String rm) {
        this.rm = rm;
    }

    public String getSales() {
        return sales;
    }

    public void setSales(String sales) {
        this.sales = sales;
    }

    public String getComments() {
        return comments;
    }

    public void setComments(String comments) {
        this.comments = comments;
    }

    public String getTrader() {
        return trader;
    }

    public void setTrader(String trader) {
        this.trader = trader;
    }

    public LimitOrderStatus getStatus() {
        return status;
    }

    public void setStatus(LimitOrderStatus status) {
        this.status = status;
    }

    public LocalDateTime getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(LocalDateTime submittedAt) {
        this.submittedAt = submittedAt;
    }

    public LocalDateTime getExecutedAt() {
        return executedAt;
    }

    public void setExecutedAt(LocalDateTime executedAt) {
        this.executedAt = executedAt;
    }

    public Double getExecutedPrice() {
        return executedPrice;
    }

    public void setExecutedPrice(Double executedPrice) {
        this.executedPrice = executedPrice;
    }

    public OffsetDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(OffsetDateTime expiresAt) { this.expiresAt = expiresAt; }
    public OffsetDateTime getLastEvaluatedAt() { return lastEvaluatedAt; }
    public void setLastEvaluatedAt(OffsetDateTime lastEvaluatedAt) { this.lastEvaluatedAt = lastEvaluatedAt; }
    public Double getLastEvaluatedPrice() { return lastEvaluatedPrice; }
    public void setLastEvaluatedPrice(Double lastEvaluatedPrice) { this.lastEvaluatedPrice = lastEvaluatedPrice; }
    public OffsetDateTime getClosedAt() { return closedAt; }
    public void setClosedAt(OffsetDateTime closedAt) { this.closedAt = closedAt; }
    @JsonProperty("simulatorTradeId")
    public String getTradingSystemTradeId() { return tradingSystemTradeId; }
    @JsonProperty("simulatorTradeId")
    public void setTradingSystemTradeId(String tradingSystemTradeId) {
        this.tradingSystemTradeId = tradingSystemTradeId;
    }
    public String getCallbackUrl() { return callbackUrl; }
    public void setCallbackUrl(String callbackUrl) { this.callbackUrl = callbackUrl; }
    public String getCallbackStatus() { return callbackStatus; }
    public void setCallbackStatus(String callbackStatus) { this.callbackStatus = callbackStatus; }
    public Integer getCallbackAttempts() { return callbackAttempts; }
    public void setCallbackAttempts(Integer callbackAttempts) { this.callbackAttempts = callbackAttempts; }
    public String getLastEventId() { return lastEventId; }
    public void setLastEventId(String lastEventId) { this.lastEventId = lastEventId; }
    public OffsetDateTime getEventReceivedAt() { return eventReceivedAt; }
    public void setEventReceivedAt(OffsetDateTime eventReceivedAt) { this.eventReceivedAt = eventReceivedAt; }
}
