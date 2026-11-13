package com.raftaar.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/** A certificate or paper with an expiry date: insurance, PUC, RC, road tax, a driving licence… */
@Entity
@Table(name = "document")
public class Document {
    public enum Type { INSURANCE, PUC, RC, ROAD_TAX, FITNESS, PERMIT, LICENCE, OTHER }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    public Long vehicleId;
    @Enumerated(EnumType.STRING) public Type type;
    public String title;
    public String number;
    public String provider;
    public LocalDate issuedOn;
    public LocalDate expiresOn;
    public int remindDaysBefore = 30;
    public BigDecimal cost;
    @JsonIgnore public String fileName;
    public String fileType;
    public String fileOriginalName;
    @JsonIgnore public LocalDate lastNotifiedExpiry;
    @JsonIgnore public Integer lastNotifiedDays;
    public String notes;
    public Instant createdAt = Instant.now();
}
