package com.raftaar.fuel;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "fuel_entry")
public class FuelEntry {
    public enum Source { MANUAL, HISAAB, GEOPULSE, HISAAB_GEOPULSE }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    public Long vehicleId;
    public Instant filledAt;
    public BigDecimal odometer;
    public BigDecimal volume;
    public BigDecimal pricePerUnit;
    public BigDecimal totalCost;
    public boolean fullTank = true;
    public boolean missedPrevious;
    public String stationName;
    public String stationBrand;
    public Double latitude;
    public Double longitude;
    public String region;
    public String district;
    @Enumerated(EnumType.STRING) public Source source = Source.MANUAL;
    public String hisaabTxnId;
    public String sourceIssue;
    public String notes;
    public Instant createdAt = Instant.now();
}
