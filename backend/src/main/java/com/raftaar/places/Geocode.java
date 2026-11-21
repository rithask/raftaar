package com.raftaar.places;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "geocode")
public class Geocode {
    @Id public String cellKey;
    public String region;
    public String district;
    public Instant fetchedAt;
}
