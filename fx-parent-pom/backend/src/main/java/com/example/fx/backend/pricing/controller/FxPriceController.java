package com.example.fx.backend.pricing.controller;

import com.example.fx.backend.pricing.dto.FxPriceDTO;

import com.example.fx.backend.pricing.model.FxPrice;
import com.example.fx.backend.pricing.service.FxPriceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/fxprices")
public class FxPriceController {

    @Autowired
    private FxPriceService service;

    @GetMapping
    public List<FxPriceDTO> getAllPrices() {
        List<FxPriceDTO> allPrices = service.getAllPrices().stream()
                .map(FxPriceDTO::new)
                .collect(Collectors.toList());
        Collections.sort(allPrices, FxPriceDTO.getComparator());
        return allPrices;
    }

    @GetMapping("/grid")
    public List<FxPriceDTO> getGridPrices(
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "SP") String tenor,
            @RequestParam(defaultValue = "pair") String sort,
            @RequestParam(defaultValue = "6") int limit) {
        return service.getGridPrices(search, tenor, sort, limit);
    }

    @PostMapping
    public FxPrice updatePrice(@RequestBody FxPrice fxPrice) {
        return service.updatePrice(fxPrice);
    }
}