package com.raftaar.fuel;

import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class FuelController {
    private final FuelEntries fuelEntries;

    public FuelController(FuelEntries fuelEntries) {
        this.fuelEntries = fuelEntries;
    }

    @GetMapping("/vehicles/{vehicleId}/fuel")
    public List<FuelEntries.FuelRow> list(@PathVariable Long vehicleId) {
        return fuelEntries.list(vehicleId);
    }

    @PostMapping("/vehicles/{vehicleId}/fuel")
    public FuelEntry add(@PathVariable Long vehicleId, @RequestBody FuelEntries.Input input) {
        return fuelEntries.add(vehicleId, input);
    }

    @PutMapping("/fuel/{id}")
    public FuelEntry update(@PathVariable Long id, @RequestBody FuelEntries.Input input) {
        return fuelEntries.update(id, input);
    }

    @PostMapping("/fuel/{id}/resolve")
    public FuelEntry resolveIssue(@PathVariable Long id) {
        return fuelEntries.resolveIssue(id);
    }

    @DeleteMapping("/fuel/{id}")
    public void delete(@PathVariable Long id) {
        fuelEntries.delete(id);
    }
}
