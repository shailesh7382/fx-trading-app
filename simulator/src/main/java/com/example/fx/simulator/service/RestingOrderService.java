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
}
