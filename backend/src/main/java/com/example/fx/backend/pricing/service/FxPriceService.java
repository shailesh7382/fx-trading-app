package com.example.fx.backend.pricing.service;

import com.example.fx.backend.pricing.dto.FxPriceDTO;
import com.example.fx.backend.support.SequentialIdGenerator;
import com.example.fx.backend.tradingsystem.TradingSystemClientProperties;
import com.example.fx.backend.tradingsystem.TradingSystemContractMapper;
import com.example.fx.backend.tradingsystem.TradingSystemGateway;
import com.example.fx.tradingsystems.api.model.PriceQuote;
import com.example.fx.tradingsystems.api.model.TwoWayPriceQuote;
import com.example.fx.tradingsystems.api.model.TwoWayPriceRequest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class FxPriceService {
    private static final Logger LOG = LoggerFactory.getLogger(FxPriceService.class);

    private final TradingSystemGateway tradingSystem;
    private final TradingSystemClientProperties properties;
    private final Clock clock;
    private final SequentialIdGenerator idGenerator;
    private volatile List<FxPriceDTO> allPricesSnapshot = List.of();
    private volatile Instant allPricesSnapshotAt = Instant.EPOCH;

    public FxPriceService(TradingSystemGateway tradingSystem, TradingSystemClientProperties properties, Clock clock,
                          SequentialIdGenerator idGenerator) {
        this.tradingSystem = tradingSystem;
        this.properties = properties;
        this.clock = clock;
        this.idGenerator = idGenerator;
    }

    public synchronized List<FxPriceDTO> getAllPrices() {
        Instant now = clock.instant();
        if (!allPricesSnapshot.isEmpty()
                && Duration.between(allPricesSnapshotAt, now).compareTo(Duration.ofSeconds(1)) < 0) {
            LOG.debug("Serving all-prices snapshot from cache quoteCount={}", allPricesSnapshot.size());
            return allPricesSnapshot;
        }
        LOG.debug("Refreshing all-prices snapshot instrumentCount={}", properties.instruments().size());
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
        LOG.debug("Requesting price grid search={} tenors={} sortBy={} limit={}",
                query, tenors, sortBy, safeLimit);

        List<FxPriceDTO> prices = properties.instruments().stream()
                .map(String::toUpperCase)
                .filter(pair -> query.isEmpty() || pair.contains(query))
                .flatMap(pair -> tenors.stream().map(selectedTenor -> requestTwoWay(pair, selectedTenor)))
                .sorted(comparator(sortBy))
                .limit(safeLimit)
                .toList();
        LOG.debug("Price grid ready quoteCount={}", prices.size());
        return prices;
    }

    private FxPriceDTO requestTwoWay(String currencyPair, String tenor) {
        TwoWayPriceRequest request = new TwoWayPriceRequest()
                .requestId(idGenerator.generate())
                .channel(properties.channel())
                .segment(properties.segment())
                .customerId(properties.customerId())
                .currencyPair(currencyPair)
                .quantity(properties.defaultQuantity())
                .quantityCurrency(currencyPair.substring(0, 3))
                .tenor(TradingSystemContractMapper.toContractTenor(tenor))
                .quoteType("TWO_WAY");
        PriceQuote quote = tradingSystem.requestPrice(request);
        if (!(quote instanceof TwoWayPriceQuote twoWay)) {
            throw new IllegalStateException("Trading System returned a non-two-way quote for a two-way request.");
        }
        LOG.debug("Two-way quote received quoteId={} pair={} tenor={} expiresAt={}",
                twoWay.getQuoteId(), currencyPair, tenor, twoWay.getExpiresAt());
        return new FxPriceDTO(twoWay);
    }

    private Comparator<FxPriceDTO> comparator(String sortBy) {
        return switch (sortBy == null ? "pair" : sortBy.trim().toLowerCase(Locale.ROOT)) {
            case "updated" -> Comparator.comparing(FxPriceDTO::getQuotedAt).reversed();
            case "spread" -> Comparator.comparing(price -> price.getAsk().subtract(price.getBid()));
            default -> Comparator.comparing(FxPriceDTO::getCcyPair)
                    .thenComparingInt(price -> TradingSystemContractMapper.tenorOrder(price.getTenor()));
        };
    }
}
