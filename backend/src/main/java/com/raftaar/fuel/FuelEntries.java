package com.raftaar.fuel;

import com.raftaar.common.Text;
import com.raftaar.places.Places;
import com.raftaar.vehicle.Vehicle;
import com.raftaar.vehicle.VehicleRepo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** A vehicle's fill-ups: listing them with their mileage, and adding, changing and removing them. */
@Service
public class FuelEntries {
    private static final Logger log = LoggerFactory.getLogger(FuelEntries.class);

    private final FuelEntryRepo fills;
    private final VehicleRepo vehicles;
    private final Places places;
    private final FuelPrices prices;

    public FuelEntries(FuelEntryRepo fills, VehicleRepo vehicles, Places places, FuelPrices prices) {
        this.fills = fills;
        this.vehicles = vehicles;
        this.places = places;
        this.prices = prices;
    }

    public record Input(Long vehicleId, Instant filledAt, BigDecimal odometer, BigDecimal volume, BigDecimal pricePerUnit,
                        BigDecimal totalCost, Boolean fullTank, Boolean missedPrevious, String stationName, String stationBrand,
                        Double latitude, Double longitude, String region, String district, String notes) {

        Input forVehicle(Long id) {
            return new Input(id, filledAt, odometer, volume, pricePerUnit, totalCost, fullTank, missedPrevious, stationName,
                    stationBrand, latitude, longitude, region, district, notes);
        }
    }

    /** {@code publishedPrice}: the going rate there and then, when one was looked up or entered; null otherwise. */
    public record FuelRow(FuelEntry entry, BigDecimal kmPerUnit, BigDecimal distance, BigDecimal publishedPrice) {}

    /** Newest first, each full tank with the mileage of the stretch it closed. */
    @Transactional(readOnly = true)
    public List<FuelRow> list(Long vehicleId) {
        Vehicle vehicle = vehicles.require(vehicleId, "Vehicle");
        return rows(vehicle, fills.findByVehicleIdOrderByFilledAtAscIdAsc(vehicleId));
    }

    /** The rows for a vehicle's fill-ups already loaded (oldest first): newest first, with mileage and the going rate. */
    public List<FuelRow> rows(Vehicle vehicle, List<FuelEntry> inOrder) {
        Economy.Result economy = Economy.of(inOrder);
        var published = prices.publishedAt(inOrder, vehicle.fuelType);
        return inOrder.reversed().stream().map(fill -> {
            var stretch = economy.byEndId().get(fill.id);
            return new FuelRow(fill, stretch == null ? null : stretch.kmPerUnit(), stretch == null ? null : stretch.distance(),
                    published.get(fill.id));
        }).toList();
    }

    /**
     * Adds a fill-up. The same fill-up sent again (same vehicle, time and odometer: a phone re-sending one it saved
     * while offline after the first reply got lost, or a double tap) returns the one already saved instead of a copy.
     */
    @Transactional
    public FuelEntry add(Long vehicleId, Input input) {
        vehicles.require(vehicleId, "Vehicle");
        if (input.filledAt() != null && input.odometer() != null) {
            var same = fills.findFirstByVehicleIdAndFilledAtAndOdometer(vehicleId, input.filledAt(), input.odometer());
            if (same.isPresent()) {
                log.debug("Fill-up at {} km on vehicle {} already saved (id {}); not adding it again", input.odometer(), vehicleId, same.get().id);
                return same.get();
            }
        }
        return save(new FuelEntry(), input.forVehicle(vehicleId));
    }

    @Transactional
    public FuelEntry update(Long id, Input input) {
        FuelEntry fill = fills.require(id, "Fill-up");
        return save(fill, input.forVehicle(input.vehicleId() != null ? input.vehicleId() : fill.vehicleId));
    }

    /** Marks a "the Hisaab payment changed" note as seen. */
    public FuelEntry resolveIssue(Long id) {
        FuelEntry fill = fills.require(id, "Fill-up");
        fill.sourceIssue = null;
        return fills.save(fill);
    }

    public void delete(Long id) {
        fills.deleteById(id);
    }

    /** Fills in a fill-up from the input: works out the missing one of price, volume and total, and the state. */
    @Transactional
    public FuelEntry save(FuelEntry fill, Input input) {
        Vehicle vehicle = vehicles.require(input.vehicleId() != null ? input.vehicleId() : fill.vehicleId, "Vehicle");
        if (input.odometer() == null || input.odometer().signum() < 0) throw new IllegalArgumentException("Odometer reading is required");
        var amounts = FuelMath.complete(input.volume(), input.pricePerUnit(), input.totalCost());
        fill.vehicleId = vehicle.id;
        fill.filledAt = input.filledAt() != null ? input.filledAt() : Instant.now();
        fill.odometer = input.odometer();
        fill.volume = amounts.volume();
        fill.pricePerUnit = amounts.pricePerUnit();
        fill.totalCost = amounts.totalCost();
        fill.fullTank = input.fullTank() == null || input.fullTank();
        fill.missedPrevious = Boolean.TRUE.equals(input.missedPrevious());
        fill.stationName = Text.trimToNull(input.stationName());
        fill.stationBrand = Text.trimToNull(input.stationBrand());
        fill.latitude = input.latitude();
        fill.longitude = input.longitude();
        fill.region = Text.trimToNull(input.region());
        fill.district = Text.trimToNull(input.district());
        fill.notes = Text.trimToNull(input.notes());
        if (fill.region == null && fill.latitude != null && fill.longitude != null) {
            places.region(fill.latitude, fill.longitude).ifPresent(region -> {
                fill.region = region.state();
                fill.district = region.district();
            });
        }
        FuelEntry saved = fills.save(fill);
        prices.learn(saved, vehicle.fuelType);
        return saved;
    }
}
