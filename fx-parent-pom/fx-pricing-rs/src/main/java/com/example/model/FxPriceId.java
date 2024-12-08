package com.example.model;

import java.io.Serializable;
import java.util.Objects;

public class FxPriceId implements Serializable {

    private String ccyPair;
    private Tenor tenor;
    private double qty;

    // Default constructor
    public FxPriceId() {}

    // Constructor
    public FxPriceId(String ccyPair, Tenor tenor, double qty) {
        this.ccyPair = ccyPair;
        this.tenor = tenor;
        this.qty = qty;
    }

    // Getters, Setters, equals(), and hashCode() methods
}