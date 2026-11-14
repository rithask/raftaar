package com.raftaar.web;

import com.raftaar.domain.*;
import com.raftaar.repo.*;
import com.raftaar.service.FuelEntries;
import com.raftaar.service.FuelPrices;
import com.raftaar.service.VehicleStats;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Fill-ups, services, expenses and odometer readings for a vehicle. */
@RestController
@RequestMapping("/api")
public class LogController {
    private final FuelEntryRepo fuel;
    private final FuelEntries fuelEntries;
    private final ServiceRecordRepo services;
    private final ReminderRepo reminders;
    private final ExpenseRepo expenses;
    private final OdometerReadingRepo readings;
    private final VehicleRepo vehicles;
    private final VehicleStats stats;
    private final FuelPrices fuelPrices;

    public LogController(FuelEntryRepo fuel, FuelEntries fuelEntries, ServiceRecordRepo services, ReminderRepo reminders,
                         ExpenseRepo expenses, OdometerReadingRepo readings, VehicleRepo vehicles, VehicleStats stats,
                         FuelPrices fuelPrices) {
        this.fuel = fuel;
        this.fuelEntries = fuelEntries;
        this.services = services;
        this.reminders = reminders;
        this.expenses = expenses;
        this.readings = readings;
        this.vehicles = vehicles;
        this.stats = stats;
        this.fuelPrices = fuelPrices;
    }

    // ---- fuel -------------------------------------------------------------------------------------------------

    /** {@code publishedPrice}: the going rate there and then, when one was looked up or entered; null otherwise. */
    public record FuelRow(FuelEntry entry, BigDecimal kmPerUnit, BigDecimal distance, BigDecimal publishedPrice) {}

    /** Newest first, each full tank with the mileage of the stretch it closed. */
    @GetMapping("/vehicles/{id}/fuel")
    public List<FuelRow> fuel(@PathVariable Long id) {
        Vehicle v = vehicle(id);
        var fills = fuel.findByVehicleIdOrderByFilledAtAscIdAsc(id);
        var eco = stats.economy(fills);
        var published = fuelPrices.publishedAt(fills, v.fuelType);
        return fills.reversed().stream().map(f -> {
            var s = eco.byEndId().get(f.id);
            return new FuelRow(f, s == null ? null : s.kmPerUnit(), s == null ? null : s.distance(), published.get(f.id));
        }).toList();
    }

    /**
     * Adds a fill-up. The same fill-up sent again (same vehicle, time and odometer: a phone re-sending one it saved
     * while offline after the first reply got lost, or a double tap) returns the one already saved instead of a copy.
     */
    @PostMapping("/vehicles/{id}/fuel")
    public FuelEntry addFuel(@PathVariable Long id, @RequestBody FuelEntries.Input in) {
        vehicle(id);
        if (in.filledAt() != null && in.odometer() != null) {
            var same = fuel.findFirstByVehicleIdAndFilledAtAndOdometer(id, in.filledAt(), in.odometer());
            if (same.isPresent()) return same.get();
        }
        return fuelEntries.save(new FuelEntry(), withVehicle(in, id));
    }

    @PutMapping("/fuel/{id}")
    public FuelEntry updateFuel(@PathVariable Long id, @RequestBody FuelEntries.Input in) {
        FuelEntry e = fuel.findById(id).orElseThrow(() -> ApiErrors.notFound("Fill-up"));
        return fuelEntries.save(e, withVehicle(in, in.vehicleId() != null ? in.vehicleId() : e.vehicleId));
    }

    /** Marks a "the Hisaab payment changed" note as seen. */
    @PostMapping("/fuel/{id}/resolve")
    public FuelEntry resolveFuel(@PathVariable Long id) {
        FuelEntry e = fuel.findById(id).orElseThrow(() -> ApiErrors.notFound("Fill-up"));
        e.sourceIssue = null;
        return fuel.save(e);
    }

    @DeleteMapping("/fuel/{id}")
    public void deleteFuel(@PathVariable Long id) {
        fuel.deleteById(id);
    }

    private static FuelEntries.Input withVehicle(FuelEntries.Input in, Long vehicleId) {
        return new FuelEntries.Input(vehicleId, in.filledAt(), in.odometer(), in.volume(), in.pricePerUnit(), in.totalCost(), in.fullTank(),
                in.missedPrevious(), in.stationName(), in.stationBrand(), in.latitude(), in.longitude(), in.region(), in.district(), in.notes());
    }

    // ---- service records --------------------------------------------------------------------------------------

    public record ServiceRow(ServiceRecord record, List<Long> reminderIds) {}

    @GetMapping("/vehicles/{id}/services")
    public List<ServiceRow> services(@PathVariable Long id) {
        vehicle(id);
        return services.findByVehicleIdOrderByServicedOnDescIdDesc(id).stream().map(s -> new ServiceRow(s, services.reminderIds(s.id))).toList();
    }

    /** {@code completes}: the reminders this service took care of; they restart from its date and odometer. */
    public record ServiceInput(LocalDate servicedOn, BigDecimal odometer, String title, String workshop, BigDecimal cost, String notes,
                               List<Long> completes) {}

    @PostMapping("/vehicles/{id}/services")
    @Transactional
    public ServiceRow addService(@PathVariable Long id, @RequestBody ServiceInput in) {
        vehicle(id);
        ServiceRecord s = new ServiceRecord();
        s.vehicleId = id;
        return saveService(s, in);
    }

