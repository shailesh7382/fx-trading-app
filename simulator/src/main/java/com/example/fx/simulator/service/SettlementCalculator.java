package com.example.fx.simulator.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import com.example.fx.tradingsystems.api.model.Side;
import com.example.fx.simulator.domain.TradingModels.*;
import org.springframework.stereotype.Component;

@Component
public class SettlementCalculator {
    public void validateQuantity(PricingCommand command) {
        try {
            command.quantity().setScale(scale(command.quantityCurrency()), RoundingMode.UNNECESSARY);
        } catch (ArithmeticException exception) {
            throw SimulatorApiException.invalidPricingRequest("quantity must fit the currency's minor units.");
        }
    }

    public Settlement calculate(PricingCommand command, Price price) {
        String base = command.currencyPair().substring(0, 3);
        String counter = command.currencyPair().substring(3);
        boolean amountIsBase = command.quantityCurrency().equals(base);
        String other = amountIsBase ? counter : base;
        BigDecimal requested = command.quantity().setScale(scale(command.quantityCurrency()), RoundingMode.UNNECESSARY);
        BigDecimal derived = amountIsBase
                ? requested.multiply(price.clientPrice()).setScale(scale(other), RoundingMode.HALF_UP)
                : requested.divide(price.clientPrice(), scale(other), RoundingMode.HALF_UP);
        if (derived.signum() <= 0) {
            throw SimulatorApiException.invalidPricingRequest("The counter amount rounds to zero.");
        }
        return price.side() == Side.BUY
                ? new Settlement(command.quantityCurrency(), requested, other, derived)
                : new Settlement(other, derived, command.quantityCurrency(), requested);
    }

    private int scale(String currency) {
        return currency.equals("JPY") ? 0 : 2;
    }
}
