package com.example.fx.backend.pricing.dto;

import com.example.fx.backend.simulator.SimulatorContractMapper;
import com.example.fx.simulator.api.model.TwoWayPriceQuote;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.UUID;

/** UI projection of the complete two-way simulator quote. */
public class FxPriceDTO {
    private UUID quoteId;
    private String requestId;
    private String originalRequestId;
    private UUID responseId;
    private OffsetDateTime responseAt;
    private String channel;
    private String segment;
    private String customerId;
    private String ccyPair;
    private String tenor;
    private String contractTenor;
    private BigDecimal qty;
    private String quantityCurrency;
    private BigDecimal bid;
    private BigDecimal ask;
    private BigDecimal bidCoverPrice;
    private BigDecimal askCoverPrice;
    private BigDecimal bidPoints;
    private BigDecimal askPoints;
    private LocalDate spotDate;
    private LocalDate valueDate;
    private OffsetDateTime quotedAt;
    private OffsetDateTime expiresAt;
    private String source;
    private String status;

    public FxPriceDTO() {}

    public FxPriceDTO(TwoWayPriceQuote quote) {
        quoteId = quote.getQuoteId();
        requestId = quote.getRequestId();
        originalRequestId = quote.getOriginalRequestId();
        responseId = quote.getResponseId();
        responseAt = quote.getResponseAt();
        channel = quote.getChannel();
        segment = quote.getSegment();
        customerId = quote.getCustomerId();
        ccyPair = quote.getCurrencyPair();
        tenor = SimulatorContractMapper.toUiTenor(quote.getTenor());
        contractTenor = quote.getTenor().getValue();
        qty = quote.getQuantity();
        quantityCurrency = quote.getQuantityCurrency();
        bid = quote.getSellClientPrice();
        ask = quote.getBuyClientPrice();
        bidCoverPrice = quote.getSellCoverPrice();
        askCoverPrice = quote.getBuyCoverPrice();
        bidPoints = quote.getSellSwapPoints();
        askPoints = quote.getBuySwapPoints();
        spotDate = quote.getSpotDate();
        valueDate = quote.getValueDate();
        quotedAt = quote.getQuotedAt();
        expiresAt = quote.getExpiresAt();
        source = "SIMULATOR";
        status = quote.getStatus().getValue();
    }

    public UUID getQuoteId() { return quoteId; }
    public String getRequestId() { return requestId; }
    public String getOriginalRequestId() { return originalRequestId; }
    public UUID getResponseId() { return responseId; }
    public OffsetDateTime getResponseAt() { return responseAt; }
    public String getChannel() { return channel; }
    public String getSegment() { return segment; }
    public String getCustomerId() { return customerId; }
    public String getCcyPair() { return ccyPair; }
    public String getTenor() { return tenor; }
    public String getContractTenor() { return contractTenor; }
    public BigDecimal getQty() { return qty; }
    public String getQuantityCurrency() { return quantityCurrency; }
    public BigDecimal getBid() { return bid; }
    public BigDecimal getAsk() { return ask; }
    public BigDecimal getBidCoverPrice() { return bidCoverPrice; }
    public BigDecimal getAskCoverPrice() { return askCoverPrice; }
    public BigDecimal getBidPoints() { return bidPoints; }
    public BigDecimal getAskPoints() { return askPoints; }
    public LocalDate getSpotDate() { return spotDate; }
    public LocalDate getValueDate() { return valueDate; }
    public OffsetDateTime getQuotedAt() { return quotedAt; }
    public OffsetDateTime getExpiresAt() { return expiresAt; }
    public OffsetDateTime getUpdatedAt() { return quotedAt; }
    public String getSource() { return source; }
    public String getStatus() { return status; }

    public static Comparator<FxPriceDTO> comparator() {
        return Comparator.comparing(FxPriceDTO::getTenor,
                        Comparator.comparingInt(SimulatorContractMapper::tenorOrder))
                .thenComparing(FxPriceDTO::getQty)
                .thenComparing(FxPriceDTO::getCcyPair);
    }
}
