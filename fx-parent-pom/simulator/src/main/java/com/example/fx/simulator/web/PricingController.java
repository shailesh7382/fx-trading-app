package com.example.fx.simulator.web;

import java.net.URI;
import java.util.UUID;

import com.example.fx.simulator.api.PricingApi;
import com.example.fx.simulator.api.model.PriceQuote;
import com.example.fx.simulator.api.model.PriceRequest;
import com.example.fx.simulator.service.SimulatorTradingService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PricingController implements PricingApi {

    private final SimulatorTradingService simulatorTradingService;

    public PricingController(SimulatorTradingService simulatorTradingService) {
        this.simulatorTradingService = simulatorTradingService;
    }

    @Override
    public ResponseEntity<PriceQuote> requestPrice(PriceRequest priceRequest) {
        PriceQuote quote = simulatorTradingService.requestPrice(priceRequest);
        return ResponseEntity
                .created(URI.create("/api/v1/pricing/quotes/" + quote.getQuoteId()))
                .body(quote);
    }

    @Override
    public ResponseEntity<PriceQuote> getPriceQuote(UUID quoteId) {
        return ResponseEntity.ok(simulatorTradingService.getPriceQuote(quoteId));
    }
}
