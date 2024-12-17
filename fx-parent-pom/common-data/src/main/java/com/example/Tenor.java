package com.example;

public enum Tenor {
    SP, 
    W1("1W"), 
    M1("1M"), 
    Y1("1Y");

    private final String label;

    Tenor() {
        this.label = this.name();
    }

    Tenor(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}