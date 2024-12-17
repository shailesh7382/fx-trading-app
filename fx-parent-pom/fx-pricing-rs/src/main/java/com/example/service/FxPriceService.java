package com.example.service;

import com.example.MarketData;
import com.example.MarketDataUpdateListener;
import com.example.Tenor;
import com.example.model.FxPrice;
import com.example.repository.FxPriceRepository;
import com.example.util.MarketDataConverter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class FxPriceService implements MarketDataUpdateListener {

    @Autowired
    private FxPriceRepository fxPriceRepository;

    public FxPrice saveFxPrice(FxPrice fxPrice) {
        return fxPriceRepository.save(fxPrice);
    }

    @Override
    @Transactional
    public void onMarketDataUpdate(MarketData marketData) {
        String ccyPair = marketData.getCcyPair();
        Tenor tenor = Tenor.valueOf(marketData.getTenor());
        fxPriceRepository.deleteByCcyPairAndTenor(ccyPair, tenor);
        List<FxPrice> fxPrices = MarketDataConverter.convertToFxPrices(marketData);
        for (FxPrice fxPrice : fxPrices) {
            saveFxPrice(fxPrice);
        }
    }

    public List<FxPrice> getAllPrices() {
        return fxPriceRepository.findAll();
    }

    public FxPrice updatePrice(FxPrice fxPrice) {
        return fxPriceRepository.save(fxPrice);
    }

}