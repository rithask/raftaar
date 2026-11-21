package com.raftaar.vehicle;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "odometer_reading")
public class OdometerReading {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    public Long vehicleId;
    public Instant readAt;
    public BigDecimal odometer;
    public String notes;
    public Instant createdAt = Instant.now();
}
