package com.example.service;

import com.example.LimitOrderRequest;
import com.example.Tenor;
import com.example.model.FxPrice;
import com.example.model.LimitOrder;
import com.example.model.LimitOrderStatus;
import com.example.model.TimeInForce;
import com.example.repository.FxPriceRepository;
import com.example.repository.LimitOrderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.OptionalDouble;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

@Service
public class LimitOrderService {

    private static final DateTimeFormatter ORDER_ID_DATE = DateTimeFormatter.ofPattern("yyMMdd");

    private final LimitOrderRepository limitOrderRepository;
    private final FxPriceRepository fxPriceRepository;
    private final TradeService tradeService;
    private final Clock clock;

    public LimitOrderService(LimitOrderRepository limitOrderRepository, FxPriceRepository fxPriceRepository, TradeService tradeService, Clock clock) {
        this.limitOrderRepository = limitOrderRepository;
        this.fxPriceRepository = fxPriceRepository;
        this.tradeService = tradeService;
        this.clock = clock;
    }

    @Transactional
    public LimitOrder submitLimitOrder(LimitOrderRequest request) {
        expireStaleOrders();

        String tenor = normalizeTenor(request.getTenor());
        if (!"SP".equals(tenor)) {
            throw new ResponseStatusException(BAD_REQUEST, "Limit orders are only supported for spot instruments.");
        }

        if (!hasText(request.getCcyPair())) {
            throw new ResponseStatusException(BAD_REQUEST, "Currency pair is required for a limit order.");
        }

        if (!hasText(request.getDealtCurrency())) {
            throw new ResponseStatusException(BAD_REQUEST, "Dealt currency is required for a limit order.");
        }

        if (request.getQty() <= 0) {
            throw new ResponseStatusException(BAD_REQUEST, "Limit order quantity must be greater than zero.");
        }

        if (request.getLimitPrice() <= 0) {
            throw new ResponseStatusException(BAD_REQUEST, "Limit price must be greater than zero.");
        }

        String direction = normalizeDirection(request.getDirection());
        TimeInForce timeInForce = parseTimeInForce(request.getTimeInForce());
        LocalDate today = LocalDate.now(clock);
        LocalDate goodTillDate = null;

        if (timeInForce == TimeInForce.GTD) {
            goodTillDate = request.getGoodTillDate();
            if (goodTillDate == null) {
                throw new ResponseStatusException(BAD_REQUEST, "Good-till date is required for GTD limit orders.");
            }
            if (goodTillDate.isBefore(today)) {
                throw new ResponseStatusException(BAD_REQUEST, "Good-till date cannot be in the past.");
            }
        }

        LimitOrder order = new LimitOrder();
        order.setId(nextOrderId());
        order.setCcyPair(normalizeText(request.getCcyPair()));
        order.setTenor(tenor);
        order.setQty(request.getQty());
        order.setDirection(direction);
        order.setDealtCurrency(normalizeText(request.getDealtCurrency()));
        order.setLimitPrice(request.getLimitPrice());
        order.setTimeInForce(timeInForce);
        order.setGoodTillDate(goodTillDate);
        order.setTradeDate(request.getTradeDate() != null ? request.getTradeDate() : today);
        order.setSettlementDate(request.getSettlementDate() != null ? request.getSettlementDate() : today);
        order.setCustomer(defaultText(request.getCustomer(), "System limit order"));
        order.setRm(defaultText(request.getRm(), "N/A"));
        order.setSales(defaultText(request.getSales(), "N/A"));
        order.setComments(defaultText(request.getComments(), "Submitted from the spot rate grid."));
        order.setTrader(defaultText(request.getTrader(), "system"));
        order.setStatus(LimitOrderStatus.ACTIVE);
        order.setSubmittedAt(LocalDateTime.now(clock));

        LimitOrder savedOrder = limitOrderRepository.save(order);
        evaluateTriggeredOrders(
                savedOrder.getCcyPair(),
                savedOrder.getTenor(),
                fxPriceRepository.findByCcyPairAndTenor(savedOrder.getCcyPair(), Tenor.SP)
        );
        return limitOrderRepository.findById(savedOrder.getId()).orElse(savedOrder);
    }

