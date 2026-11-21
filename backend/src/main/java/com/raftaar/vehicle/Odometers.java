package com.raftaar.vehicle;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.raftaar.common.Text;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.springframework.transaction.annotation.Transactional;

/** Odometer readings: the ones you enter, and the full history from every fill-up, service and expense too. */
@Service
public class Odometers {
    private static final Logger log = LoggerFactory.getLogger(Odometers.class);
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
    @Transactional(readOnly = true)
    public List<VehicleStats.Reading> history(Long vehicleId) {
        Vehicle vehicle = vehicles.require(vehicleId, "Vehicle");
        return stats.readings(vehicle).reversed();
    }

    @Transactional(readOnly = true)
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
        OdometerReading saved = readings.save(reading);
        log.debug("Odometer reading {} added to vehicle {}: {} km", saved.id, vehicleId, saved.odometer);
        return saved;
    }

    public void delete(Long id) {
        readings.deleteById(id);
        log.info("Odometer reading {} deleted", id);
    }
}
