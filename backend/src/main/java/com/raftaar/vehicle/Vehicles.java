package com.raftaar.vehicle;

import com.raftaar.common.Files;
import com.raftaar.common.Text;
import com.raftaar.fuel.FuelType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/** Your vehicles: adding, changing, ordering and removing them, and their photos. */
@Service
public class Vehicles {
    private static final Logger log = LoggerFactory.getLogger(Vehicles.class);

    private final VehicleRepo vehicles;
    private final Files files;

    public Vehicles(VehicleRepo vehicles, Files files) {
        this.vehicles = vehicles;
        this.files = files;
    }

    public record Input(String name, Vehicle.Kind kind, FuelType fuelType, String make, String model, Integer year,
                        String registration, String color, BigDecimal tankCapacity, LocalDate purchaseDate,
                        BigDecimal purchaseOdometer, BigDecimal purchasePrice, Boolean isDefault, Boolean archived, String notes) {}

    @Transactional(readOnly = true)
    public List<Vehicle> list() {
        return vehicles.findAllByOrderByArchivedAscSortOrderAscIdAsc();
    }

    @Transactional(readOnly = true)
    public Vehicle get(Long id) {
        return vehicles.require(id, "Vehicle");
    }

    @Transactional
    public Vehicle create(Input input) {
        Vehicle vehicle = new Vehicle();
        vehicle.sortOrder = (int) vehicles.count();
        Vehicle saved = save(vehicle, input);
        log.info("Vehicle \"{}\" added", saved.name);
        return saved;
    }

    @Transactional
    public Vehicle update(Long id, Input input) {
        Vehicle saved = save(get(id), input);
        log.debug("Vehicle {} changed", id);
        return saved;
    }

    /** Removes the vehicle with everything recorded for it (the database cascades) and its photo. */
    @Transactional
    public void delete(Long id) {
        Vehicle vehicle = get(id);
        files.delete(vehicle.imageFile);
        vehicles.delete(vehicle);
        log.info("Vehicle \"{}\" deleted with all its records", vehicle.name);
    }

    /** The garage order: {@code ids} first to last. */
    @Transactional
    public void reorder(List<Long> ids) {
        for (int position = 0; position < ids.size(); position++) {
            Vehicle vehicle = get(ids.get(position));
            vehicle.sortOrder = position;
            vehicles.save(vehicle);
        }
        log.debug("Garage reordered: {}", ids);
    }

    @Transactional
    public Vehicle setPhoto(Long id, MultipartFile file) throws IOException {
        Vehicle vehicle = get(id);
        String previous = vehicle.imageFile;
        vehicle.imageFile = files.saveImage(file);
        vehicle.imageVersion++;
        vehicles.save(vehicle);
        files.delete(previous);
        log.debug("Vehicle {}: photo {} ({} bytes)", id, previous == null ? "added" : "replaced", file.getSize());
        return vehicle;
    }

    @Transactional
    public Vehicle removePhoto(Long id) {
        Vehicle vehicle = get(id);
        files.delete(vehicle.imageFile);
        vehicle.imageFile = null;
        vehicle.imageVersion++;
        log.debug("Vehicle {}: photo removed", id);
        return vehicles.save(vehicle);
    }

    /** Where the vehicle's photo is on disk, if it has one. */
    public Optional<Path> photo(Long id) {
        Vehicle vehicle = get(id);
        return Optional.ofNullable(vehicle.imageFile).map(files::resolve);
    }

    private Vehicle save(Vehicle vehicle, Input input) {
        if (input.name() == null || input.name().isBlank()) throw new IllegalArgumentException("Give it a name");
        vehicle.name = input.name().trim();
        vehicle.kind = input.kind() != null ? input.kind() : Vehicle.Kind.MOTORCYCLE;
        vehicle.fuelType = input.fuelType() != null ? input.fuelType() : FuelType.PETROL;
        vehicle.make = Text.trimToNull(input.make());
        vehicle.model = Text.trimToNull(input.model());
        vehicle.year = input.year();
        vehicle.registration = input.registration() == null ? null : Text.trimToNull(input.registration().toUpperCase());
        vehicle.color = Text.trimToNull(input.color());
        vehicle.tankCapacity = input.tankCapacity();
        vehicle.purchaseDate = input.purchaseDate();
        vehicle.purchaseOdometer = input.purchaseOdometer();
        vehicle.purchasePrice = input.purchasePrice();
        vehicle.archived = Boolean.TRUE.equals(input.archived());
        vehicle.notes = Text.trimToNull(input.notes());
        boolean makeDefault = Boolean.TRUE.equals(input.isDefault()) && !vehicle.archived;
        if (makeDefault) clearOtherDefaults(vehicle);
        vehicle.isDefault = makeDefault;
        return vehicles.save(vehicle);
    }

    /** Only one vehicle is the default (the one fill-ups go to when nothing says otherwise). */
    private void clearOtherDefaults(Vehicle vehicle) {
        vehicles.findAll().stream().filter(other -> other.isDefault && !other.id.equals(vehicle.id)).forEach(other -> {
            other.isDefault = false;
            vehicles.save(other);
        });
    }
}
