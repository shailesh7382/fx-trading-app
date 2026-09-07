package com.example.fx.simulator.service;

import java.util.UUID;
import com.example.fx.simulator.config.LimitOrderProperties;
import com.example.fx.simulator.domain.TradingModels.*;
import org.springframework.stereotype.Service;

@Service
public class LimitOrderService {
    private final LimitOrderStore store;
    private final FxPricingEngine pricing;
    private final LimitOrderProperties properties;

    public LimitOrderService(LimitOrderStore store, FxPricingEngine pricing, LimitOrderProperties properties) {
        this.store = store;
        this.pricing = pricing;
        this.properties = properties;
    }

    public LimitOrderPlacement place(String idempotencyKey, LimitOrderCommand command) {
        if (idempotencyKey == null || !idempotencyKey.matches("[A-Za-z0-9._:-]{1,100}")) {
            throw SimulatorApiException.invalidRequest("Idempotency-Key is required.");
        }
        if (!properties.callback().allows(command.callbackUrl())) {
            throw SimulatorApiException.callbackUrlNotAllowed(command.callbackUrl().toString());
        }
        // Price once and discard it, so an unpriceable order is rejected now rather than resting forever.
        pricing.price(command.pricing());
        return store.place(idempotencyKey, command);
    }

    public LimitOrder getLimitOrder(UUID orderId, RequestContext context) {
        return store.get(orderId, context.identity());
    }

    public LimitOrder cancel(UUID orderId, RequestContext context) {
        return store.cancel(orderId, context.identity());
    }
}
