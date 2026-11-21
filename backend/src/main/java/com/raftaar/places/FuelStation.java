package com.raftaar.places;

import jakarta.persistence.*;

@Entity
@Table(name = "fuel_station")
public class FuelStation {
    @Id public String osmId;
    public String name;
    public String brand;
    public double latitude;
    public double longitude;
}
