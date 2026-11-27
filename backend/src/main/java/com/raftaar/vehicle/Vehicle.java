package com.raftaar.vehicle;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import com.raftaar.fuel.FuelType;

@Entity
@Table(name = "vehicle")
public class Vehicle {
    public enum Kind { MOTORCYCLE, SCOOTER, CAR, OTHER }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    public String name;
    @Enumerated(EnumType.STRING) public Kind kind;
    @Enumerated(EnumType.STRING) public FuelType fuelType;
    public String make;
    public String model;
    public Integer year;
    public String registration;
    public String color;
    public BigDecimal tankCapacity;
    public LocalDate purchaseDate;
    public BigDecimal purchaseOdometer;
    public BigDecimal purchasePrice;
    public LocalDate soldOn;
    public BigDecimal salePrice;
    public BigDecimal saleOdometer;
    public String imageFile;
    public int imageVersion;
    public boolean isDefault;
    public boolean archived;
    public int sortOrder;
    public String notes;
    /** The import that added it (DataImport), if one did. */
    @JsonIgnore public Long importBatchId;
    public Instant createdAt = Instant.now();

    /** GeoPulse movement types this vehicle could have made. */
    public boolean matchesMovement(String movementType) {
        if (movementType == null || movementType.equals("UNKNOWN")) return true;
        return switch (kind) {
            case CAR -> movementType.equals("CAR");
            case MOTORCYCLE, SCOOTER -> movementType.equals("MOTORCYCLE") || movementType.equals("CAR");
            case OTHER -> true;
        };
    }

    /** How well a movement type fits: exact matches win over "could be". */
    public int movementScore(String movementType) {
        if (movementType == null) return 0;
        boolean twoWheeler = kind == Kind.MOTORCYCLE || kind == Kind.SCOOTER;
        if (movementType.equals("MOTORCYCLE") && twoWheeler) return 2;
        if (movementType.equals("CAR") && kind == Kind.CAR) return 2;
        return matchesMovement(movementType) ? 1 : 0;
    }
}
