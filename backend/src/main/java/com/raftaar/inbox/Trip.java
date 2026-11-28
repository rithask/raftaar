package com.raftaar.inbox;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;

/** A trip from GeoPulse. Its distance is an estimate: GPS isn't the odometer. */
@Entity
@Table(name = "trip")
public class Trip {
    public enum Status { PENDING, ASSIGNED, IGNORED }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    public Long geopulseId;
    public Instant startedAt;
    public Instant endedAt;
    @Column(name = "distance_m") public BigDecimal distanceM;
    public String movementType;
    public Double startLat;
    public Double startLon;
    public Double endLat;
    public Double endLon;
    /** The places it went between, from GeoPulse's stays either side ("Home", "Office"); null where there's no name. */
    public String startPlace;
    public String endPlace;
    @Enumerated(EnumType.STRING) public Status status = Status.PENDING;
    public Long vehicleId;
    public Long suggestedVehicleId;
    public boolean stopsChecked;
    public Instant createdAt = Instant.now();
}
