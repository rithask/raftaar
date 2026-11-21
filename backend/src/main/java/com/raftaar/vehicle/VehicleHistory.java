package com.raftaar.vehicle;

import com.raftaar.expense.Expense;
import com.raftaar.fuel.FuelEntry;
import com.raftaar.inbox.Trip;
import com.raftaar.papers.Document;
import com.raftaar.upkeep.Reminder;
import com.raftaar.upkeep.ServiceRecord;

import java.util.List;

/**
 * Everything recorded for one vehicle, loaded up front so its stats are worked out without further queries.
 * {@code assignedTrips}: its trips that may still count (ended after its last odometer reading or in the last 60 days).
 */
public record VehicleHistory(Vehicle vehicle, List<FuelEntry> fills, List<ServiceRecord> services, List<Expense> expenses,
                             List<OdometerReading> enteredReadings, List<Reminder> reminders, List<Document> papers,
                             List<Trip> assignedTrips) {}
