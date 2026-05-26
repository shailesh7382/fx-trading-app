package com.example.model;

import javax.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
public class LimitOrder {

    @Id
    private String id;

    private String ccyPair;
    private String tenor;
    private double qty;
    private String direction;
    private String dealtCurrency;
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

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

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
}

