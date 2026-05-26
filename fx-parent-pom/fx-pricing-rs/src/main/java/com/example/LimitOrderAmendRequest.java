package com.example;

import java.time.LocalDate;

public class LimitOrderAmendRequest {
    private double qty;
    private double limitPrice;
    private String timeInForce;
    private LocalDate goodTillDate;
    private String comments;

    public double getQty() {
        return qty;
    }

    public void setQty(double qty) {
        this.qty = qty;
    }

    public double getLimitPrice() {
        return limitPrice;
    }

    public void setLimitPrice(double limitPrice) {
        this.limitPrice = limitPrice;
    }

    public String getTimeInForce() {
        return timeInForce;
    }

    public void setTimeInForce(String timeInForce) {
        this.timeInForce = timeInForce;
    }

    public LocalDate getGoodTillDate() {
        return goodTillDate;
    }

    public void setGoodTillDate(LocalDate goodTillDate) {
        this.goodTillDate = goodTillDate;
    }

    public String getComments() {
        return comments;
    }

    public void setComments(String comments) {
        this.comments = comments;
    }
}

