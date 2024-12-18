package com.example;

import com.example.model.FxPrice;

import java.time.LocalDateTime;
import java.util.Comparator;

public class FxPriceDTO {

    private String ccyPair;
    private String tenor;
    private double qty;
    private double bid;
    private double ask;
    private double bidPoints;
    private double askPoints;
    private LocalDateTime updatedAt;
    private String source;
    private String status;

    public FxPriceDTO(FxPrice fxPrice) {
        this.ccyPair = fxPrice.getCcyPair();
        this.tenor = fxPrice.getTenorLabel();
        this.qty = fxPrice.getQty();
        this.bid = fxPrice.getBid();
        this.ask = fxPrice.getAsk();
        this.bidPoints = fxPrice.getBidPoints();
        this.askPoints = fxPrice.getAskPoints();
        this.updatedAt = fxPrice.getUpdatedAt();
        this.source = fxPrice.getSource().name();
        this.status = fxPrice.getStatus().name();
    }

    // Getters and Setters
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

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public static Comparator<FxPriceDTO> getComparator() {
        return Comparator.comparing(FxPriceDTO::getTenor, Comparator.comparingInt(FxPriceDTO::getTenorOrder))
                         .thenComparingDouble(FxPriceDTO::getQty)
                         .thenComparing(FxPriceDTO::getCcyPair)
                         ;
    }

    private static int getTenorOrder(String tenor) {
        switch (tenor) {
            case "SP": return 0;
            case "1M": return 1;
            case "3M": return 2;
            case "6M": return 3;
            case "1Y": return 4;
            default: return Integer.MAX_VALUE;
        }
    }
}
