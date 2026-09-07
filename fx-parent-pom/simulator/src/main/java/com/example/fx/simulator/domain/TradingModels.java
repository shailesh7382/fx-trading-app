package com.example.fx.simulator.domain;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.example.fx.simulator.api.model.QuoteStatus;
import com.example.fx.simulator.api.model.Side;
import com.example.fx.simulator.api.model.Tenor;
import com.example.fx.simulator.service.SimulatorApiException;

public final class TradingModels {
    private TradingModels() {}

    public record Identity(String channel, String segment, String customerId) {
        public Identity {
            if (channel == null || !channel.matches("\\S{1,20}")
                    || segment == null || !segment.matches("\\S")
                    || customerId == null || !customerId.matches("\\S{10}")) {
                throw SimulatorApiException.invalidRequest("Invalid channel, segment, or customerId.");
            }
        }
    }

    public record RequestContext(String requestId, Identity identity) {
        public RequestContext {
            if (requestId == null || !requestId.matches("[A-Za-z0-9._:-]{1,100}")) {
                throw SimulatorApiException.invalidRequest("Invalid requestId.");
            }
            Objects.requireNonNull(identity);
        }

        public RequestContext(String requestId, String channel, String segment, String customerId) {
            this(requestId, new Identity(channel, segment, customerId));
        }
    }

    public record PricingCommand(RequestContext context, String currencyPair, BigDecimal quantity,
                                 String quantityCurrency, Tenor tenor, Side side) {
        public PricingCommand {
            Objects.requireNonNull(context);
            Objects.requireNonNull(tenor);
            if (currencyPair == null || !currencyPair.matches("[A-Z]{6}")
                    || quantityCurrency == null
                    || !(currencyPair.substring(0, 3).equals(quantityCurrency)
                    || currencyPair.substring(3).equals(quantityCurrency))) {
                throw SimulatorApiException.invalidPricingRequest("quantityCurrency must be a leg of currencyPair.");
            }
            if (quantity == null || quantity.signum() <= 0
                    || quantity.compareTo(new BigDecimal("1000000000000")) > 0) {
                throw SimulatorApiException.invalidPricingRequest("quantity must be positive and at most 1000000000000.");
            }
        }
        public boolean twoWay() { return side == null; }
    }

    public record SettlementDates(LocalDate spotDate, LocalDate valueDate) {}
    public record Price(Side side, BigDecimal coverPrice, BigDecimal clientPrice, BigDecimal swapPoints) {}
    public record Settlement(String buyCurrency, BigDecimal buyQuantity, String sellCurrency, BigDecimal sellQuantity) {}

    public record Quote(UUID quoteId, PricingCommand command, Map<Side, Price> prices,
                        SettlementDates dates, OffsetDateTime quotedAt, OffsetDateTime expiresAt,
                        QuoteStatus status) {
        public Quote {
            prices = Map.copyOf(prices);
        }
        public QuoteStatus statusAt(OffsetDateTime at) {
            return status == QuoteStatus.ACTIVE && !at.isBefore(expiresAt) ? QuoteStatus.EXPIRED : status;
        }
        public Quote withStatus(QuoteStatus next) {
            return new Quote(quoteId, command, prices, dates, quotedAt, expiresAt, next);
        }
    }

    public record Trade(UUID tradeId, RequestContext originalContext, Quote quote, Price price,
                        Settlement settlement, OffsetDateTime bookedAt) {}
    public record BookingResult(Trade trade, boolean created) {}
}
