package com.raftaar.repo;

import com.raftaar.domain.FuelStation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FuelStationRepo extends JpaRepository<FuelStation, String> {
    List<FuelStation> findByLatitudeBetweenAndLongitudeBetween(double latMin, double latMax, double lonMin, double lonMax);
}
