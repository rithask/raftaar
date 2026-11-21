package com.raftaar.fuel;

import com.raftaar.vehicle.Vehicle;
import com.raftaar.vehicle.VehicleRepo;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import com.raftaar.places.Places;
import com.raftaar.common.Text;

@Service
public class FuelEntries {
    private final FuelEntryRepo repo;
    private final VehicleRepo vehicles;
    private final Places places;
    private final FuelPrices prices;

    public FuelEntries(FuelEntryRepo repo, VehicleRepo vehicles, Places places, FuelPrices prices) {
        this.repo = repo;
        this.vehicles = vehicles;
        this.places = places;
        this.prices = prices;
    }

    public record Input(Long vehicleId, Instant filledAt, BigDecimal odometer, BigDecimal volume, BigDecimal pricePerUnit,
                        BigDecimal totalCost, Boolean fullTank, Boolean missedPrevious, String stationName, String stationBrand,
                        Double latitude, Double longitude, String region, String district, String notes) {}

    @Transactional
    public FuelEntry save(FuelEntry e, Input in) {
        Vehicle v = vehicles.require(in.vehicleId() != null ? in.vehicleId() : e.vehicleId, "Vehicle");
        if (in.odometer() == null || in.odometer().signum() < 0) throw new IllegalArgumentException("Odometer reading is required");
        var fill = FuelMath.complete(in.volume(), in.pricePerUnit(), in.totalCost());
        e.vehicleId = v.id;
        e.filledAt = in.filledAt() != null ? in.filledAt() : Instant.now();
        e.odometer = in.odometer();
        e.volume = fill.volume();
        e.pricePerUnit = fill.pricePerUnit();
        e.totalCost = fill.totalCost();
        e.fullTank = in.fullTank() == null || in.fullTank();
        e.missedPrevious = Boolean.TRUE.equals(in.missedPrevious());
        e.stationName = Text.trimToNull(in.stationName());
        e.stationBrand = Text.trimToNull(in.stationBrand());
        e.latitude = in.latitude();
        e.longitude = in.longitude();
        e.region = Text.trimToNull(in.region());
        e.district = Text.trimToNull(in.district());
        e.notes = Text.trimToNull(in.notes());
        if (e.region == null && e.latitude != null && e.longitude != null) {
            places.region(e.latitude, e.longitude).ifPresent(r -> {
                e.region = r.state();
                e.district = r.district();
            });
        }
        FuelEntry saved = repo.save(e);
        prices.learn(saved, v.fuelType);
        return saved;
    }

}
