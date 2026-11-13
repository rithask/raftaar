package com.raftaar.domain;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;

/** A fill-up or expense found in Hisaab payments or GeoPulse stops, waiting to be confirmed. */
@Entity
@Table(name = "suggestion")
public class Suggestion {
    public enum Kind { FUEL, EXPENSE }
    public enum Status { PENDING, ACCEPTED, DISMISSED }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    @Enumerated(EnumType.STRING) public Kind kind;
    @Enumerated(EnumType.STRING) public Status status = Status.PENDING;
    public Instant occurredAt;
    public BigDecimal amount;
    public String payee;
    public String hisaabTxnId;
    public String hisaabCategory;
    public String hisaabAccount;
    public Instant stopAt;
    public Integer stopSeconds;
    public Double latitude;
    public Double longitude;
    public String stationName;
    public String stationBrand;
    public String region;
    public String district;
    public BigDecimal suggestedPrice;
    public Long suggestedVehicleId;
    public String note;
    public String dismissReason;
    public Instant createdAt = Instant.now();
    public Instant updatedAt = Instant.now();
}
