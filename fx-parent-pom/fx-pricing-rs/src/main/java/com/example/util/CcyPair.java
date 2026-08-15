package com.example.util;

/**
 * Supported currency pairs with their topology resolved at class initialization.
 *
 * <p>String conversion deliberately uses {@link #valueOf(String)} semantics: callers must supply
 * an exact uppercase enum name. No case normalization is performed. USD pairs appear only in
 * standard market convention. Every non-USD cross retains its canonical arithmetic formula.</p>
 */
public enum CcyPair {
    // USD legs used as cross-rate inputs.
    EURUSD(Ccy.EUR, Ccy.USD),
    GBPUSD(Ccy.GBP, Ccy.USD),
    USDJPY(Ccy.USD, Ccy.JPY),
    AUDUSD(Ccy.AUD, Ccy.USD),
    USDCAD(Ccy.USD, Ccy.CAD),
    NZDUSD(Ccy.NZD, Ccy.USD),
    USDCHF(Ccy.USD, Ccy.CHF),
    USDSGD(Ccy.USD, Ccy.SGD),
    USDINR(Ccy.USD, Ccy.INR),
    USDCNH(Ccy.USD, Ccy.CNH),
    USDTHB(Ccy.USD, Ccy.THB),
    USDNOK(Ccy.USD, Ccy.NOK),
    USDSEK(Ccy.USD, Ccy.SEK),
    USDDKK(Ccy.USD, Ccy.DKK),
    USDAED(Ccy.USD, Ccy.AED),
    USDIDR(Ccy.USD, Ccy.IDR),
    USDMYR(Ccy.USD, Ccy.MYR),
    XAUUSD(Ccy.XAU, Ccy.USD),
    XAGUSD(Ccy.XAG, Ccy.USD),
    XPTUSD(Ccy.XPT, Ccy.USD),
    XPDUSD(Ccy.XPD, Ccy.USD),

    // Crosses published or exercised by this application.
    EURGBP(Ccy.EUR, Ccy.GBP, CrossRateFormula.DIVIDE_FIRST_BY_SECOND),
    EURJPY(Ccy.EUR, Ccy.JPY, CrossRateFormula.MULTIPLY_FIRST_AND_SECOND),
    JPYEUR(Ccy.JPY, Ccy.EUR, CrossRateFormula.RECIPROCAL_OF_PAIR_PRODUCT),
    GBPJPY(Ccy.GBP, Ccy.JPY, CrossRateFormula.MULTIPLY_FIRST_AND_SECOND),
    AUDJPY(Ccy.AUD, Ccy.JPY, CrossRateFormula.MULTIPLY_FIRST_AND_SECOND),
    CADJPY(Ccy.CAD, Ccy.JPY, CrossRateFormula.DIVIDE_SECOND_BY_FIRST),
    CHFJPY(Ccy.CHF, Ccy.JPY, CrossRateFormula.DIVIDE_SECOND_BY_FIRST),
    JPYCHF(Ccy.JPY, Ccy.CHF, CrossRateFormula.DIVIDE_SECOND_BY_FIRST),
    JPYSGD(Ccy.JPY, Ccy.SGD, CrossRateFormula.DIVIDE_SECOND_BY_FIRST),
    NZDJPY(Ccy.NZD, Ccy.JPY, CrossRateFormula.MULTIPLY_FIRST_AND_SECOND),
    EURCAD(Ccy.EUR, Ccy.CAD, CrossRateFormula.MULTIPLY_FIRST_AND_SECOND),
    GBPCAD(Ccy.GBP, Ccy.CAD, CrossRateFormula.MULTIPLY_FIRST_AND_SECOND),
    AUDCAD(Ccy.AUD, Ccy.CAD, CrossRateFormula.MULTIPLY_FIRST_AND_SECOND),
    NZDCAD(Ccy.NZD, Ccy.CAD, CrossRateFormula.MULTIPLY_FIRST_AND_SECOND),
    EURCHF(Ccy.EUR, Ccy.CHF, CrossRateFormula.MULTIPLY_FIRST_AND_SECOND),
    GBPCHF(Ccy.GBP, Ccy.CHF, CrossRateFormula.MULTIPLY_FIRST_AND_SECOND),
    AUDCHF(Ccy.AUD, Ccy.CHF, CrossRateFormula.MULTIPLY_FIRST_AND_SECOND),
    CADCHF(Ccy.CAD, Ccy.CHF, CrossRateFormula.DIVIDE_SECOND_BY_FIRST),
    NZDCHF(Ccy.NZD, Ccy.CHF, CrossRateFormula.MULTIPLY_FIRST_AND_SECOND),
    EURNZD(Ccy.EUR, Ccy.NZD, CrossRateFormula.DIVIDE_FIRST_BY_SECOND),
    GBPNZD(Ccy.GBP, Ccy.NZD, CrossRateFormula.DIVIDE_FIRST_BY_SECOND),
    AUDNZD(Ccy.AUD, Ccy.NZD, CrossRateFormula.DIVIDE_FIRST_BY_SECOND),
    CADNZD(Ccy.CAD, Ccy.NZD, CrossRateFormula.RECIPROCAL_OF_PAIR_PRODUCT),
    CHFNZD(Ccy.CHF, Ccy.NZD, CrossRateFormula.RECIPROCAL_OF_PAIR_PRODUCT),
    EURSGD(Ccy.EUR, Ccy.SGD, CrossRateFormula.MULTIPLY_FIRST_AND_SECOND),
    XAUSGD(Ccy.XAU, Ccy.SGD, CrossRateFormula.MULTIPLY_FIRST_AND_SECOND);

