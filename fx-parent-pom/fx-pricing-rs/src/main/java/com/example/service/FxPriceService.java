package com.example.service;

import com.example.MarketData;
import com.example.MarketDataUpdateListener;
import com.example.model.FxPrice;
import com.example.repository.FxPriceRepository;
import com.example.util.MarketDataConverter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class FxPriceService implements MarketDataUpdateListener {

    @Autowired
    private FxPriceRepository fxPriceRepository;

    public FxPrice saveFxPrice(FxPrice fxPrice) {
        return fxPriceRepository.save(fxPrice);
    }

    @Override
    public void onMarketDataUpdate(MarketData marketData) {
        // Assuming you want to use the first volume index (0)
        FxPrice fxPrice = MarketDataConverter.convertToFxPrice(marketData, 0);
        saveFxPrice(fxPrice);
    }

    public List<FxPrice> getAllPrices() {
        return fxPriceRepository.findAll();
    }

    public FxPrice updatePrice(FxPrice fxPrice) {
        return fxPriceRepository.save(fxPrice);
    }

}