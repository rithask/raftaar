package com.raftaar.upkeep;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "service_record")
public class ServiceRecord {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    public Long vehicleId;
    public LocalDate servicedOn;
    public BigDecimal odometer;
    public String title;
    public String workshop;
    public BigDecimal cost = BigDecimal.ZERO;
    public String notes;
    public Instant createdAt = Instant.now();
}
