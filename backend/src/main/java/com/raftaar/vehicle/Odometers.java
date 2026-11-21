package com.raftaar.vehicle;

import com.raftaar.common.Text;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Odometer readings: the ones you enter, and the full history from every fill-up, service and expense too. */
@Service
public class Odometers {
    private final OdometerReadingRepo readings;
    private final VehicleRepo vehicles;
    private final VehicleStats stats;

    public Odometers(OdometerReadingRepo readings, VehicleRepo vehicles, VehicleStats stats) {
        this.readings = readings;
        this.vehicles = vehicles;
        this.stats = stats;
    }

    public record Input(Instant readAt, BigDecimal odometer, String notes) {}

    /** Every reading of this vehicle's odometer, newest first, whatever it came from. */
    public List<VehicleStats.Reading> history(Long vehicleId) {
        Vehicle vehicle = vehicles.require(vehicleId, "Vehicle");
        return stats.readings(vehicle).reversed();
    }

    public List<OdometerReading> entered(Long vehicleId) {
        return readings.findByVehicleIdOrderByReadAtDesc(vehicleId);
    }

    public OdometerReading add(Long vehicleId, Input input) {
        vehicles.require(vehicleId, "Vehicle");
        if (input.odometer() == null || input.odometer().signum() < 0) throw new IllegalArgumentException("Odometer reading is required");
        OdometerReading reading = new OdometerReading();
        reading.vehicleId = vehicleId;
        reading.readAt = input.readAt() != null ? input.readAt() : Instant.now();
        reading.odometer = input.odometer();
        reading.notes = Text.trimToNull(input.notes());
        return readings.save(reading);
    }

    public void delete(Long id) {
        readings.deleteById(id);
    }
}
