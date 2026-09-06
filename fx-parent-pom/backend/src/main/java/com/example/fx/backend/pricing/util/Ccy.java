package com.example.fx.backend.pricing.util;

/**
 * Currency codes supported by the pricing application.
 *
 * <p>The enum name is the canonical uppercase market-data code. USD market orientation belongs to
 * {@link CcyPair}, which is the single source of truth for supported instruments. Precious metals
 * use the same three-letter pair model.</p>
 */
public enum Ccy {
    USD,
    EUR,
    GBP,
    JPY,
    CHF,
    AUD,
    CAD,
    NZD,
    SGD,
    INR,
    CNH,
    THB,
    NOK,
    SEK,
    DKK,
    AED,
    IDR,
    MYR,
    HKD,
    XAU,
    XAG,
    XPT,
    XPD
}
