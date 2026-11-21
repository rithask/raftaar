package com.raftaar.upkeep;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.raftaar.common.Text;
import com.raftaar.vehicle.VehicleRepo;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** A vehicle's service history. Logging a service also restarts the reminders it took care of. */
@Service
public class ServiceRecords {
    private static final Logger log = LoggerFactory.getLogger(ServiceRecords.class);
    private final ServiceRecordRepo services;
    private final ReminderRepo reminders;
    private final VehicleRepo vehicles;

    public ServiceRecords(ServiceRecordRepo services, ReminderRepo reminders, VehicleRepo vehicles) {
        this.services = services;
        this.reminders = reminders;
        this.vehicles = vehicles;
    }

    public record ServiceRow(ServiceRecord record, List<Long> reminderIds) {}

    /** {@code completes}: the reminders this service took care of; they restart from its date and odometer. */
    public record Input(LocalDate servicedOn, BigDecimal odometer, String title, String workshop, BigDecimal cost, String notes,
                        List<Long> completes) {}

    @Transactional(readOnly = true)
    public List<ServiceRow> list(Long vehicleId) {
        vehicles.require(vehicleId, "Vehicle");
        return rows(services.findByVehicleIdOrderByServicedOnDescIdDesc(vehicleId));
    }

    /** The rows for services already loaded, each with the reminders it completed (one query for all of them). */
    public List<ServiceRow> rows(List<ServiceRecord> history) {
        if (history.isEmpty()) return List.of();
        // which reminders each service completed: one query for all of them
        Map<Long, List<Long>> completed = new HashMap<>();
        for (Object[] link : services.reminderLinks(history.stream().map(service -> service.id).toList())) {
            completed.computeIfAbsent(((Number) link[0]).longValue(), unused -> new ArrayList<>()).add(((Number) link[1]).longValue());
        }
        return history.stream().map(service -> new ServiceRow(service, completed.getOrDefault(service.id, List.of()))).toList();
    }

    @Transactional
    public ServiceRow add(Long vehicleId, Input input) {
        vehicles.require(vehicleId, "Vehicle");
        ServiceRecord service = new ServiceRecord();
        service.vehicleId = vehicleId;
        ServiceRow saved = save(service, input);
        log.debug("Service {} added to vehicle {}", saved.record().id, vehicleId);
        return saved;
    }

    @Transactional
    public ServiceRow update(Long id, Input input) {
        ServiceRow saved = save(services.require(id, "Service record"), input);
        log.debug("Service {} changed", id);
        return saved;
    }

    public void delete(Long id) {
        services.deleteById(id);
        log.info("Service {} deleted", id);
    }

    private ServiceRow save(ServiceRecord service, Input input) {
        if (input.title() == null || input.title().isBlank()) throw new IllegalArgumentException("What was done?");
        service.servicedOn = input.servicedOn() != null ? input.servicedOn() : LocalDate.now();
        service.odometer = input.odometer();
        service.title = input.title().trim();
        service.workshop = Text.trimToNull(input.workshop());
        service.cost = input.cost() != null ? input.cost() : BigDecimal.ZERO;
        service.notes = Text.trimToNull(input.notes());
        ServiceRecord saved = services.save(service);
        services.clearReminders(saved.id);
        for (Long reminderId : input.completes() == null ? List.<Long>of() : input.completes()) {
            reminders.findById(reminderId).filter(reminder -> reminder.vehicleId.equals(saved.vehicleId)).ifPresent(reminder -> {
                services.linkReminder(saved.id, reminderId);
                completeReminder(reminder, saved);
            });
        }
        return new ServiceRow(saved, services.reminderIds(saved.id));
    }

    /** Restarts a reminder from this service, but only forwards: editing an old service never undoes a newer one. */
    private void completeReminder(Reminder reminder, ServiceRecord service) {
        if (reminder.lastDoneOn != null && service.servicedOn.isBefore(reminder.lastDoneOn)) {
            log.debug("Reminder {} left as it is: service {} is older than its last done ({})", reminder.id, service.id, reminder.lastDoneOn);
            return;
        }
        reminder.lastDoneOn = service.servicedOn;
        if (service.odometer != null) reminder.lastDoneOdometer = service.odometer;
        reminder.lastNotifiedState = null;
        // one-off reminders are finished once done
        if (reminder.intervalKm == null && reminder.intervalMonths == null) reminder.active = false;
        reminders.save(reminder);
        log.debug("Reminder {} restarted from service {}{}", reminder.id, service.id, reminder.active ? "" : " (one-off: now finished)");
    }
}
