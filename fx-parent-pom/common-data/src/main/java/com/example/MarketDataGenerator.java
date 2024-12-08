package com.example;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Random;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MarketDataGenerator implements AutoCloseable {
    private final List<String> ccyPairs = Arrays.asList(
            "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "NZDUSD", "USDCHF", "EURGBP",
            "EURJPY", "GBPJPY", "AUDJPY", "CADJPY", "CHFJPY", "NZDJPY", "EURCAD", "GBPCAD",
            "AUDCAD", "NZDCAD", "EURCHF", "GBPCHF", "AUDCHF", "CADCHF", "NZDCHF", "EURNZD",
            "GBPNZD", "AUDNZD", "CADNZD", "CHFNZD"
    );
    private final Random random = new Random();
    private final MarketDataUpdateListener listener;
    private final ExecutorService executorService = Executors.newSingleThreadExecutor();
    private volatile boolean running = true;

    public MarketDataGenerator(MarketDataUpdateListener listener) {
        this.listener = listener;
    }

    public void generateMarketData() {
        executorService.submit(() -> {
            while (running) {
                try {
                    Thread.sleep(1000L);
                    for (int i = 0; i < 3; i++) {

                        String ccyPair = ccyPairs.get(random.nextInt(ccyPairs.size()));
                        LocalDateTime currentDate = LocalDateTime.now();

                        double bidPrice = getLatestBidPrice(ccyPair);
                        double askPrice = getLatestAskPrice(ccyPair);
                        int decimalPlaces = getDecimalPlaces(ccyPair);

                        List<Double> amountBands = generateRandomAmountBands();
                        List<Double> bidPrices = generatePrices(bidPrice, amountBands.size(), true, decimalPlaces);
                        List<Double> askPrices = generatePrices(askPrice, amountBands.size(), false, decimalPlaces);
                        List<Double> bidPoints = generatePoints(amountBands.size());
                        List<Double> askPoints = generatePoints(amountBands.size());

                        MarketData md = new MarketData(
                                currentDate,
                                ccyPair,
                                bidPrices,
                                askPrices,
                                amountBands,
                                bidPoints,
                                askPoints,
                                "quoteReq_",
                                "quote_",
                                "LP_",
                                "status_",
                                "SP"
                        );

                        listener.onMarketDataUpdate(md);

                    }
                } catch (Exception e) {
                    Thread.currentThread().interrupt();
                    e.printStackTrace();
                }
            }
        });
    }

    public void close() {
        running = false;
        executorService.shutdownNow();
    }

    private double getLatestBidPrice(String ccyPair) {
        switch (ccyPair) {
            case "EURUSD":
                return 1.1000 + random.nextDouble() * 0.01;
            case "GBPUSD":
                return 1.3000 + random.nextDouble() * 0.01;
            case "USDJPY":
                return 110.00 + random.nextDouble();
            case "AUDUSD":
                return 0.7000 + random.nextDouble() * 0.01;
            case "USDCAD":
                return 1.2500 + random.nextDouble() * 0.01;
            case "NZDUSD":
                return 0.6500 + random.nextDouble() * 0.01;
            case "USDCHF":
                return 0.9000 + random.nextDouble() * 0.01;
            case "EURGBP":
                return 0.8500 + random.nextDouble() * 0.01;
            case "EURJPY":
                return 130.00 + random.nextDouble();
            case "GBPJPY":
                return 150.00 + random.nextDouble();
            case "AUDJPY":
                return 80.00 + random.nextDouble();
            case "CADJPY":
                return 85.00 + random.nextDouble();
            case "CHFJPY":
                return 115.00 + random.nextDouble();
            case "NZDJPY":
                return 75.00 + random.nextDouble();
            case "EURCAD":
                return 1.4500 + random.nextDouble() * 0.01;
            case "GBPCAD":
                return 1.7000 + random.nextDouble() * 0.01;
            case "AUDCAD":
                return 0.9500 + random.nextDouble() * 0.01;
            case "NZDCAD":
                return 0.8500 + random.nextDouble() * 0.01;
            case "EURCHF":
                return 1.1000 + random.nextDouble() * 0.01;
            case "GBPCHF":
                return 1.2500 + random.nextDouble() * 0.01;
            case "AUDCHF":
                return 0.6500 + random.nextDouble() * 0.01;
            case "CADCHF":
                return 0.7000 + random.nextDouble() * 0.01;
            case "NZDCHF":
                return 0.6000 + random.nextDouble() * 0.01;
            case "EURNZD":
                return 1.7000 + random.nextDouble() * 0.01;
            case "GBPNZD":
                return 1.9000 + random.nextDouble() * 0.01;
            case "AUDNZD":
                return 1.0500 + random.nextDouble() * 0.01;
            case "CADNZD":
                return 1.1000 + random.nextDouble() * 0.01;
            case "CHFNZD":
                return 1.2000 + random.nextDouble() * 0.01;
            default:
                return 1.0000;
        }
    }

    private double getLatestAskPrice(String ccyPair) {
        switch (ccyPair) {
            case "EURUSD":
                return 1.1005 + random.nextDouble() * 0.01;
            case "GBPUSD":
                return 1.3005 + random.nextDouble() * 0.01;
            case "USDJPY":
                return 110.05 + random.nextDouble();
            case "AUDUSD":
                return 0.7005 + random.nextDouble() * 0.01;
            case "USDCAD":
                return 1.2505 + random.nextDouble() * 0.01;
            case "NZDUSD":
                return 0.6505 + random.nextDouble() * 0.01;
            case "USDCHF":
                return 0.9005 + random.nextDouble() * 0.01;
            case "EURGBP":
                return 0.8505 + random.nextDouble() * 0.01;
            case "EURJPY":
                return 130.05 + random.nextDouble();
            case "GBPJPY":
                return 150.05 + random.nextDouble();
            case "AUDJPY":
                return 80.05 + random.nextDouble();
            case "CADJPY":
                return 85.05 + random.nextDouble();
            case "CHFJPY":
                return 115.05 + random.nextDouble();
            case "NZDJPY":
                return 75.05 + random.nextDouble();
            case "EURCAD":
                return 1.4505 + random.nextDouble() * 0.01;
            case "GBPCAD":
                return 1.7005 + random.nextDouble() * 0.01;
            case "AUDCAD":
                return 0.9505 + random.nextDouble() * 0.01;
            case "NZDCAD":
                return 0.8505 + random.nextDouble() * 0.01;
            case "EURCHF":
                return 1.1005 + random.nextDouble() * 0.01;
            case "GBPCHF":
                return 1.2505 + random.nextDouble() * 0.01;
            case "AUDCHF":
                return 0.6505 + random.nextDouble() * 0.01;
            case "CADCHF":
                return 0.7005 + random.nextDouble() * 0.01;
            case "NZDCHF":
                return 0.6005 + random.nextDouble() * 0.01;
            case "EURNZD":
                return 1.7005 + random.nextDouble() * 0.01;
            case "GBPNZD":
                return 1.9005 + random.nextDouble() * 0.01;
            case "AUDNZD":
                return 1.0505 + random.nextDouble() * 0.01;
            case "CADNZD":
                return 1.1005 + random.nextDouble() * 0.01;
            case "CHFNZD":
                return 1.2005 + random.nextDouble() * 0.01;
            default:
                return 1.0005;
        }
    }

    private int getDecimalPlaces(String ccyPair) {
        if (ccyPair.contains("JPY")) {
            return 3;
        }
        return 5;
    }

    private List<Double> generateRandomAmountBands() {
        int numBands = 5 + random.nextInt(5);
        List<Double> amountBands = new ArrayList<>();
        for (int i = 0; i < numBands; i++) {
            amountBands.add((double) (1_000_000L * (i + 1)));
        }
        return amountBands;
    }

    private List<Double> generatePrices(double basePrice, int size, boolean isBid, int decimalPlaces) {
        List<Double> prices = new ArrayList<>();
        for (int i = 0; i < size; i++) {
            prices.add(Math.round((basePrice + random.nextDouble() * 0.01) * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces));
        }
        if (isBid) {
            prices.sort((a, b) -> Double.compare(b, a));
        } else {
            prices.sort(Double::compare);
        }
        return prices;
    }

    private List<Double> generatePoints(int size) {
        List<Double> points = new ArrayList<>();
        for (int i = 0; i < size; i++) {
            points.add(Math.round(random.nextDouble() * 0.01 * 100000.0) / 100000.0);
        }
        return points;
    }
}