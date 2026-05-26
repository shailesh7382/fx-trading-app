package com.example;

import com.example.model.LimitOrder;
import com.example.service.LimitOrderService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
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
    public List<LimitOrder> getLimitOrders(@RequestParam(defaultValue = "ACTIVE") String view) {
        if ("ALL".equalsIgnoreCase(view)) {
            return limitOrderService.getAllOrders();
        }
        return limitOrderService.getCurrentOrders();
    }

    @PostMapping
    public LimitOrder submitLimitOrder(@RequestBody LimitOrderRequest request) {
        return limitOrderService.submitLimitOrder(request);
    }
}

