package com.example.fx.simulator.service;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.random.RandomGenerator;
import com.example.fx.simulator.api.model.QuoteStatus;
import com.example.fx.simulator.api.model.Side;
import com.example.fx.simulator.domain.TradingModels.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class FxPricingEngine {
    private static final Map<String, BigDecimal> REFERENCE_RATES = Map.ofEntries(
            Map.entry("EURUSD", new BigDecimal("1.10000")),
            Map.entry("GBPUSD", new BigDecimal("1.30000")),
            Map.entry("USDJPY", new BigDecimal("145.000")),
            Map.entry("AUDUSD", new BigDecimal("0.70000")),
            Map.entry("USDCAD", new BigDecimal("1.25000")),
            Map.entry("NZDUSD", new BigDecimal("0.65000")),
            Map.entry("USDCHF", new BigDecimal("0.90000")),
            Map.entry("EURGBP", new BigDecimal("0.85000")),
            Map.entry("EURJPY", new BigDecimal("159.500")),
            Map.entry("GBPJPY", new BigDecimal("188.500")),
            Map.entry("AUDJPY", new BigDecimal("101.500")),
            Map.entry("CADJPY", new BigDecimal("116.000")),
            Map.entry("CHFJPY", new BigDecimal("161.000")),
            Map.entry("NZDJPY", new BigDecimal("94.250")),
            Map.entry("EURCAD", new BigDecimal("1.37500")),
            Map.entry("GBPCAD", new BigDecimal("1.62500")),
            Map.entry("AUDCAD", new BigDecimal("0.87500")),
            Map.entry("NZDCAD", new BigDecimal("0.81250")),
            Map.entry("EURCHF", new BigDecimal("0.99000")),
            Map.entry("GBPCHF", new BigDecimal("1.17000")),
            Map.entry("AUDCHF", new BigDecimal("0.63000")),
            Map.entry("CADCHF", new BigDecimal("0.72000")),
            Map.entry("NZDCHF", new BigDecimal("0.58500")),
            Map.entry("EURNZD", new BigDecimal("1.69230")),
            Map.entry("GBPNZD", new BigDecimal("2.00000")),
            Map.entry("AUDNZD", new BigDecimal("1.07690")),
            Map.entry("CADNZD", new BigDecimal("1.53850")),
            Map.entry("CHFNZD", new BigDecimal("1.70940"))
    );


    private final Clock clock;
    private final RandomGenerator random;
    private final FxSwapCurve swapCurve;
    private final SettlementDateCalculator dates;
    private final SettlementCalculator settlement;
    private final Duration quoteTtl;

    public FxPricingEngine(Clock clock, RandomGenerator random, FxSwapCurve swapCurve,
                           SettlementDateCalculator dates, SettlementCalculator settlement,
                           @Value("${simulator.quote-ttl:30s}") Duration quoteTtl) {
        if (quoteTtl.isNegative() || quoteTtl.isZero()) throw new IllegalArgumentException("quote-ttl must be positive");
        this.clock = clock;
        this.random = random;
        this.swapCurve = swapCurve;
        this.dates = dates;
        this.settlement = settlement;
        this.quoteTtl = quoteTtl;
    }

    public Quote price(PricingCommand command) {
        BigDecimal reference = REFERENCE_RATES.get(command.currencyPair());
        if (reference == null) throw SimulatorApiException.unsupportedInstrument(command.currencyPair());
        settlement.validateQuantity(command);
        OffsetDateTime now = OffsetDateTime.now(clock);
        SettlementDates settlementDates = dates.calculate(command.currencyPair(), now.toLocalDate(), command.tenor());
        int scale = command.currencyPair().endsWith("JPY") ? 3 : 5;
        BigDecimal spot = reference.add(randomMovement(scale));
        BigDecimal points = swapCurve.swapPoints(command.currencyPair(), command.tenor(), spot,
                settlementDates.spotDate(), settlementDates.valueDate(), scale);
        BigDecimal forward = spot.add(points);
        BigDecimal baseNotional = command.currencyPair().startsWith(command.quantityCurrency())
                ? command.quantity()
                : command.quantity().divide(spot, MathContext.DECIMAL128);
        BigDecimal halfSpread = halfSpread(baseNotional, scale);
        BigDecimal markup = halfSpread.multiply(new BigDecimal("0.75"));
        Map<Side, Price> prices = new EnumMap<>(Side.class);
        for (Side side : command.twoWay() ? List.of(Side.BUY, Side.SELL) : List.of(command.side())) {
            boolean buysBase = command.currencyPair().startsWith(command.quantityCurrency()) == (side == Side.BUY);
            BigDecimal cover = buysBase ? forward.add(halfSpread) : forward.subtract(halfSpread);
            BigDecimal client = buysBase ? cover.add(markup) : cover.subtract(markup);
            Price price = new Price(side, cover.setScale(scale, RoundingMode.HALF_UP),
                    client.setScale(scale, RoundingMode.HALF_UP), points);
            // Both sides must be settleable before publishing a two-way quote.
            settlement.calculate(command, price);
            prices.put(side, price);
        }
        return new Quote(UUID.randomUUID(), command, prices, settlementDates, now, now.plus(quoteTtl), QuoteStatus.ACTIVE);
    }

    private BigDecimal randomMovement(int scale) {
        double sample;
        synchronized (random) { sample = random.nextDouble(); }
        return BigDecimal.valueOf(sample * 2.0 - 1.0)
                .multiply(scale == 3 ? new BigDecimal("0.050") : new BigDecimal("0.00050"));
    }

    private BigDecimal halfSpread(BigDecimal baseNotional, int scale) {
        BigDecimal sizeFactor = baseNotional.divide(new BigDecimal("25000000"), MathContext.DECIMAL128)
                .min(new BigDecimal("4")).multiply(new BigDecimal("0.25")).add(BigDecimal.ONE);
        return (scale == 3 ? new BigDecimal("0.005") : new BigDecimal("0.00005")).multiply(sizeFactor);
    }
}
