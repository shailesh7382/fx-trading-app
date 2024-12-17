package com.example.util;

import com.example.model.FxPrice;
import com.example.MarketData;
import com.example.Tenor;
import com.example.model.Source;
import com.example.model.Status;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class MarketDataConverter {

    public static List<FxPrice> convertToFxPrices(MarketData marketData) {
        List<FxPrice> fxPrices = new ArrayList<>();
        String ccyPair = marketData.getCcyPair();
        Tenor tenor = Tenor.valueOf(marketData.getTenor());
        LocalDateTime updatedAt = marketData.getEventTime();
        Source source = Source.MQ; // Assuming source is MQ for this example
        Status status = Status.valueOf(marketData.getStatus().toUpperCase());

        for (int i = 0; i < marketData.getVolumes().size(); i++) {
            double bid = (marketData.getBidPrices().size() > i) ? marketData.getBidPrices().get(i) : 0.0;
            double ask = (marketData.getAskPrices().size() > i) ? marketData.getAskPrices().get(i) : 0.0;
            double bidPoints = (marketData.getBidPoints().size() > i) ? marketData.getBidPoints().get(i) : 0.0;
            double askPoints = (marketData.getAskPoints().size() > i) ? marketData.getAskPoints().get(i) : 0.0;
            double qty = marketData.getVolumes().get(i);
            FxPrice fxPrice = new FxPrice(ccyPair, bid, ask, bidPoints, askPoints, tenor, updatedAt, source, qty, status);
            fxPrices.add(fxPrice);
        }

        return fxPrices;
    }
}