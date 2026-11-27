package com.raftaar.vehicle;

import com.fasterxml.jackson.annotation.JsonIgnore;
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
    /** The import that added it (DataImport), if one did. */
    @JsonIgnore public Long importBatchId;
    public Instant createdAt = Instant.now();
}
