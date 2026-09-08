package com.example.fx.simulator.web;

import java.net.URI;

import com.example.fx.simulator.api.RestingOrdersApi;
import com.example.fx.simulator.api.model.RestingOrderRequest;
import com.example.fx.simulator.api.model.RestingOrderAmendRequest;
import com.example.fx.simulator.domain.TradingModels.*;
import com.example.fx.simulator.service.RestingOrderService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RestingOrderController implements RestingOrdersApi {

    private final RestingOrderService restingOrderService;
    private final SimulatorApiMapper mapper;

    public RestingOrderController(RestingOrderService restingOrderService, SimulatorApiMapper mapper) {
        this.restingOrderService = restingOrderService;
        this.mapper = mapper;
    }

    @Override
    public ResponseEntity<com.example.fx.simulator.api.model.RestingOrder> placeRestingOrder(
            RestingOrderRequest restingOrderRequest) {
        RestingOrderCommand command = mapper.restingOrderCommand(restingOrderRequest);
        RestingOrderPlacement placement = restingOrderService.place(command);
        if (!placement.created()) {
            return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON)
                    .body(mapper.restingOrder(placement.order(), command.context()));
        }
        return ResponseEntity
                .created(URI.create("/api/v1/resting-orders/" + placement.order().orderId()))
                .contentType(MediaType.APPLICATION_JSON)
                .body(mapper.restingOrder(placement.order(), command.context()));
    }

    @Override
    public ResponseEntity<com.example.fx.simulator.api.model.RestingOrder> getRestingOrder(
            String orderId, String xRequestId, String xChannel, String xSegment, String xCustomerId) {
        RequestContext context = new RequestContext(xRequestId, xChannel, xSegment, xCustomerId);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON)
                .body(mapper.restingOrder(restingOrderService.getRestingOrder(orderId, context), context));
    }

    @Override
    public ResponseEntity<com.example.fx.simulator.api.model.RestingOrder> cancelRestingOrder(
            String orderId, String xRequestId, String xChannel, String xSegment, String xCustomerId) {
        RequestContext context = new RequestContext(xRequestId, xChannel, xSegment, xCustomerId);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON)
                .body(mapper.restingOrder(restingOrderService.cancel(orderId, context), context));
    }

    @Override
    public ResponseEntity<com.example.fx.simulator.api.model.RestingOrder> amendRestingOrder(
            String orderId, RestingOrderAmendRequest restingOrderAmendRequest) {
        RestingOrderAmendment amendment = mapper.restingOrderAmendment(restingOrderAmendRequest);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON)
                .body(mapper.restingOrder(restingOrderService.amend(orderId, amendment), amendment.context()));
    }
}
