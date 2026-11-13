package com.raftaar.domain;

public enum FuelType {
    PETROL("L"), DIESEL("L"), CNG("kg"), ELECTRIC("kWh");

    public final String unit;

    FuelType(String unit) {
        this.unit = unit;
    }
}
