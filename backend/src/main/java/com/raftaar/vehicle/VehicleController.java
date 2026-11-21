package com.raftaar.vehicle;

import com.raftaar.common.Files;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import com.raftaar.common.ApiErrors;
import com.raftaar.fuel.FuelEntry;
import com.raftaar.fuel.FuelType;
import com.raftaar.inbox.Suggestion;
import com.raftaar.inbox.SuggestionRepo;
import com.raftaar.inbox.Trip;
import com.raftaar.inbox.TripRepo;

@RestController
@RequestMapping("/api")
public class VehicleController {
    private final VehicleRepo vehicles;
    private final VehicleStats stats;
    private final Files files;
    private final TripRepo trips;
    private final SuggestionRepo suggestions;

    public VehicleController(VehicleRepo vehicles, VehicleStats stats, Files files, TripRepo trips, SuggestionRepo suggestions) {
        this.vehicles = vehicles;
        this.stats = stats;
        this.files = files;
        this.trips = trips;
        this.suggestions = suggestions;
    }

    /** One card per vehicle, plus how much is waiting in the inbox. */
    public record Card(Vehicle vehicle, VehicleStats.Odometer odometer, BigDecimal averageEconomy, BigDecimal lastEconomy, String unit,
                       FuelEntry lastFill, BigDecimal spentThisMonth, BigDecimal costPerKm,
                       List<VehicleStats.ReminderView> attention, List<VehicleStats.DocumentView> papers) {}

    public record Garage(List<Card> vehicles, long tripsToSort, long toConfirm) {}

    @GetMapping("/garage")
    public Garage garage() {
        List<Card> cards = vehicles.findAllByOrderByArchivedAscSortOrderAscIdAsc().stream().map(v -> {
            var s = stats.summary(v);
            var attention = s.reminders().stream().filter(r -> r.status().state() != com.raftaar.upkeep.ReminderState.State.OK
                    && r.status().state() != com.raftaar.upkeep.ReminderState.State.UNKNOWN).toList();
            var papers = s.documents().stream().filter(d -> !"VALID".equals(d.state()) && !"NO_EXPIRY".equals(d.state())).toList();
            return new Card(v, s.odometer(), s.averageEconomy(), s.lastEconomy(), s.unit(), s.lastFill(), s.costs().thisMonth(),
                    s.costs().perKm(), attention, papers);
        }).toList();
        return new Garage(cards, trips.countByStatus(Trip.Status.PENDING), suggestions.countByStatus(Suggestion.Status.PENDING));
    }

    @GetMapping("/vehicles")
    public List<Vehicle> list() {
        return vehicles.findAllByOrderByArchivedAscSortOrderAscIdAsc();
    }

    @GetMapping("/vehicles/{id}")
    public VehicleStats.Summary get(@PathVariable Long id) {
        return stats.summary(find(id));
    }

    public record VehicleInput(String name, Vehicle.Kind kind, FuelType fuelType, String make, String model, Integer year,
                               String registration, String color, BigDecimal tankCapacity, LocalDate purchaseDate,
                               BigDecimal purchaseOdometer, BigDecimal purchasePrice, Boolean isDefault, Boolean archived, String notes) {}

    @PostMapping("/vehicles")
    @Transactional
    public Vehicle create(@RequestBody VehicleInput in) {
        Vehicle v = new Vehicle();
        v.sortOrder = vehicles.findAll().size();
        return save(v, in);
    }

    @PutMapping("/vehicles/{id}")
    @Transactional
    public Vehicle update(@PathVariable Long id, @RequestBody VehicleInput in) {
        return save(find(id), in);
    }

    private Vehicle save(Vehicle v, VehicleInput in) {
        if (in.name() == null || in.name().isBlank()) throw new IllegalArgumentException("Give it a name");
        v.name = in.name().trim();
        v.kind = in.kind() != null ? in.kind() : Vehicle.Kind.MOTORCYCLE;
        v.fuelType = in.fuelType() != null ? in.fuelType() : FuelType.PETROL;
        v.make = trim(in.make());
        v.model = trim(in.model());
        v.year = in.year();
        v.registration = in.registration() == null ? null : trim(in.registration().toUpperCase());
        v.color = trim(in.color());
        v.tankCapacity = in.tankCapacity();
        v.purchaseDate = in.purchaseDate();
        v.purchaseOdometer = in.purchaseOdometer();
        v.purchasePrice = in.purchasePrice();
        v.archived = Boolean.TRUE.equals(in.archived());
        v.notes = trim(in.notes());
        boolean makeDefault = Boolean.TRUE.equals(in.isDefault()) && !v.archived;
        if (makeDefault) vehicles.findAll().stream().filter(o -> o.isDefault && !o.id.equals(v.id)).forEach(o -> {
            o.isDefault = false;
            vehicles.save(o);
        });
        v.isDefault = makeDefault;
        return vehicles.save(v);
    }

    @DeleteMapping("/vehicles/{id}")
    @Transactional
    public void delete(@PathVariable Long id) {
        Vehicle v = find(id);
        files.delete(v.imageFile);
        vehicles.delete(v);
    }

    public record Order(List<Long> ids) {}

    @PutMapping("/vehicles/order")
    @Transactional
    public void reorder(@RequestBody Order order) {
        for (int i = 0; i < order.ids().size(); i++) {
            Vehicle v = find(order.ids().get(i));
            v.sortOrder = i;
            vehicles.save(v);
        }
    }

    // ---- photo ------------------------------------------------------------------------------------------------

    @PutMapping(value = "/vehicles/{id}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public Vehicle setImage(@PathVariable Long id, @RequestParam("file") MultipartFile file) throws IOException {
        Vehicle v = find(id);
        String old = v.imageFile;
        v.imageFile = files.saveImage(file);
        v.imageVersion++;
        vehicles.save(v);
        files.delete(old);
        return v;
    }

    @DeleteMapping("/vehicles/{id}/image")
    @Transactional
    public Vehicle removeImage(@PathVariable Long id) {
        Vehicle v = find(id);
        files.delete(v.imageFile);
        v.imageFile = null;
        v.imageVersion++;
        return vehicles.save(v);
    }

    /** The photo. The URL carries ?v=imageVersion, so it can be cached for good. */
    @GetMapping("/vehicles/{id}/image")
    public ResponseEntity<FileSystemResource> image(@PathVariable Long id) {
        Vehicle v = find(id);
        if (v.imageFile == null) return ResponseEntity.notFound().build();
        var res = new FileSystemResource(files.resolve(v.imageFile));
        if (!res.exists()) return ResponseEntity.notFound().build();
        return ResponseEntity.ok()
                .contentType(MediaTypeFactory.getMediaType(res).orElse(MediaType.APPLICATION_OCTET_STREAM))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePrivate().immutable())
                .body(res);
    }

    Vehicle find(Long id) {
        return vehicles.findById(id).orElseThrow(() -> ApiErrors.notFound("Vehicle"));
    }

    public static String trim(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
