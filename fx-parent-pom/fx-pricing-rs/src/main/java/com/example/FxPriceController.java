package com.example;

import com.example.model.FxPrice;
import com.example.service.FxPriceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/fxprices")
public class FxPriceController {

    @Autowired
    private FxPriceService service;

    @GetMapping
    public List<FxPrice> getAllPrices() {
        return service.getAllPrices();
    }

    @PostMapping
    public FxPrice updatePrice(@RequestBody FxPrice fxPrice) {
        return service.updatePrice(fxPrice);
    }
}