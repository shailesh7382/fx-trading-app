package com.example.fx.simulator.service;

import com.example.fx.simulator.config.RestingOrderProperties;
import com.example.fx.simulator.domain.TradingModels.*;
import org.springframework.stereotype.Service;

@Service
public class RestingOrderService {
    private final RestingOrderStore store;
    private final FxPricingEngine pricing;
    private final RestingOrderProperties properties;

    public RestingOrderService(RestingOrderStore store, FxPricingEngine pricing, RestingOrderProperties properties) {
        this.store = store;
        this.pricing = pricing;
        this.properties = properties;
    }

    public RestingOrderPlacement place(RestingOrderCommand command) {
        if (!properties.callback().allows(command.callbackUrl())) {
            throw SimulatorApiException.callbackUrlNotAllowed(command.callbackUrl().toString());
        }
        // Price once and discard it, so an unpriceable order is rejected now rather than resting forever.
        pricing.price(command.pricing());
        return store.place(command);
    }

    public RestingOrder getRestingOrder(String orderId, RequestContext context) {
        return store.get(orderId, context.identity());
    }

    public RestingOrder cancel(String orderId, RequestContext context) {
        return store.cancel(orderId, context.identity());
    }

    public RestingOrder amend(String orderId, RestingOrderAmendment amendment) {
        RestingOrder existing = store.get(orderId, amendment.context().identity());
        PricingCommand current = existing.command().pricing();
        // Preserve creation context and immutable instrument terms; only the contract's mutable terms change.
        PricingCommand repriced = new PricingCommand(current.context(), current.currencyPair(), amendment.quantity(),
                current.quantityCurrency(), current.tenor(), current.side());
        RestingOrderCommand replacement = new RestingOrderCommand(orderId, repriced, amendment.limitPrice(),
                amendment.timeInForce(), amendment.expiresAt(), existing.command().callbackUrl());
        // Reject unpriceable amendments before mutating the working order.
        pricing.price(repriced);
        return store.amend(replacement, amendment.context().identity());
    }
}
