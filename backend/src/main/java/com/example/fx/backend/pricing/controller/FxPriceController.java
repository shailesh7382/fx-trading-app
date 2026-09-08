package com.example.fx.backend.pricing.controller;

import com.example.fx.backend.pricing.dto.FxPriceDTO;

import com.example.fx.backend.pricing.service.FxPriceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/rates")
public class FxPriceController {

    @Autowired
    private FxPriceService service;

    @GetMapping
    public List<FxPriceDTO> getAllPrices() {
        return service.getAllPrices();
    }

    @GetMapping("/grid")
    public List<FxPriceDTO> getGridPrices(
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "SP") String tenor,
            @RequestParam(defaultValue = "pair") String sort,
            @RequestParam(defaultValue = "6") int limit) {
        return service.getGridPrices(search, tenor, sort, limit);
    }

}
