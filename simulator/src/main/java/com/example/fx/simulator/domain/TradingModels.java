package com.example.fx.simulator.domain;

import java.math.BigDecimal;
import java.net.URI;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.example.fx.simulator.api.model.CallbackStatus;
import com.example.fx.simulator.api.model.LimitOrderStatus;
import com.example.fx.simulator.api.model.QuoteStatus;
import com.example.fx.simulator.api.model.Side;
import com.example.fx.simulator.api.model.Tenor;
import com.example.fx.simulator.api.model.TimeInForce;
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

    /** A resting order is a pricing command the simulator re-runs on its own, plus the limit that ends the wait. */
    public record LimitOrderCommand(PricingCommand pricing, BigDecimal limitPrice, TimeInForce timeInForce,
                                    OffsetDateTime expiresAt, URI callbackUrl) {
        public LimitOrderCommand {
            Objects.requireNonNull(pricing);
            Objects.requireNonNull(callbackUrl);
            if (pricing.side() == null) {
                throw SimulatorApiException.invalidLimitOrder("A limit order must specify a side.");
            }
            if (limitPrice == null || limitPrice.signum() <= 0) {
                throw SimulatorApiException.invalidLimitOrder("limitPrice must be positive.");
            }
            if (timeInForce == TimeInForce.GOOD_TILL_TIME && expiresAt == null) {
                throw SimulatorApiException.invalidLimitOrder("GOOD_TILL_TIME requires expiresAt.");
            }
            if (timeInForce == TimeInForce.GOOD_TILL_CANCELLED && expiresAt != null) {
                throw SimulatorApiException.invalidLimitOrder("GOOD_TILL_CANCELLED must not carry expiresAt.");
            }
        }

        public RequestContext context() { return pricing.context(); }

        /** The limit is reachable when the executable client price is at or through it, on either side. */
        public boolean triggers(BigDecimal clientPrice) {
            return pricing.side() == Side.BUY
                    ? clientPrice.compareTo(limitPrice) <= 0
                    : clientPrice.compareTo(limitPrice) >= 0;
        }
    }

    public record LimitOrder(UUID orderId, LimitOrderCommand command, LimitOrderStatus status,
                             OffsetDateTime placedAt, OffsetDateTime lastEvaluatedAt, BigDecimal lastEvaluatedPrice,
                             OffsetDateTime closedAt, Trade trade,
                             CallbackStatus callbackStatus, int callbackAttempts) {

        public static LimitOrder working(UUID orderId, LimitOrderCommand command, OffsetDateTime placedAt) {
            return new LimitOrder(orderId, command, LimitOrderStatus.WORKING, placedAt,
                    null, null, null, null, CallbackStatus.NOT_REQUIRED, 0);
        }

        public boolean working() { return status == LimitOrderStatus.WORKING; }

        public boolean expiredAt(OffsetDateTime at) {
            return command.timeInForce() == TimeInForce.GOOD_TILL_TIME && !at.isBefore(command.expiresAt());
        }

        public LimitOrder evaluated(OffsetDateTime at, BigDecimal clientPrice) {
            return new LimitOrder(orderId, command, status, placedAt, at, clientPrice,
                    closedAt, trade, callbackStatus, callbackAttempts);
        }

        public LimitOrder closed(LimitOrderStatus terminal, OffsetDateTime at, Trade booked, CallbackStatus callback) {
            return new LimitOrder(orderId, command, terminal, placedAt, lastEvaluatedAt, lastEvaluatedPrice,
                    at, booked, callback, callbackAttempts);
        }

        public LimitOrder withCallback(CallbackStatus next, int attempts) {
            return new LimitOrder(orderId, command, status, placedAt, lastEvaluatedAt, lastEvaluatedPrice,
                    closedAt, trade, next, attempts);
        }
    }

    public record LimitOrderPlacement(LimitOrder order, boolean created) {}

    public record DueCallback(CallbackDelivery delivery, LimitOrder order) {}

    /** One queued notification. Retries reuse eventId so a receiver can dedupe on it. */
    public record CallbackDelivery(UUID eventId, UUID orderId, OffsetDateTime occurredAt, int attempts) {
        public CallbackDelivery attempted() {
            return new CallbackDelivery(eventId, orderId, occurredAt, attempts + 1);
        }
    }
}