    @PutMapping("/services/{id}")
    @Transactional
    public ServiceRow updateService(@PathVariable Long id, @RequestBody ServiceInput in) {
        return saveService(services.findById(id).orElseThrow(() -> ApiErrors.notFound("Service record")), in);
    }

    private ServiceRow saveService(ServiceRecord s, ServiceInput in) {
        if (in.title() == null || in.title().isBlank()) throw new IllegalArgumentException("What was done?");
        s.servicedOn = in.servicedOn() != null ? in.servicedOn() : LocalDate.now();
        s.odometer = in.odometer();
        s.title = in.title().trim();
        s.workshop = VehicleController.trim(in.workshop());
        s.cost = in.cost() != null ? in.cost() : BigDecimal.ZERO;
        s.notes = VehicleController.trim(in.notes());
        ServiceRecord saved = services.save(s);
        services.clearReminders(saved.id);
        for (Long rid : in.completes() == null ? List.<Long>of() : in.completes()) {
            Reminder r = reminders.findById(rid).orElse(null);
            if (r == null || !r.vehicleId.equals(saved.vehicleId)) continue;
            services.linkReminder(saved.id, rid);
            // Only move a reminder forward, never back (editing an old service shouldn't undo a newer one).
            if (r.lastDoneOn == null || !saved.servicedOn.isBefore(r.lastDoneOn)) {
                r.lastDoneOn = saved.servicedOn;
                if (saved.odometer != null) r.lastDoneOdometer = saved.odometer;
                r.lastNotifiedState = null;
                // one-off reminders are finished once done
                if (r.intervalKm == null && r.intervalMonths == null) r.active = false;
                reminders.save(r);
            }
        }
        return new ServiceRow(saved, services.reminderIds(saved.id));
    }

    @DeleteMapping("/services/{id}")
    public void deleteService(@PathVariable Long id) {
        services.deleteById(id);
    }

    // ---- expenses ---------------------------------------------------------------------------------------------

    @GetMapping("/vehicles/{id}/expenses")
    public List<Expense> expenses(@PathVariable Long id) {
        vehicle(id);
        return expenses.findByVehicleIdOrderBySpentOnDescIdDesc(id);
    }

    public record ExpenseInput(LocalDate spentOn, Expense.Category category, String title, BigDecimal amount, BigDecimal odometer,
                               String vendor, String notes) {}

    @PostMapping("/vehicles/{id}/expenses")
    public Expense addExpense(@PathVariable Long id, @RequestBody ExpenseInput in) {
        vehicle(id);
        Expense e = new Expense();
        e.vehicleId = id;
        return saveExpense(e, in);
    }

    @PutMapping("/expenses/{id}")
    public Expense updateExpense(@PathVariable Long id, @RequestBody ExpenseInput in) {
        return saveExpense(expenses.findById(id).orElseThrow(() -> ApiErrors.notFound("Expense")), in);
    }

    private Expense saveExpense(Expense e, ExpenseInput in) {
        if (in.title() == null || in.title().isBlank()) throw new IllegalArgumentException("What was it for?");
        if (in.amount() == null || in.amount().signum() < 0) throw new IllegalArgumentException("How much was it?");
        e.spentOn = in.spentOn() != null ? in.spentOn() : LocalDate.now();
        e.category = in.category() != null ? in.category() : Expense.Category.OTHER;
        e.title = in.title().trim();
        e.amount = in.amount();
        e.odometer = in.odometer();
        e.vendor = VehicleController.trim(in.vendor());
        e.notes = VehicleController.trim(in.notes());
        return expenses.save(e);
    }

    @DeleteMapping("/expenses/{id}")
    public void deleteExpense(@PathVariable Long id) {
        expenses.deleteById(id);
    }

    // ---- odometer ---------------------------------------------------------------------------------------------

    @GetMapping("/vehicles/{id}/odometer")
    public List<VehicleStats.Reading> odometerHistory(@PathVariable Long id) {
        Vehicle v = vehicle(id);
        return stats.readings(v, fuel.findByVehicleIdOrderByFilledAtAscIdAsc(id), services.findByVehicleIdOrderByServicedOnDescIdDesc(id),
                expenses.findByVehicleIdOrderBySpentOnDescIdDesc(id)).reversed();
    }

    public record ReadingInput(Instant readAt, BigDecimal odometer, String notes) {}

    @PostMapping("/vehicles/{id}/odometer")
    public OdometerReading addReading(@PathVariable Long id, @RequestBody ReadingInput in) {
        vehicle(id);
        if (in.odometer() == null || in.odometer().signum() < 0) throw new IllegalArgumentException("Odometer reading is required");
        OdometerReading r = new OdometerReading();
        r.vehicleId = id;
        r.readAt = in.readAt() != null ? in.readAt() : Instant.now();
        r.odometer = in.odometer();
        r.notes = VehicleController.trim(in.notes());
        return readings.save(r);
    }

    @GetMapping("/vehicles/{id}/odometer/manual")
    public List<OdometerReading> manualReadings(@PathVariable Long id) {
        return readings.findByVehicleIdOrderByReadAtDesc(id);
    }

    @DeleteMapping("/odometer/{id}")
    public void deleteReading(@PathVariable Long id) {
        readings.deleteById(id);
    }

    private Vehicle vehicle(Long id) {
        return vehicles.findById(id).orElseThrow(() -> ApiErrors.notFound("Vehicle"));
    }
}
