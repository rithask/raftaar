package com.raftaar.fuel;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface FuelPriceRepo extends JpaRepository<FuelPrice, Long> {
    Optional<FuelPrice> findFirstByRegionIgnoreCaseAndFuelTypeOrderByEffectiveAtDesc(String region, FuelType fuelType);
    Optional<FuelPrice> findFirstByRegionIgnoreCaseAndDistrictIgnoreCaseAndFuelTypeOrderByEffectiveAtDesc(String region, String district, FuelType fuelType);

    List<FuelPrice> findByFuelTypeAndSourceNotOrderByEffectiveAtAsc(FuelType fuelType, FuelPrice.Source source);

    /** The newest price for each place and fuel. */
    @Query(value = """
            select distinct on (lower(region), coalesce(lower(district), ''), fuel_type) *
            from fuel_price
            order by lower(region), coalesce(lower(district), ''), fuel_type, effective_at desc
            """, nativeQuery = true)
    List<FuelPrice> latest();
}