    @Transactional
    public List<LimitOrder> getCurrentOrders() {
        expireStaleOrders();
        return limitOrderRepository.findByStatusOrderBySubmittedAtDesc(LimitOrderStatus.ACTIVE);
    }

    @Transactional
    public List<LimitOrder> getAllOrders() {
        expireStaleOrders();
        return limitOrderRepository.findAllByOrderBySubmittedAtDesc();
    }

    @Transactional
    public void evaluateTriggeredOrders(String ccyPair, String tenor, List<FxPrice> prices) {
        expireStaleOrders();

        if (!"SP".equalsIgnoreCase(tenor) || prices == null || prices.isEmpty()) {
            return;
        }

        List<LimitOrder> activeOrders = limitOrderRepository.findByStatusAndCcyPairAndTenorOrderBySubmittedAtAsc(
                LimitOrderStatus.ACTIVE,
                ccyPair,
                "SP"
        );

        for (LimitOrder order : activeOrders) {
            OptionalDouble executablePrice = findExecutablePrice(prices, order);
            if (!executablePrice.isPresent()) {
                continue;
            }

            order.setStatus(LimitOrderStatus.EXECUTED);
            order.setExecutedPrice(executablePrice.getAsDouble());
            order.setExecutedAt(LocalDateTime.now(clock));
            limitOrderRepository.save(order);
            tradeService.bookExecutedLimitOrder(order, executablePrice.getAsDouble());
        }
    }

    @Transactional
    public int expireStaleOrders() {
        LocalDate today = LocalDate.now(clock);
        List<LimitOrder> staleOrders = limitOrderRepository.findByStatusAndTimeInForceAndGoodTillDateBefore(
                LimitOrderStatus.ACTIVE,
                TimeInForce.GTD,
                today
        );

        if (staleOrders.isEmpty()) {
            return 0;
        }

        staleOrders.forEach(order -> order.setStatus(LimitOrderStatus.EXPIRED));
        limitOrderRepository.saveAll(staleOrders);
        return staleOrders.size();
    }

    private OptionalDouble findExecutablePrice(List<FxPrice> prices, LimitOrder order) {
        return prices.stream()
                .filter(price -> price.getQty() >= order.getQty())
                .mapToDouble(price -> "Buy".equalsIgnoreCase(order.getDirection()) ? price.getAsk() : price.getBid())
                .filter(candidatePrice -> "Buy".equalsIgnoreCase(order.getDirection())
                        ? candidatePrice <= order.getLimitPrice()
                        : candidatePrice >= order.getLimitPrice())
                .boxed()
                .min(buildExecutionComparator(order))
                .stream()
                .mapToDouble(Double::doubleValue)
                .findFirst();
    }

    private Comparator<Double> buildExecutionComparator(LimitOrder order) {
        if ("Buy".equalsIgnoreCase(order.getDirection())) {
            return Comparator.naturalOrder();
        }
        return Comparator.reverseOrder();
    }

    private TimeInForce parseTimeInForce(String rawTimeInForce) {
        try {
            return TimeInForce.valueOf(defaultText(rawTimeInForce, "GTC").trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(BAD_REQUEST, "Unsupported time-in-force. Use GTC or GTD.");
        }
    }

    private String normalizeDirection(String direction) {
        if ("SELL".equalsIgnoreCase(direction)) {
            return "Sell";
        }
        if ("BUY".equalsIgnoreCase(direction)) {
            return "Buy";
        }
        throw new ResponseStatusException(BAD_REQUEST, "Direction must be Buy or Sell.");
    }

    private String normalizeTenor(String tenor) {
        return defaultText(tenor, "SP").trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeText(String value) {
        return value == null ? null : value.trim();
    }

    private String defaultText(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }

    private String nextOrderId() {
        return "LO-" + LocalDate.now(clock).format(ORDER_ID_DATE) + "-" + System.currentTimeMillis();
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}


