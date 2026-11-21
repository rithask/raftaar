package com.raftaar.vehicle;

import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class OdometerController {
    private final Odometers odometers;

    public OdometerController(Odometers odometers) {
        this.odometers = odometers;
    }

    @GetMapping("/vehicles/{vehicleId}/odometer")
    public List<VehicleStats.Reading> history(@PathVariable Long vehicleId) {
        return odometers.history(vehicleId);
    }

    @GetMapping("/vehicles/{vehicleId}/odometer/manual")
    public List<OdometerReading> entered(@PathVariable Long vehicleId) {
        return odometers.entered(vehicleId);
    }

    @PostMapping("/vehicles/{vehicleId}/odometer")
    public OdometerReading add(@PathVariable Long vehicleId, @RequestBody Odometers.Input input) {
        return odometers.add(vehicleId, input);
    }

    @DeleteMapping("/odometer/{id}")
    public void delete(@PathVariable Long id) {
        odometers.delete(id);
    }
}
