package com.raftaar.domain;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "reminder")
public class Reminder {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    public Long vehicleId;
    public String title;
    public BigDecimal intervalKm;
    public Integer intervalMonths;
    public LocalDate lastDoneOn;
    public BigDecimal lastDoneOdometer;
    public LocalDate dueOn;
    public BigDecimal dueOdometer;
    public int notifyDaysBefore = 14;
    public int notifyKmBefore = 300;
    public boolean active = true;
    public String lastNotifiedState;
    public Instant lastNotifiedAt;
    public String notes;
    public Instant createdAt = Instant.now();

    /** The date it's due: an interval from when it was last done, or a fixed date. */
    public LocalDate effectiveDueOn() {
        if (intervalMonths != null && lastDoneOn != null) return lastDoneOn.plusMonths(intervalMonths);
        return dueOn;
    }

    /** The odometer reading it's due at. */
    public BigDecimal effectiveDueOdometer() {
        if (intervalKm != null && lastDoneOdometer != null) return lastDoneOdometer.add(intervalKm);
        return dueOdometer;
    }
}
