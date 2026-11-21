package com.raftaar.places;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "map_tile")
public class MapTile {
    @Id public String tileKey;
    public Instant fetchedAt;
}
