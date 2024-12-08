package com.example.service;

import com.example.MarketData;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jms.annotation.JmsListener;
import org.springframework.stereotype.Component;

@Component
public class MarketDataSubscriber {

    @Autowired
    private FxPriceService fxPriceService;

    @JmsListener(destination = "fxPriceQueue")
    public void processMessage(MarketData message) {
        System.out.println("Received message: " + message);
        fxPriceService.onMarketDataUpdate(message);
    }
}