package com.raftaar.upkeep;

import com.raftaar.vehicle.VehicleStats;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class ReminderController {
    private final Reminders reminders;

    public ReminderController(Reminders reminders) {
        this.reminders = reminders;
    }

    @GetMapping("/vehicles/{vehicleId}/reminders")
    public List<VehicleStats.ReminderView> list(@PathVariable Long vehicleId) {
        return reminders.list(vehicleId);
    }

    @PostMapping("/vehicles/{vehicleId}/reminders")
    public Reminder create(@PathVariable Long vehicleId, @RequestBody Reminders.Input input) {
        return reminders.create(vehicleId, input);
    }

    @PutMapping("/reminders/{id}")
    public Reminder update(@PathVariable Long id, @RequestBody Reminders.Input input) {
        return reminders.update(id, input);
    }

    @DeleteMapping("/reminders/{id}")
    public void delete(@PathVariable Long id) {
        reminders.delete(id);
    }
}
