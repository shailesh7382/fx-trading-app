package com.example.service;

import com.example.FxPriceDTO;
import com.example.MarketData;
import com.example.MarketDataUpdateListener;
import com.example.Tenor;
import com.example.model.FxPrice;
import com.example.repository.FxPriceRepository;
import com.example.util.MarketDataConverter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class FxPriceService implements MarketDataUpdateListener {

    @Autowired
    private FxPriceRepository fxPriceRepository;

    @Autowired
    private LimitOrderService limitOrderService;

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

        limitOrderService.evaluateTriggeredOrders(ccyPair, tenor.getLabel(), fxPrices);
    }

    public List<FxPrice> getAllPrices() {
        return fxPriceRepository.findAll();
    }

    public List<FxPriceDTO> getGridPrices(String search, String tenor, String sortBy, int limit) {
        String normalizedSearch = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        String normalizedTenor = tenor == null || tenor.isBlank() ? "SP" : tenor.trim().toUpperCase(Locale.ROOT);
        int safeLimit = Math.max(1, Math.min(limit, 12));

        Map<String, FxPrice> groupedPrices = getAllPrices().stream()
                .filter(fxPrice -> normalizedSearch.isEmpty() || fxPrice.getCcyPair().toLowerCase(Locale.ROOT).contains(normalizedSearch))
                .filter(fxPrice -> "ALL".equals(normalizedTenor) || fxPrice.getTenorLabel().equalsIgnoreCase(normalizedTenor))
                .collect(Collectors.toMap(
                        fxPrice -> fxPrice.getCcyPair() + "|" + fxPrice.getTenorLabel(),
                        fxPrice -> fxPrice,
                        this::pickDisplayPrice,
                        LinkedHashMap::new
                ));

        return groupedPrices.values().stream()
                .sorted(buildGridComparator(sortBy))
                .limit(safeLimit)
                .map(FxPriceDTO::new)
                .collect(Collectors.toList());
    }

    private FxPrice pickDisplayPrice(FxPrice left, FxPrice right) {
        Comparator<FxPrice> comparator = Comparator
                .comparing(FxPrice::getUpdatedAt, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(FxPrice::getQty, Comparator.reverseOrder());

        return comparator.compare(left, right) >= 0 ? left : right;
    }

    private Comparator<FxPrice> buildGridComparator(String sortBy) {
        String normalizedSort = sortBy == null ? "pair" : sortBy.trim().toLowerCase(Locale.ROOT);

        switch (normalizedSort) {
            case "updated":
                return Comparator.comparing(FxPrice::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(FxPrice::getCcyPair);
            case "spread":
                return Comparator.comparingDouble(this::getSpread)
                        .thenComparing(FxPrice::getCcyPair);
            default:
                return Comparator.comparing(FxPrice::getCcyPair)
                        .thenComparingInt(fxPrice -> getTenorOrder(fxPrice.getTenorLabel()));
        }
    }

    private double getSpread(FxPrice fxPrice) {
        return Math.abs(fxPrice.getAsk() - fxPrice.getBid());
    }

    private int getTenorOrder(String tenor) {
        switch (tenor) {
            case "SP":
                return 0;
            case "1W":
                return 1;
            case "1M":
                return 2;
            case "6M":
                return 3;
            case "1Y":
                return 4;
            case "3M":
                return 5;
            default:
                return Integer.MAX_VALUE;
        }
    }

    public FxPrice updatePrice(FxPrice fxPrice) {
        FxPrice savedPrice = fxPriceRepository.save(fxPrice);
        limitOrderService.evaluateTriggeredOrders(
                savedPrice.getCcyPair(),
                savedPrice.getTenorLabel(),
                fxPriceRepository.findByCcyPairAndTenor(savedPrice.getCcyPair(), savedPrice.getTenor())
        );
        return savedPrice;
    }

}