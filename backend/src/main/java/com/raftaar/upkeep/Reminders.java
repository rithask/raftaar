package com.raftaar.upkeep;

import com.raftaar.common.Text;
import com.raftaar.vehicle.Vehicle;
import com.raftaar.vehicle.VehicleRepo;
import com.raftaar.vehicle.VehicleStats;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.transaction.annotation.Transactional;

/** Reminders for oil changes, chain lube, services…: by km, by date, or both. */
@Service
public class Reminders {
    private final ReminderRepo reminders;
    private final VehicleRepo vehicles;
    private final VehicleStats stats;

    public Reminders(ReminderRepo reminders, VehicleRepo vehicles, VehicleStats stats) {
        this.reminders = reminders;
        this.vehicles = vehicles;
        this.stats = stats;
    }

    public record Input(String title, BigDecimal intervalKm, Integer intervalMonths, LocalDate lastDoneOn, BigDecimal lastDoneOdometer,
                        LocalDate dueOn, BigDecimal dueOdometer, Integer notifyDaysBefore, Integer notifyKmBefore, Boolean active,
                        String notes) {}

    /** All of a vehicle's reminders with how soon each is due, finished one-offs included. */
    @Transactional(readOnly = true)
    public List<VehicleStats.ReminderView> list(Long vehicleId) {
        Vehicle vehicle = vehicles.require(vehicleId, "Vehicle");
        VehicleStats.Odometer odometer = stats.odometer(vehicle);
        BigDecimal current = odometer.estimated() != null ? odometer.estimated() : odometer.known();
        LocalDate today = LocalDate.now();
        return reminders.findByVehicleIdOrderByIdAsc(vehicleId).stream()
                .map(reminder -> new VehicleStats.ReminderView(reminder, ReminderState.of(reminder, current, odometer.kmPerDay(), today))).toList();
    }

    public Reminder create(Long vehicleId, Input input) {
        vehicles.require(vehicleId, "Vehicle");
        Reminder reminder = new Reminder();
        reminder.vehicleId = vehicleId;
        return save(reminder, input);
    }

    public Reminder update(Long id, Input input) {
        return save(reminders.require(id, "Reminder"), input);
    }

    public void delete(Long id) {
        reminders.deleteById(id);
    }

    private Reminder save(Reminder reminder, Input input) {
        if (input.title() == null || input.title().isBlank()) throw new IllegalArgumentException("Give the reminder a name, e.g. Engine oil");
        boolean repeats = input.intervalKm() != null || input.intervalMonths() != null;
        boolean once = input.dueOn() != null || input.dueOdometer() != null;
        if (!repeats && !once) throw new IllegalArgumentException("Set how often (km or months), or when it's due");
        reminder.title = input.title().trim();
        reminder.intervalKm = input.intervalKm();
        reminder.intervalMonths = input.intervalMonths();
        reminder.lastDoneOn = input.lastDoneOn();
        reminder.lastDoneOdometer = input.lastDoneOdometer();
        reminder.dueOn = input.dueOn();
        reminder.dueOdometer = input.dueOdometer();
        if (input.notifyDaysBefore() != null) reminder.notifyDaysBefore = input.notifyDaysBefore();
        if (input.notifyKmBefore() != null) reminder.notifyKmBefore = input.notifyKmBefore();
        reminder.active = input.active() == null || input.active();
        reminder.notes = Text.trimToNull(input.notes());
        reminder.lastNotifiedState = null;
        return reminders.save(reminder);
    }
}
