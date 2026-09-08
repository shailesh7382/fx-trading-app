package com.example.fx.backend.pricing.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;

@Entity
public class Trade {

    @Id
    private String id;

    private String quoteId;
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
    private double price;
    private Double coverPrice;
    private Double swapPoints;
    private String buyCurrency;
    private Double buyQuantity;
    private String sellCurrency;
    private Double sellQuantity;
    private LocalDate spotDate;
    private LocalDate valueDate;
    private String customer;
    private String rm;
    private String sales;
    private LocalDate tradeDate;
    private LocalDate settlementDate;

    @Column(length = 1024)
    private String comments;

    private String trader;
    private String status;
    private String bookingMode;
    private String executionType;
    private String limitOrderId;
    private String productType;

    @Column(length = 1024)
    private String productDetails;

    private String marketSource;

    @jakarta.persistence.Transient
    private String idempotencyKey;

    private LocalDateTime bookedAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getQuoteId() { return quoteId; }
    public void setQuoteId(String quoteId) { this.quoteId = quoteId; }
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

    public double getPrice() {
        return price;
    }

    public void setPrice(double price) {
        this.price = price;
    }

    public Double getCoverPrice() { return coverPrice; }
    public void setCoverPrice(Double coverPrice) { this.coverPrice = coverPrice; }
    public Double getSwapPoints() { return swapPoints; }
    public void setSwapPoints(Double swapPoints) { this.swapPoints = swapPoints; }
    public String getBuyCurrency() { return buyCurrency; }
    public void setBuyCurrency(String buyCurrency) { this.buyCurrency = buyCurrency; }
    public Double getBuyQuantity() { return buyQuantity; }
    public void setBuyQuantity(Double buyQuantity) { this.buyQuantity = buyQuantity; }
    public String getSellCurrency() { return sellCurrency; }
    public void setSellCurrency(String sellCurrency) { this.sellCurrency = sellCurrency; }
    public Double getSellQuantity() { return sellQuantity; }
    public void setSellQuantity(Double sellQuantity) { this.sellQuantity = sellQuantity; }
    public LocalDate getSpotDate() { return spotDate; }
    public void setSpotDate(LocalDate spotDate) { this.spotDate = spotDate; }
    public LocalDate getValueDate() { return valueDate; }
    public void setValueDate(LocalDate valueDate) { this.valueDate = valueDate; }

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

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getBookingMode() {
        return bookingMode;
    }

    public void setBookingMode(String bookingMode) {
        this.bookingMode = bookingMode;
    }

    public String getExecutionType() {
        return executionType;
    }

    public void setExecutionType(String executionType) {
        this.executionType = executionType;
    }

    public String getLimitOrderId() {
        return limitOrderId;
    }

    public void setLimitOrderId(String limitOrderId) {
        this.limitOrderId = limitOrderId;
    }

    public String getProductType() {
        return productType;
    }

    public void setProductType(String productType) {
        this.productType = productType;
    }

    public String getProductDetails() {
        return productDetails;
    }

    public void setProductDetails(String productDetails) {
        this.productDetails = productDetails;
    }

    public String getMarketSource() { return marketSource; }
    public void setMarketSource(String marketSource) { this.marketSource = marketSource; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }

    public LocalDateTime getBookedAt() {
        return bookedAt;
    }

    public void setBookedAt(LocalDateTime bookedAt) {
        this.bookedAt = bookedAt;
    }
}
