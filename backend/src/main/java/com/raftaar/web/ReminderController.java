package com.raftaar.web;

import com.raftaar.domain.Reminder;
import com.raftaar.repo.ReminderRepo;
import com.raftaar.repo.VehicleRepo;
import com.raftaar.service.ReminderState;
import com.raftaar.service.VehicleStats;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

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
        var v = vehicles.findById(id).orElseThrow(() -> ApiErrors.notFound("Vehicle"));
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
        vehicles.findById(id).orElseThrow(() -> ApiErrors.notFound("Vehicle"));
        Reminder r = new Reminder();
        r.vehicleId = id;
        return save(r, in);
    }

    @PutMapping("/reminders/{id}")
    public Reminder update(@PathVariable Long id, @RequestBody Input in) {
        return save(reminders.findById(id).orElseThrow(() -> ApiErrors.notFound("Reminder")), in);
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
        r.notes = VehicleController.trim(in.notes());
        r.lastNotifiedState = null;
        return reminders.save(r);
    }

    @DeleteMapping("/reminders/{id}")
    public void delete(@PathVariable Long id) {
        reminders.deleteById(id);
    }
}
