package com.example.fx.backend.pricing.service;

import com.example.fx.backend.pricing.dto.LimitOrderAmendRequest;
import com.example.fx.backend.pricing.dto.LimitOrderRequest;
import com.example.fx.backend.pricing.model.LimitOrder;
import com.example.fx.backend.pricing.model.LimitOrderStatus;
import com.example.fx.backend.pricing.model.TimeInForce;
import com.example.fx.backend.pricing.model.Trade;
import com.example.fx.backend.pricing.repository.LimitOrderRepository;
import com.example.fx.backend.support.SequentialIdGenerator;
import com.example.fx.backend.tradingsystem.TradingSystemClientProperties;
import com.example.fx.backend.tradingsystem.TradingSystemContractMapper;
import com.example.fx.backend.tradingsystem.TradingSystemGateway;
import com.example.fx.tradingsystems.api.model.CallbackStatus;
import com.example.fx.tradingsystems.api.model.RestingOrderAmendRequest;
import com.example.fx.tradingsystems.api.model.RestingOrderEvent;
import com.example.fx.tradingsystems.api.model.RestingOrderExpiredEvent;
import com.example.fx.tradingsystems.api.model.RestingOrderRequest;
import com.example.fx.tradingsystems.api.model.RestingOrderTriggeredEvent;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class LimitOrderService {
    private static final Logger LOG = LoggerFactory.getLogger(LimitOrderService.class);

    private final LimitOrderRepository repository;
    private final TradingSystemGateway tradingSystem;
    private final TradingSystemClientProperties properties;
    private final TradeService tradeService;
    private final Clock clock;
    private final SequentialIdGenerator idGenerator;

    public LimitOrderService(LimitOrderRepository repository, TradingSystemGateway tradingSystem,
                             TradingSystemClientProperties properties, TradeService tradeService, Clock clock,
                             SequentialIdGenerator idGenerator) {
        this.repository = repository;
        this.tradingSystem = tradingSystem;
        this.properties = properties;
        this.tradeService = tradeService;
        this.clock = clock;
        this.idGenerator = idGenerator;
    }

    @Transactional
    public LimitOrder submitLimitOrder(LimitOrderRequest request) {
        validate(request.getCcyPair(), request.getDealtCurrency(), request.getQty(), request.getLimitPrice());
        String requestId = textOr(request.getRequestId(), idGenerator.generate());
        String channel = textOr(request.getChannel(), properties.channel());
        String segment = textOr(request.getSegment(), properties.segment());
        String customerId = textOr(request.getCustomerId(), properties.customerId());
        String pair = request.getCcyPair().trim().toUpperCase(Locale.ROOT);
        TimeInForce timeInForce = parseTimeInForce(request.getTimeInForce());
        OffsetDateTime expiresAt = expiry(timeInForce, request.getGoodTillDate());
        String orderId = nextOrderId();
        LOG.info("Submitting resting order orderId={} requestId={} pair={} direction={} quantity={} {} "
                        + "limitPrice={} timeInForce={}",
                orderId, requestId, pair, request.getDirection(), request.getQty(), request.getDealtCurrency(),
                request.getLimitPrice(), timeInForce);

        RestingOrderRequest tradingSystemRequest = new RestingOrderRequest()
                .requestId(requestId).orderId(orderId)
                .channel(channel).segment(segment).customerId(customerId)
                .currencyPair(pair).quantity(BigDecimal.valueOf(request.getQty()))
                .quantityCurrency(request.getDealtCurrency().trim().toUpperCase(Locale.ROOT))
                .tenor(TradingSystemContractMapper.toContractTenor(request.getTenor()))
                .side(TradingSystemContractMapper.toSide(request.getDirection()))
                .limitPrice(BigDecimal.valueOf(request.getLimitPrice()))
                .timeInForce(toContractTimeInForce(timeInForce))
                .expiresAt(expiresAt)
                .callbackUrl(properties.callbackUrl().toString());

        LimitOrder order = apply(tradingSystem.placeRestingOrder(tradingSystemRequest), new LimitOrder());
        copyDeskMetadata(request, order);
        LimitOrder saved = repository.save(order);
        LOG.info("Resting order persisted orderId={} status={} callbackStatus={}",
                saved.getId(), saved.getStatus(), saved.getCallbackStatus());
        return saved;
    }

    @Transactional
    public List<LimitOrder> getOrders(String view, String status) {
        reconcileRemoteOrders();
        if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
            return repository.findByStatusOrderBySubmittedAtDesc(parseStatus(status));
        }
        if ("ALL".equalsIgnoreCase(textOr(view, "ACTIVE"))) {
            return repository.findAllByOrderBySubmittedAtDesc();
        }
        return repository.findByStatusOrderBySubmittedAtDesc(LimitOrderStatus.ACTIVE);
    }

    @Transactional
    public LimitOrder amendLimitOrder(String orderId, LimitOrderAmendRequest request) {
        LOG.info("Amending resting order orderId={} quantity={} limitPrice={} timeInForce={}",
                orderId, request.getQty(), request.getLimitPrice(), request.getTimeInForce());
        LimitOrder order = active(orderId);
        validate(order.getCcyPair(), order.getDealtCurrency(), request.getQty(), request.getLimitPrice());
        TimeInForce timeInForce = parseTimeInForce(request.getTimeInForce());
        RestingOrderAmendRequest amendment = new RestingOrderAmendRequest()
                .requestId(idGenerator.generate())
                .channel(order.getChannel()).segment(order.getSegment()).customerId(order.getCustomerId())
                .quantity(BigDecimal.valueOf(request.getQty()))
                .limitPrice(BigDecimal.valueOf(request.getLimitPrice()))
                .timeInForce(toContractTimeInForce(timeInForce))
                .expiresAt(expiry(timeInForce, request.getGoodTillDate()));
        apply(tradingSystem.amendRestingOrder(orderId, amendment), order);
        if (request.getComments() != null) {
            order.setComments(request.getComments().trim());
        }
        LimitOrder saved = repository.save(order);
        LOG.info("Resting order amended orderId={} status={} expiresAt={}",
                saved.getId(), saved.getStatus(), saved.getExpiresAt());
        return saved;
    }

    @Transactional
    public LimitOrder cancelLimitOrder(String orderId) {
        LOG.info("Cancelling resting order orderId={}", orderId);
        LimitOrder order = active(orderId);
        com.example.fx.tradingsystems.api.model.RestingOrder cancelled = tradingSystem.cancelRestingOrder(
                orderId, idGenerator.generate(), order.getChannel(), order.getSegment(), order.getCustomerId());
        LimitOrder saved = repository.save(apply(cancelled, order));
        LOG.info("Resting order cancelled orderId={} status={}", saved.getId(), saved.getStatus());
        return saved;
    }

    @Transactional
    public void receiveEvent(RestingOrderEvent event) {
        UUID eventId;
        String orderId;
        int deliveryAttempt;
        if (event instanceof RestingOrderTriggeredEvent triggered) {
            eventId = triggered.getEventId();
            orderId = triggered.getOrderId();
            deliveryAttempt = triggered.getAttempt();
        } else if (event instanceof RestingOrderExpiredEvent expired) {
            eventId = expired.getEventId();
            orderId = expired.getOrderId();
            deliveryAttempt = expired.getAttempt();
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported resting-order event.");
        }
        LOG.info("Received resting-order event eventId={} orderId={} eventType={} attempt={}",
                eventId, orderId, event.getEventType(), deliveryAttempt);

        LimitOrder order = repository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Resting order " + orderId + " is not known by the backend."));
        if (eventId.toString().equals(order.getLastEventId())) {
            LOG.debug("Ignoring duplicate resting-order event eventId={} orderId={}", eventId, orderId);
            return;
        }

        if (event instanceof RestingOrderTriggeredEvent triggered) {
            requireMatchingContext(order, triggered.getChannel(), triggered.getSegment(), triggered.getCustomerId());
            order.setStatus(LimitOrderStatus.EXECUTED);
            order.setExecutedAt(triggered.getOccurredAt().toLocalDateTime());
            order.setExecutedPrice(triggered.getClientPrice().doubleValue());
            order.setLastEvaluatedAt(triggered.getOccurredAt());
            order.setLastEvaluatedPrice(triggered.getClientPrice().doubleValue());
            order.setClosedAt(triggered.getOccurredAt());
            order.setTradingSystemTradeId(triggered.getTradeId().toString());
            tradeService.reconcileBooking(triggered.getTradeId(), idGenerator.generate(),
                    triggered.getChannel(), triggered.getSegment(), triggered.getCustomerId(),
                    metadataFor(order), "LIMIT", order.getId());
        } else {
            RestingOrderExpiredEvent expired = (RestingOrderExpiredEvent) event;
            requireMatchingContext(order, expired.getChannel(), expired.getSegment(), expired.getCustomerId());
            order.setStatus(LimitOrderStatus.EXPIRED);
            order.setExecutedAt(null);
            order.setExecutedPrice(null);
            order.setLastEvaluatedAt(expired.getOccurredAt());
            order.setLastEvaluatedPrice(expired.getLastEvaluatedPrice() == null
                    ? null : expired.getLastEvaluatedPrice().doubleValue());
            order.setClosedAt(expired.getOccurredAt());
        }
        order.setLastEventId(eventId.toString());
        order.setEventReceivedAt(OffsetDateTime.now(clock));
        order.setCallbackStatus(CallbackStatus.PENDING.getValue());
        repository.save(order);
        LOG.info("Resting-order event applied eventId={} orderId={} status={} callbackStatus={}",
                eventId, orderId, order.getStatus(), order.getCallbackStatus());
    }

    private void reconcileRemoteOrders() {
        LinkedHashMap<String, LimitOrder> candidates = new LinkedHashMap<>();
        repository.findByStatusOrderBySubmittedAtDesc(LimitOrderStatus.ACTIVE)
                .forEach(order -> candidates.put(order.getId(), order));
        repository.findByCallbackStatusOrderBySubmittedAtDesc(CallbackStatus.PENDING.getValue())
                .forEach(order -> candidates.put(order.getId(), order));
        LOG.debug("Reconciling resting orders candidateCount={}", candidates.size());

        for (LimitOrder order : candidates.values()) {
            if (order.getChannel() == null || order.getChannel().isBlank()
                    || order.getSegment() == null || order.getSegment().isBlank()
                    || order.getCustomerId() == null || order.getCustomerId().isBlank()) {
                LOG.warn("Skipping reconciliation for orderId={} because its request context is incomplete",
                        order.getId());
                continue;
            }
            try {
                com.example.fx.tradingsystems.api.model.RestingOrder remote = tradingSystem.getRestingOrder(
                        order.getId(), idGenerator.generate(), order.getChannel(), order.getSegment(),
                        order.getCustomerId());
                apply(remote, order);
                repository.save(order);
                LOG.debug("Resting order reconciled orderId={} status={} callbackStatus={}",
                        order.getId(), order.getStatus(), order.getCallbackStatus());
                if (remote.getTradeId() != null) {
                    tradeService.reconcileBooking(remote.getTradeId(), idGenerator.generate(),
                            order.getChannel(), order.getSegment(), order.getCustomerId(),
                            metadataFor(order), "LIMIT", order.getId());
                }
            } catch (ResponseStatusException exception) {
                LOG.warn("Could not reconcile resting order {}: {}", order.getId(), exception.getReason());
            }
        }
    }

    private LimitOrder apply(com.example.fx.tradingsystems.api.model.RestingOrder remote, LimitOrder order) {
        order.setId(remote.getOrderId());
        order.setRequestId(remote.getRequestId());
        order.setOriginalRequestId(remote.getOriginalRequestId());
        order.setResponseId(remote.getResponseId().toString());
        order.setResponseAt(remote.getResponseAt());
        order.setChannel(remote.getChannel());
        order.setSegment(remote.getSegment());
        order.setCustomerId(remote.getCustomerId());
        order.setCcyPair(remote.getCurrencyPair());
        order.setTenor(TradingSystemContractMapper.toUiTenor(remote.getTenor()));
        order.setContractTenor(remote.getTenor().getValue());
        order.setQty(remote.getQuantity().doubleValue());
        order.setDirection(TradingSystemContractMapper.toDirection(remote.getSide()));
        order.setDealtCurrency(remote.getQuantityCurrency());
        order.setQuantityCurrency(remote.getQuantityCurrency());
        order.setLimitPrice(remote.getLimitPrice().doubleValue());
        order.setTimeInForce(remote.getTimeInForce() == com.example.fx.tradingsystems.api.model.TimeInForce.GOOD_TILL_TIME
                ? TimeInForce.GTD : TimeInForce.GTC);
        order.setGoodTillDate(remote.getExpiresAt() == null ? null : remote.getExpiresAt().toLocalDate());
        order.setExpiresAt(remote.getExpiresAt());
        order.setStatus(switch (remote.getStatus()) {
            case WORKING -> LimitOrderStatus.ACTIVE;
            case TRIGGERED -> LimitOrderStatus.EXECUTED;
            case EXPIRED -> LimitOrderStatus.EXPIRED;
            case CANCELLED -> LimitOrderStatus.CANCELLED;
        });
        order.setSubmittedAt(remote.getPlacedAt().toLocalDateTime());
        order.setLastEvaluatedAt(remote.getLastEvaluatedAt());
        order.setLastEvaluatedPrice(remote.getLastEvaluatedPrice() == null
                ? null : remote.getLastEvaluatedPrice().doubleValue());
        order.setClosedAt(remote.getClosedAt());
        order.setExecutedAt(remote.getStatus() == com.example.fx.tradingsystems.api.model.RestingOrderStatus.TRIGGERED
                && remote.getClosedAt() != null ? remote.getClosedAt().toLocalDateTime() : order.getExecutedAt());
        order.setExecutedPrice(remote.getStatus() == com.example.fx.tradingsystems.api.model.RestingOrderStatus.TRIGGERED
                ? order.getLastEvaluatedPrice() : order.getExecutedPrice());
        order.setTradingSystemTradeId(remote.getTradeId() == null ? null : remote.getTradeId().toString());
        order.setCallbackUrl(remote.getCallbackUrl());
        order.setCallbackStatus(remote.getCallbackStatus().getValue());
        order.setCallbackAttempts(remote.getCallbackAttempts());
        return order;
    }

    private LimitOrder active(String orderId) {
        LimitOrder order = repository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Resting order " + orderId + " was not found."));
        if (order.getStatus() != LimitOrderStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only working orders can be changed.");
        }
        return order;
    }

    private void copyDeskMetadata(LimitOrderRequest request, LimitOrder order) {
        LocalDate today = LocalDate.now(clock);
        order.setTradeDate(request.getTradeDate() == null ? today : request.getTradeDate());
        order.setSettlementDate(request.getSettlementDate());
        order.setCustomer(textOr(request.getCustomer(), "Trading System customer " + order.getCustomerId()));
        order.setRm(textOr(request.getRm(), "N/A"));
        order.setSales(textOr(request.getSales(), "N/A"));
        order.setComments(textOr(request.getComments(), "Submitted from the rate grid."));
        order.setTrader(textOr(request.getTrader(), "system"));
    }

    private Trade metadataFor(LimitOrder order) {
        Trade metadata = new Trade();
        metadata.setCustomer(order.getCustomer());
        metadata.setRm(order.getRm());
        metadata.setSales(order.getSales());
        metadata.setComments(order.getComments());
        metadata.setTrader(order.getTrader());
        metadata.setProductType("SPOT_FWD");
        metadata.setProductDetails(order.getTenor() + " resting order " + order.getId());
        return metadata;
    }

    private void requireMatchingContext(LimitOrder order, String channel, String segment, String customerId) {
        if (!order.getChannel().equals(channel) || !order.getSegment().equals(segment)
                || !order.getCustomerId().equals(customerId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Resting order context does not match.");
        }
    }

    private void validate(String pair, String currency, double quantity, double limitPrice) {
        if (pair == null || !pair.trim().matches("[A-Za-z]{6}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A six-letter currency pair is required.");
        }
        String normalizedPair = pair.trim().toUpperCase(Locale.ROOT);
        String normalizedCurrency = textOr(currency, "").toUpperCase(Locale.ROOT);
        if (!(normalizedCurrency.equals(normalizedPair.substring(0, 3))
                || normalizedCurrency.equals(normalizedPair.substring(3)))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Dealt currency must be one leg of the pair.");
        }
        if (quantity <= 0 || !Double.isFinite(quantity) || limitPrice <= 0 || !Double.isFinite(limitPrice)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Quantity and limit price must be positive.");
        }
    }

    private TimeInForce parseTimeInForce(String value) {
        try {
            return TimeInForce.valueOf(textOr(value, "GTC").toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Time in force must be GTC or GTD.");
        }
    }

    private LimitOrderStatus parseStatus(String value) {
        try {
            return LimitOrderStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported order status.");
        }
    }

    private com.example.fx.tradingsystems.api.model.TimeInForce toContractTimeInForce(TimeInForce value) {
        return value == TimeInForce.GTD
                ? com.example.fx.tradingsystems.api.model.TimeInForce.GOOD_TILL_TIME
                : com.example.fx.tradingsystems.api.model.TimeInForce.GOOD_TILL_CANCELLED;
    }

    private OffsetDateTime expiry(TimeInForce timeInForce, LocalDate goodTillDate) {
        if (timeInForce == TimeInForce.GTC) {
            return null;
        }
        LocalDate date = goodTillDate == null ? LocalDate.now(clock) : goodTillDate;
        return date.atTime(LocalTime.MAX).atZone(clock.getZone()).toOffsetDateTime();
    }

    /**
     * Order identifiers come from a counter reserved in the database, so they are
     * unique by construction — there is nothing to check against the repository and
     * nothing to retry.
     */
    private String nextOrderId() {
        String orderId = idGenerator.generate();
        LOG.debug("Generated order ID orderId={}", orderId);
        return orderId;
    }

    private String textOr(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
