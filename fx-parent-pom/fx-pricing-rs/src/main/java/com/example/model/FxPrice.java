package com.example.model;

import javax.persistence.*;

import com.example.Tenor;

import java.io.Serializable;
import java.time.LocalDateTime;

@Entity
@IdClass(FxPriceId.class)
public class FxPrice implements Serializable {

    @Id
    private String ccyPair;

    @Id
    @Enumerated(EnumType.STRING)
    private Tenor tenor;

    @Id
    private double qty;

    private double bid;
    private double ask;
    private double bidPoints;
    private double askPoints;
    private LocalDateTime updatedAt;

    @Enumerated(EnumType.STRING)
    private Source source;

    @Enumerated(EnumType.STRING)
    private Status status;

    // Default constructor
    public FxPrice() {}

    // Constructor
    public FxPrice(String ccyPair, double bid, double ask, double bidPoints, double askPoints, Tenor tenor, LocalDateTime updatedAt, Source source, double qty, Status status) {
        this.ccyPair = ccyPair;
        this.bid = bid;
        this.ask = ask;
        this.bidPoints = bidPoints;
        this.askPoints = askPoints;
        this.tenor = tenor;
        this.updatedAt = updatedAt;
        this.source = source;
        this.qty = qty;
        this.status = status;
    }

    // Getters and Setters
    public String getCcyPair() {
        return ccyPair;
    }

    public void setCcyPair(String ccyPair) {
        this.ccyPair = ccyPair;
    }

    public double getBid() {
        return bid;
    }

    public void setBid(double bid) {
        this.bid = bid;
    }

    public double getAsk() {
        return ask;
    }

    public void setAsk(double ask) {
        this.ask = ask;
    }

    public double getBidPoints() {
        return bidPoints;
    }

    public void setBidPoints(double bidPoints) {
        this.bidPoints = bidPoints;
    }

    public double getAskPoints() {
        return askPoints;
    }

    public void setAskPoints(double askPoints) {
        this.askPoints = askPoints;
    }

    public Tenor getTenor() {
        return tenor;
    }

    public void setTenor(Tenor tenor) {
        this.tenor = tenor;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Source getSource() {
        return source;
    }

    public void setSource(Source source) {
        this.source = source;
    }

    public double getQty() {
        return qty;
    }

    public void setQty(double qty) {
        this.qty = qty;
    }

    public Status getStatus() {
        return status;
    }

    public void setStatus(Status status) {
        this.status = status;
    }

    public String getTenorLabel() {
        return tenor.getLabel();
    }

    @Override
    public String toString() {
        return "FxPrice{" +
                "ccyPair='" + ccyPair + '\'' +
                ", bid=" + bid +
                ", ask=" + ask +
                ", bidPoints=" + bidPoints +
                ", askPoints=" + askPoints +
                ", tenor=" + tenor +
                ", updatedAt=" + updatedAt +
                ", source=" + source +
                ", qty=" + qty +
                ", status=" + status +
                '}';
    }
}