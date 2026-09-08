package com.example.fx.simulator.domain;

import java.math.BigDecimal;
import java.net.URI;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.example.fx.simulator.api.model.CallbackStatus;
import com.example.fx.simulator.api.model.RestingOrderStatus;
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
    public record RestingOrderCommand(String orderId, PricingCommand pricing, BigDecimal limitPrice,
                                      TimeInForce timeInForce, OffsetDateTime expiresAt, URI callbackUrl) {
        public RestingOrderCommand {
            Objects.requireNonNull(pricing);
            Objects.requireNonNull(callbackUrl);
            if (orderId == null || !orderId.matches("[A-Za-z0-9._:-]{1,100}")) {
                throw SimulatorApiException.invalidRestingOrder("orderId is required and must be a valid identifier.");
            }
            if (pricing.side() == null) {
                throw SimulatorApiException.invalidRestingOrder("A resting order must specify a side.");
            }
            if (limitPrice == null || limitPrice.signum() <= 0) {
                throw SimulatorApiException.invalidRestingOrder("limitPrice must be positive.");
            }
            if (timeInForce == TimeInForce.GOOD_TILL_TIME && expiresAt == null) {
                throw SimulatorApiException.invalidRestingOrder("GOOD_TILL_TIME requires expiresAt.");
            }
            if (timeInForce == TimeInForce.GOOD_TILL_CANCELLED && expiresAt != null) {
                throw SimulatorApiException.invalidRestingOrder("GOOD_TILL_CANCELLED must not carry expiresAt.");
            }
        }

        public RequestContext context() { return pricing.context(); }

        /** An order is named by its caller, so only the pair of customer and orderId is unique. */
        public RestingOrderKey key() { return new RestingOrderKey(pricing.context().identity().customerId(), orderId); }

        /** The limit is reachable when the executable client price is at or through it, on either side. */
        public boolean triggers(BigDecimal clientPrice) {
            return pricing.side() == Side.BUY
                    ? clientPrice.compareTo(limitPrice) <= 0
                    : clientPrice.compareTo(limitPrice) >= 0;
        }
    }

    /** Complete replacement of the mutable terms on a working order. */
    public record RestingOrderAmendment(RequestContext context, BigDecimal quantity, BigDecimal limitPrice,
                                        TimeInForce timeInForce, OffsetDateTime expiresAt) {
        public RestingOrderAmendment {
            Objects.requireNonNull(context);
            if (quantity == null || quantity.signum() <= 0
                    || quantity.compareTo(new BigDecimal("1000000000000")) > 0) {
                throw SimulatorApiException.invalidRestingOrder(
                        "quantity must be positive and at most 1000000000000.");
            }
            if (limitPrice == null || limitPrice.signum() <= 0) {
                throw SimulatorApiException.invalidRestingOrder("limitPrice must be positive.");
            }
            if (timeInForce == TimeInForce.GOOD_TILL_TIME && expiresAt == null) {
                throw SimulatorApiException.invalidRestingOrder("GOOD_TILL_TIME requires expiresAt.");
            }
            if (timeInForce == TimeInForce.GOOD_TILL_CANCELLED && expiresAt != null) {
                throw SimulatorApiException.invalidRestingOrder("GOOD_TILL_CANCELLED must not carry expiresAt.");
            }
        }
    }

    public record RestingOrder(RestingOrderCommand command, RestingOrderStatus status,
                               OffsetDateTime placedAt, OffsetDateTime lastEvaluatedAt, BigDecimal lastEvaluatedPrice,
                               OffsetDateTime closedAt, Trade trade,
                               CallbackStatus callbackStatus, int callbackAttempts) {

        public static RestingOrder working(RestingOrderCommand command, OffsetDateTime placedAt) {
            return new RestingOrder(command, RestingOrderStatus.WORKING, placedAt,
                    null, null, null, null, CallbackStatus.NOT_REQUIRED, 0);
        }

        public String orderId() { return command.orderId(); }

        public RestingOrderKey key() { return command.key(); }

        public boolean working() { return status == RestingOrderStatus.WORKING; }

        public boolean expiredAt(OffsetDateTime at) {
            return command.timeInForce() == TimeInForce.GOOD_TILL_TIME && !at.isBefore(command.expiresAt());
        }

        public RestingOrder evaluated(OffsetDateTime at, BigDecimal clientPrice) {
            return new RestingOrder(command, status, placedAt, at, clientPrice,
                    closedAt, trade, callbackStatus, callbackAttempts);
        }

        public RestingOrder closed(RestingOrderStatus terminal, OffsetDateTime at, Trade booked, CallbackStatus callback) {
            return new RestingOrder(command, terminal, placedAt, lastEvaluatedAt, lastEvaluatedPrice,
                    at, booked, callback, callbackAttempts);
        }

        public RestingOrder withCallback(CallbackStatus next, int attempts) {
            return new RestingOrder(command, status, placedAt, lastEvaluatedAt, lastEvaluatedPrice,
                    closedAt, trade, next, attempts);
        }

        public RestingOrder amended(RestingOrderCommand amendedCommand) {
            return new RestingOrder(amendedCommand, RestingOrderStatus.WORKING, placedAt,
                    null, null, null, null, CallbackStatus.NOT_REQUIRED, 0);
        }
    }

    public record RestingOrderKey(String customerId, String orderId) {}

    public record RestingOrderPlacement(RestingOrder order, boolean created) {}

    public record DueCallback(CallbackDelivery delivery, RestingOrder order) {}

    /** One queued notification. Retries reuse eventId so a receiver can dedupe on it. */
    public record CallbackDelivery(UUID eventId, RestingOrderKey order, OffsetDateTime occurredAt, int attempts) {
        public CallbackDelivery attempted() {
            return new CallbackDelivery(eventId, order, occurredAt, attempts + 1);
        }
    }
}
