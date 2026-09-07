package com.example.fx.backend.pricing.service;

import com.example.fx.backend.pricing.model.MarketData;

public interface MarketDataUpdateListener {
    void onMarketDataUpdate(MarketData marketData);
}