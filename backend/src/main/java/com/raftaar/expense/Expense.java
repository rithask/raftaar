package com.raftaar.expense;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "expense")
public class Expense {
    public enum Category { UPGRADE, ACCESSORY, GEAR, INSURANCE, TAX, PARKING, TOLL, CLEANING, OTHER }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    public Long vehicleId;
    public LocalDate spentOn;
    @Enumerated(EnumType.STRING) public Category category;
    public String title;
    public BigDecimal amount;
    public BigDecimal odometer;
    public String vendor;
    public String hisaabTxnId;
    public String notes;
    /** The import that added it (DataImport), if one did. */
    @JsonIgnore public Long importBatchId;
    public Instant createdAt = Instant.now();
}
