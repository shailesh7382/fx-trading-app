package com.example.fx.backend.pricing.controller;

import com.example.fx.backend.pricing.service.LimitOrderService;
import com.example.fx.simulator.api.model.RestingOrderEvent;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/resting-orders/events")
public class RestingOrderEventController {
    private final LimitOrderService orders;

    public RestingOrderEventController(LimitOrderService orders) {
        this.orders = orders;
    }

    @PostMapping
    public ResponseEntity<Void> receive(@Valid @RequestBody RestingOrderEvent event) {
        orders.receiveEvent(event);
        return ResponseEntity.noContent().build();
    }
}
