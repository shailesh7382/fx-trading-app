package com.example.util;

import com.example.model.FxPrice;
import com.example.MarketData;
import com.example.model.Source;
import com.example.model.Status;
import com.example.model.Tenor;

import java.time.LocalDateTime;

public class MarketDataConverter {

    public static FxPrice convertToFxPrice(MarketData marketData, int volumeIndex) {
        String ccyPair = marketData.getCcyPair();
        double bid = marketData.getBidPrices().isEmpty() ? 0.0 : marketData.getBidPrices().get(0);
        double ask = marketData.getAskPrices().isEmpty() ? 0.0 : marketData.getAskPrices().get(0);
        double bidPoints = marketData.getBidPoints().isEmpty() ? 0.0 : marketData.getBidPoints().get(0);
        double askPoints = marketData.getAskPoints().isEmpty() ? 0.0 : marketData.getAskPoints().get(0);
        Tenor tenor = Tenor.valueOf(marketData.getTenor().toUpperCase());
        LocalDateTime updatedAt = marketData.getEventTime();
        Source source = Source.MQ; // Assuming source is MQ for this example
        double qty = (marketData.getVolumes().size() > volumeIndex) ? marketData.getVolumes().get(volumeIndex) : 0.0;
        Status status = Status.valueOf(marketData.getStatus().toUpperCase());

        return new FxPrice(ccyPair, bid, ask, bidPoints, askPoints, tenor, updatedAt, source, qty, status);
    }
}