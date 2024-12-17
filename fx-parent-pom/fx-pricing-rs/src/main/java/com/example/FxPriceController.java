package com.example;

import com.example.model.FxPrice;
import com.example.service.FxPriceService;
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

    @PostMapping
    public FxPrice updatePrice(@RequestBody FxPrice fxPrice) {
        return service.updatePrice(fxPrice);
    }
}