    private final Ccy base;
    private final Ccy quote;
    private final boolean usdLeg;
    private final CrossRateFormula crossRateFormula;

    CcyPair(Ccy base, Ccy quote) {
        this(base, quote, null);
    }

    CcyPair(Ccy base, Ccy quote, CrossRateFormula crossRateFormula) {
        this.base = base;
        this.quote = quote;
        this.usdLeg = (base == Ccy.USD) ^ (quote == Ccy.USD);
        if (usdLeg == (crossRateFormula != null)) {
            throw new IllegalArgumentException(
                    "USD legs must omit a formula and cross pairs must declare one: "
                            + base + quote);
        }
        this.crossRateFormula = crossRateFormula;
    }

    public Ccy base() {
        return base;
    }

    public Ccy quote() {
        return quote;
    }

    public boolean isUsdLeg() {
        return usdLeg;
    }

    /**
     * Returns the non-USD currency of a USD leg.
     *
     * @throws IllegalStateException if this pair is not a USD leg
     */
    public Ccy nonUsdCcy() {
        if (!usdLeg) {
            throw new IllegalStateException(name() + " is not a USD leg");
        }
        return base == Ccy.USD ? quote : base;
    }

    CrossRateFormula crossRateFormula() {
        if (crossRateFormula == null) {
            throw new IllegalStateException(name() + " is a USD leg, not a cross pair");
        }
        return crossRateFormula;
    }

    /**
     * Arithmetic selected from the standard USD orientations of a cross pair's currencies.
     */
    enum CrossRateFormula {
        COPY_FIRST_PAIR,
        COPY_SECOND_PAIR,
        DIVIDE_FIRST_BY_SECOND,
        MULTIPLY_FIRST_AND_SECOND,
        RECIPROCAL_OF_PAIR_PRODUCT,
        DIVIDE_SECOND_BY_FIRST;

        CrossRateFormula withSwappedInputs() {
            if (this == DIVIDE_FIRST_BY_SECOND) {
                return DIVIDE_SECOND_BY_FIRST;
            }
            if (this == DIVIDE_SECOND_BY_FIRST) {
                return DIVIDE_FIRST_BY_SECOND;
            }
            return this;
        }
    }
}
