package com.example.fx.simulator.service;

import com.example.fx.simulator.config.RestingOrderProperties;
import com.example.fx.simulator.domain.TradingModels.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class RestingOrderService {
    private static final Logger LOG = LoggerFactory.getLogger(RestingOrderService.class);

    private final RestingOrderStore store;
    private final FxPricingEngine pricing;
    private final RestingOrderProperties properties;

    public RestingOrderService(RestingOrderStore store, FxPricingEngine pricing, RestingOrderProperties properties) {
        this.store = store;
        this.pricing = pricing;
        this.properties = properties;
    }

    public RestingOrderPlacement place(RestingOrderCommand command) {
        LOG.info("Placing resting order orderId={} requestId={} pair={} side={} quantity={} {} limitPrice={} "
                        + "timeInForce={}",
                command.orderId(), command.pricing().context().requestId(), command.pricing().currencyPair(),
                command.pricing().side(), command.pricing().quantity(), command.pricing().quantityCurrency(),
                command.limitPrice(), command.timeInForce());
        if (!properties.callback().allows(command.callbackUrl())) {
            throw SimulatorApiException.callbackUrlNotAllowed(command.callbackUrl().toString());
        }
        // Price once and discard it, so an unpriceable order is rejected now rather than resting forever.
        pricing.price(command.pricing());
        RestingOrderPlacement placement = store.place(command);
        LOG.info("Resting order {} orderId={} status={}", placement.created() ? "created" : "replayed",
                placement.order().orderId(), placement.order().status());
        return placement;
    }

    public RestingOrder getRestingOrder(String orderId, RequestContext context) {
        LOG.debug("Looking up resting order orderId={} requestId={}", orderId, context.requestId());
        return store.get(orderId, context.identity());
    }

    public RestingOrder cancel(String orderId, RequestContext context) {
        LOG.info("Cancelling resting order orderId={} requestId={}", orderId, context.requestId());
        RestingOrder cancelled = store.cancel(orderId, context.identity());
        LOG.info("Resting order cancelled orderId={} status={}", orderId, cancelled.status());
        return cancelled;
    }

    public RestingOrder amend(String orderId, RestingOrderAmendment amendment) {
        LOG.info("Amending resting order orderId={} requestId={} quantity={} limitPrice={} timeInForce={}",
                orderId, amendment.context().requestId(), amendment.quantity(), amendment.limitPrice(),
                amendment.timeInForce());
        RestingOrder existing = store.get(orderId, amendment.context().identity());
        PricingCommand current = existing.command().pricing();
        // Preserve creation context and immutable instrument terms; only the contract's mutable terms change.
        PricingCommand repriced = new PricingCommand(current.context(), current.currencyPair(), amendment.quantity(),
                current.quantityCurrency(), current.tenor(), current.side());
        RestingOrderCommand replacement = new RestingOrderCommand(orderId, repriced, amendment.limitPrice(),
                amendment.timeInForce(), amendment.expiresAt(), existing.command().callbackUrl());
        // Reject unpriceable amendments before mutating the working order.
        pricing.price(repriced);
        RestingOrder amended = store.amend(replacement, amendment.context().identity());
        LOG.info("Resting order amended orderId={} status={} expiresAt={}",
                orderId, amended.status(), amended.command().expiresAt());
        return amended;
    }
}
