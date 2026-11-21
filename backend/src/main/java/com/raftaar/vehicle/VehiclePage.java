package com.raftaar.vehicle;

import com.raftaar.expense.Expense;
import com.raftaar.fuel.FuelEntries;
import com.raftaar.inbox.Trip;
import com.raftaar.inbox.Trips;
import com.raftaar.upkeep.Reminders;
import com.raftaar.upkeep.ServiceRecords;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Everything the vehicle page shows, in one response and from one load of the vehicle's records: its summary,
 * fill-ups, reminders, services, expenses and trips. The same as asking each endpoint separately.
 */
@Service
@Transactional(readOnly = true)
public class VehiclePage {
    private final Vehicles vehicles;
    private final VehicleStats stats;
    private final FuelEntries fuelEntries;
    private final ServiceRecords serviceRecords;
    private final Reminders reminders;
    private final Trips trips;

    public VehiclePage(Vehicles vehicles, VehicleStats stats, FuelEntries fuelEntries, ServiceRecords serviceRecords, Reminders reminders,
                       Trips trips) {
        this.vehicles = vehicles;
        this.stats = stats;
        this.fuelEntries = fuelEntries;
        this.serviceRecords = serviceRecords;
        this.reminders = reminders;
        this.trips = trips;
    }

    public record Page(VehicleStats.Summary summary, List<FuelEntries.FuelRow> fuel, List<VehicleStats.ReminderView> reminders,
                       List<ServiceRecords.ServiceRow> services, List<Expense> expenses, List<Trip> trips) {}

    public Page load(Long vehicleId) {
        Vehicle vehicle = vehicles.get(vehicleId);
        VehicleHistory history = stats.history(vehicle);
        VehicleStats.Summary summary = stats.summary(history);
        return new Page(summary, fuelEntries.rows(vehicle, history.fills()), reminders.views(history.reminders(), summary.odometer()),
                serviceRecords.rows(history.services()), history.expenses(), trips.forVehicle(vehicleId));
    }
}
