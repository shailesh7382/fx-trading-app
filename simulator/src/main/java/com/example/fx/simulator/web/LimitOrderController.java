package com.example.fx.simulator.web;

import java.net.URI;
import java.util.UUID;

import com.example.fx.simulator.api.LimitOrdersApi;
import com.example.fx.simulator.api.model.LimitOrderRequest;
import com.example.fx.simulator.domain.TradingModels.*;
import com.example.fx.simulator.service.LimitOrderService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class LimitOrderController implements LimitOrdersApi {

    private final LimitOrderService limitOrderService;
    private final SimulatorApiMapper mapper;

    public LimitOrderController(LimitOrderService limitOrderService, SimulatorApiMapper mapper) {
        this.limitOrderService = limitOrderService;
        this.mapper = mapper;
    }

    @Override
    public ResponseEntity<com.example.fx.simulator.api.model.LimitOrder> placeLimitOrder(
            String idempotencyKey, LimitOrderRequest limitOrderRequest) {
        LimitOrderCommand command = mapper.limitOrderCommand(limitOrderRequest);
        LimitOrderPlacement placement = limitOrderService.place(idempotencyKey, command);
        if (!placement.created()) {
            return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON)
                    .body(mapper.limitOrder(placement.order(), command.context()));
        }
        return ResponseEntity
                .created(URI.create("/api/v1/limit-orders/" + placement.order().orderId()))
                .contentType(MediaType.APPLICATION_JSON)
                .body(mapper.limitOrder(placement.order(), command.context()));
    }

    @Override
    public ResponseEntity<com.example.fx.simulator.api.model.LimitOrder> getLimitOrder(
            UUID orderId, String xRequestId, String xChannel, String xSegment, String xCustomerId) {
        RequestContext context = new RequestContext(xRequestId, xChannel, xSegment, xCustomerId);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON)
                .body(mapper.limitOrder(limitOrderService.getLimitOrder(orderId, context), context));
    }

    @Override
    public ResponseEntity<com.example.fx.simulator.api.model.LimitOrder> cancelLimitOrder(
            UUID orderId, String xRequestId, String xChannel, String xSegment, String xCustomerId) {
        RequestContext context = new RequestContext(xRequestId, xChannel, xSegment, xCustomerId);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON)
                .body(mapper.limitOrder(limitOrderService.cancel(orderId, context), context));
    }
}
