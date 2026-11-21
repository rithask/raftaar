package com.raftaar.fuel;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "fuel_price")
public class FuelPrice {
    public enum Source { MANUAL, FILL_UP, LOOKUP }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    public String region;
    public String district;
    @Enumerated(EnumType.STRING) public FuelType fuelType;
    public BigDecimal price;
    public Instant effectiveAt;
    @Enumerated(EnumType.STRING) public Source source;
    public Instant createdAt = Instant.now();
}
