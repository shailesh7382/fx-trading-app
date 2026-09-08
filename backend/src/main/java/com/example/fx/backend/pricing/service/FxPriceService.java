package com.example.fx.backend.pricing.service;

import com.example.fx.backend.pricing.dto.FxPriceDTO;
import com.example.fx.backend.simulator.SimulatorClientProperties;
import com.example.fx.backend.simulator.SimulatorContractMapper;
import com.example.fx.backend.simulator.SimulatorGateway;
import com.example.fx.simulator.api.model.PriceQuote;
import com.example.fx.simulator.api.model.TwoWayPriceQuote;
import com.example.fx.simulator.api.model.TwoWayPriceRequest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class FxPriceService {
    private final SimulatorGateway simulator;
    private final SimulatorClientProperties properties;
    private final Clock clock;
    private volatile List<FxPriceDTO> allPricesSnapshot = List.of();
    private volatile Instant allPricesSnapshotAt = Instant.EPOCH;

    public FxPriceService(SimulatorGateway simulator, SimulatorClientProperties properties, Clock clock) {
        this.simulator = simulator;
        this.properties = properties;
        this.clock = clock;
    }

    public synchronized List<FxPriceDTO> getAllPrices() {
        Instant now = clock.instant();
        if (!allPricesSnapshot.isEmpty()
                && Duration.between(allPricesSnapshotAt, now).compareTo(Duration.ofSeconds(1)) < 0) {
            return allPricesSnapshot;
        }
        allPricesSnapshot = getGridPrices("", "ALL", "pair", properties.instruments().size() * 6);
        allPricesSnapshotAt = now;
        return allPricesSnapshot;
    }

    public List<FxPriceDTO> getGridPrices(String search, String tenor, String sortBy, int limit) {
        String query = search == null ? "" : search.trim().toUpperCase(Locale.ROOT);
        List<String> tenors = "ALL".equalsIgnoreCase(tenor)
                ? List.of("SP", "1W", "1M", "3M", "6M", "1Y")
                : List.of(tenor == null || tenor.isBlank() ? "SP" : tenor);
        int safeLimit = Math.max(1, Math.min(limit, properties.instruments().size() * 6));

        return properties.instruments().stream()
                .map(String::toUpperCase)
                .filter(pair -> query.isEmpty() || pair.contains(query))
                .flatMap(pair -> tenors.stream().map(selectedTenor -> requestTwoWay(pair, selectedTenor)))
                .sorted(comparator(sortBy))
                .limit(safeLimit)
                .toList();
    }

    private FxPriceDTO requestTwoWay(String currencyPair, String tenor) {
        TwoWayPriceRequest request = new TwoWayPriceRequest()
                .requestId(UUID.randomUUID().toString())
                .channel(properties.channel())
                .segment(properties.segment())
                .customerId(properties.customerId())
                .currencyPair(currencyPair)
                .quantity(properties.defaultQuantity())
                .quantityCurrency(currencyPair.substring(0, 3))
                .tenor(SimulatorContractMapper.toContractTenor(tenor))
                .quoteType("TWO_WAY");
        PriceQuote quote = simulator.requestPrice(request);
        if (!(quote instanceof TwoWayPriceQuote twoWay)) {
            throw new IllegalStateException("Simulator returned a non-two-way quote for a two-way request.");
        }
        return new FxPriceDTO(twoWay);
    }

    private Comparator<FxPriceDTO> comparator(String sortBy) {
        return switch (sortBy == null ? "pair" : sortBy.trim().toLowerCase(Locale.ROOT)) {
            case "updated" -> Comparator.comparing(FxPriceDTO::getQuotedAt).reversed();
            case "spread" -> Comparator.comparing(price -> price.getAsk().subtract(price.getBid()));
            default -> Comparator.comparing(FxPriceDTO::getCcyPair)
                    .thenComparingInt(price -> SimulatorContractMapper.tenorOrder(price.getTenor()));
        };
    }
}
