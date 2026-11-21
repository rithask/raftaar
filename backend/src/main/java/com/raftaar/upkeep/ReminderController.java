package com.raftaar.upkeep;

import com.raftaar.vehicle.VehicleRepo;
import com.raftaar.vehicle.VehicleStats;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import com.raftaar.vehicle.VehicleController;
import com.raftaar.common.Text;

@RestController
@RequestMapping("/api")
public class ReminderController {
    private final ReminderRepo reminders;
    private final VehicleRepo vehicles;
    private final VehicleStats stats;

    public ReminderController(ReminderRepo reminders, VehicleRepo vehicles, VehicleStats stats) {
        this.reminders = reminders;
        this.vehicles = vehicles;
        this.stats = stats;
    }

    /** All of a vehicle's reminders, finished one-offs included. */
    @GetMapping("/vehicles/{id}/reminders")
    public List<VehicleStats.ReminderView> list(@PathVariable Long id) {
        var v = vehicles.require(id, "Vehicle");
        var odo = stats.odometer(v);
        var current = odo.estimated() != null ? odo.estimated() : odo.known();
        return reminders.findByVehicleIdOrderByIdAsc(id).stream()
                .map(r -> new VehicleStats.ReminderView(r, ReminderState.of(r, current, odo.kmPerDay(), LocalDate.now()))).toList();
    }

    public record Input(String title, BigDecimal intervalKm, Integer intervalMonths, LocalDate lastDoneOn, BigDecimal lastDoneOdometer,
                        LocalDate dueOn, BigDecimal dueOdometer, Integer notifyDaysBefore, Integer notifyKmBefore, Boolean active,
                        String notes) {}

    @PostMapping("/vehicles/{id}/reminders")
    public Reminder create(@PathVariable Long id, @RequestBody Input in) {
        vehicles.require(id, "Vehicle");
        Reminder r = new Reminder();
        r.vehicleId = id;
        return save(r, in);
    }

    @PutMapping("/reminders/{id}")
    public Reminder update(@PathVariable Long id, @RequestBody Input in) {
        return save(reminders.require(id, "Reminder"), in);
    }

    private Reminder save(Reminder r, Input in) {
        if (in.title() == null || in.title().isBlank()) throw new IllegalArgumentException("Give the reminder a name, e.g. Engine oil");
        boolean interval = in.intervalKm() != null || in.intervalMonths() != null;
        boolean fixed = in.dueOn() != null || in.dueOdometer() != null;
        if (!interval && !fixed) throw new IllegalArgumentException("Set how often (km or months), or when it's due");
        r.title = in.title().trim();
        r.intervalKm = in.intervalKm();
        r.intervalMonths = in.intervalMonths();
        r.lastDoneOn = in.lastDoneOn();
        r.lastDoneOdometer = in.lastDoneOdometer();
        r.dueOn = in.dueOn();
        r.dueOdometer = in.dueOdometer();
        if (in.notifyDaysBefore() != null) r.notifyDaysBefore = in.notifyDaysBefore();
        if (in.notifyKmBefore() != null) r.notifyKmBefore = in.notifyKmBefore();
        r.active = in.active() == null || in.active();
        r.notes = Text.trimToNull(in.notes());
        r.lastNotifiedState = null;
        return reminders.save(r);
    }

    @DeleteMapping("/reminders/{id}")
    public void delete(@PathVariable Long id) {
        reminders.deleteById(id);
    }
}
