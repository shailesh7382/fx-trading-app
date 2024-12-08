// src/main/java/com/example/MarketDataPublisher.java
package com.example;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jms.core.JmsTemplate;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;

@Service
public class MarketDataPublisher implements MarketDataUpdateListener, AutoCloseable {

    @Autowired
    private JmsTemplate jmsTemplate;
    private MarketDataGenerator marketDataGenerator;

    @PostConstruct
    public void startMarketDataPublisher() {
        // Start the MarketDataPublisher
        marketDataGenerator = new MarketDataGenerator(this);
        marketDataGenerator.generateMarketData();
    }

    public void sendFxPrice(MarketData fxPrice) {
        jmsTemplate.convertAndSend("fxPriceQueue", fxPrice);
    }

    @Override
    public void onMarketDataUpdate(MarketData marketData) {
        sendFxPrice(marketData);
    }

    @Override
    public void close() throws Exception {
        marketDataGenerator.close();
    }
}