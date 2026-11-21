package com.raftaar.vehicle;

import org.springframework.core.io.FileSystemResource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Duration;
import java.util.List;

@RestController
@RequestMapping("/api")
public class VehicleController {
    private final Vehicles vehicles;
    private final Garage garage;
    private final VehicleStats stats;
    private final VehiclePage vehiclePage;

    public VehicleController(Vehicles vehicles, Garage garage, VehicleStats stats, VehiclePage vehiclePage) {
        this.vehicles = vehicles;
        this.garage = garage;
        this.stats = stats;
        this.vehiclePage = vehiclePage;
    }

    @GetMapping("/garage")
    public Garage.Overview garage() {
        return garage.overview();
    }

    @GetMapping("/vehicles")
    public List<Vehicle> list() {
        return vehicles.list();
    }

    @GetMapping("/vehicles/{id}")
    public VehicleStats.Summary get(@PathVariable Long id) {
        return stats.summary(vehicles.get(id));
    }

    /** The vehicle page in one request: summary, fill-ups, reminders, services, expenses and trips. */
    @GetMapping("/vehicles/{id}/page")
    public VehiclePage.Page page(@PathVariable Long id) {
        return vehiclePage.load(id);
    }

    @PostMapping("/vehicles")
    public Vehicle create(@RequestBody Vehicles.Input input) {
        return vehicles.create(input);
    }

    @PutMapping("/vehicles/{id}")
    public Vehicle update(@PathVariable Long id, @RequestBody Vehicles.Input input) {
        return vehicles.update(id, input);
    }

    @DeleteMapping("/vehicles/{id}")
    public void delete(@PathVariable Long id) {
        vehicles.delete(id);
    }

    public record Order(List<Long> ids) {}

    @PutMapping("/vehicles/order")
    public void reorder(@RequestBody Order order) {
        vehicles.reorder(order.ids());
    }

    @PutMapping(value = "/vehicles/{id}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Vehicle setPhoto(@PathVariable Long id, @RequestParam("file") MultipartFile file) throws IOException {
        return vehicles.setPhoto(id, file);
    }

    @DeleteMapping("/vehicles/{id}/image")
    public Vehicle removePhoto(@PathVariable Long id) {
        return vehicles.removePhoto(id);
    }

    /**
     * The photo, or with {@code ?size=small} its small copy (for the sidebar and lists). The URL carries
     * ?v=imageVersion, so it can be cached for good.
     */
    @GetMapping("/vehicles/{id}/image")
    public ResponseEntity<FileSystemResource> photo(@PathVariable Long id, @RequestParam(required = false) String size) {
        var file = vehicles.photo(id, "small".equals(size)).map(FileSystemResource::new).filter(FileSystemResource::exists);
        if (file.isEmpty()) return ResponseEntity.notFound().build();
        return ResponseEntity.ok()
                .contentType(MediaTypeFactory.getMediaType(file.get()).orElse(MediaType.APPLICATION_OCTET_STREAM))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePrivate().immutable())
                .body(file.get());
    }
}
