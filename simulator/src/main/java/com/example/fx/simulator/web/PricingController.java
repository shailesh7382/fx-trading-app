package com.example.fx.simulator.web;

import java.net.URI;
import java.util.UUID;

import com.example.fx.tradingsystems.api.PricingApi;
import com.example.fx.tradingsystems.api.model.PriceQuote;
import com.example.fx.tradingsystems.api.model.PriceRequest;
import com.example.fx.simulator.service.SimulatorTradingService;
import com.example.fx.simulator.domain.TradingModels.*;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PricingController implements PricingApi {

    private final SimulatorTradingService simulatorTradingService;
    private final SimulatorApiMapper mapper;

    public PricingController(SimulatorTradingService simulatorTradingService, SimulatorApiMapper mapper) {
        this.simulatorTradingService = simulatorTradingService;
        this.mapper = mapper;
    }

    @Override
    public ResponseEntity<PriceQuote> requestPrice(PriceRequest priceRequest) {
        PricingCommand command = mapper.command(priceRequest);
        Quote quote = simulatorTradingService.requestPrice(command);
        return ResponseEntity
                .created(URI.create("/api/v1/pricing/quotes/" + quote.quoteId()))
                .contentType(MediaType.APPLICATION_JSON)
                .body(mapper.quote(quote, command.context()));
    }

    @Override
    public ResponseEntity<PriceQuote> getPriceQuote(UUID quoteId, String xRequestId, String xChannel,
                                                  String xSegment, String xCustomerId) {
        RequestContext context = new RequestContext(xRequestId, xChannel, xSegment, xCustomerId);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON)
                .body(mapper.quote(simulatorTradingService.getPriceQuote(quoteId, context), context));
    }
}
