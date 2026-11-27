package com.raftaar.data;

import jakarta.persistence.*;

import java.time.Instant;

/** One import: what it came from and what it added ("312 fill-ups, 40 services"); its records carry its id. */
@Entity
@Table(name = "import_batch")
public class ImportBatch {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    @Enumerated(EnumType.STRING) public ImportSource source;
    public String fileName;
    public String summary;
    public Instant createdAt = Instant.now();
}
