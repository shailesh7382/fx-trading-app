package com.example;

import com.example.model.LimitOrder;
import com.example.service.LimitOrderService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/limit-orders")
public class LimitOrderController {

    private final LimitOrderService limitOrderService;

    public LimitOrderController(LimitOrderService limitOrderService) {
        this.limitOrderService = limitOrderService;
    }

    @GetMapping
    public List<LimitOrder> getLimitOrders(
            @RequestParam(defaultValue = "ACTIVE") String view,
            @RequestParam(required = false) String status
    ) {
        return limitOrderService.getOrders(view, status);
    }

    @PostMapping
    public LimitOrder submitLimitOrder(@RequestBody LimitOrderRequest request) {
        return limitOrderService.submitLimitOrder(request);
    }

    @PutMapping("/{orderId}")
    public LimitOrder amendLimitOrder(@PathVariable String orderId, @RequestBody LimitOrderAmendRequest request) {
        return limitOrderService.amendLimitOrder(orderId, request);
    }

    @PostMapping("/{orderId}/cancel")
    public LimitOrder cancelLimitOrder(@PathVariable String orderId) {
        return limitOrderService.cancelLimitOrder(orderId);
    }
}

