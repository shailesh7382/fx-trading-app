package com.example;

import com.example.model.Trade;
import com.example.service.TradeService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
public class TradeController {

    private final TradeService tradeService;

    public TradeController(TradeService tradeService) {
        this.tradeService = tradeService;
    }

    @GetMapping("/trades")
    public List<Trade> getTrades() {
        return tradeService.getTrades();
    }

    @PostMapping("/bookTrade")
    public Trade bookTrade(@RequestBody Trade tradeDraft) {
        return tradeService.bookTrade(tradeDraft);
    }
}

