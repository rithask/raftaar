package com.raftaar.data;

import com.raftaar.expense.Expense;
import com.raftaar.fuel.FuelEntry;
import com.raftaar.papers.Document;
import com.raftaar.upkeep.Reminder;
import com.raftaar.upkeep.ServiceRecord;
import com.raftaar.vehicle.OdometerReading;
import com.raftaar.vehicle.Vehicles;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Stream;

/**
 * What a file holds, read but not saved: records not yet given a vehicle id, each with the name the file calls its
 * vehicle instead, and the vehicles the file describes by those names. DataImport matches the names to vehicles
 * (yours, or new ones) and saves the lot.
 */
final class Imported {
    /** A record, with the name of its vehicle in the file (null for a paper of your own, a licence). */
    record Named<T>(String vehicle, T record) {}

    final ImportSource source;
    /** The vehicles the file describes, by name, in the order they come (some files only name them on records). */
    final Map<String, Vehicles.Input> vehicles = new LinkedHashMap<>();
    final List<Named<FuelEntry>> fills = new ArrayList<>();
    final List<Named<ServiceRecord>> services = new ArrayList<>();
    final List<Named<Expense>> expenses = new ArrayList<>();
    final List<Named<OdometerReading>> readings = new ArrayList<>();
    final List<Named<Document>> papers = new ArrayList<>();
    final List<Named<Reminder>> reminders = new ArrayList<>();
    /** Rows that couldn't be read, and why ("Row 14 of the log: no odometer reading"), for the preview. */
    final List<String> skipped = new ArrayList<>();

    Imported(ImportSource source) {
        this.source = source;
    }

    /** Every vehicle name the file uses: those it describes, then any only named on records. */
    List<String> vehicleNames() {
        var names = new ArrayList<>(vehicles.keySet());
        Stream.of(fills, services, expenses, readings, papers, reminders).flatMap(List::stream).map(Named::vehicle)
                .filter(Objects::nonNull).distinct().filter(name -> !names.contains(name)).forEach(names::add);
        return names;
    }

    /** How many records there are for one vehicle name. */
    long recordsFor(String name) {
        return Stream.of(fills, services, expenses, readings, papers, reminders).flatMap(List::stream).filter(named -> name.equals(named.vehicle())).count();
    }

    boolean isEmpty() {
        return vehicles.isEmpty() && Stream.of(fills, services, expenses, readings, papers, reminders).allMatch(List::isEmpty);
    }

    /** The earliest and latest days in it (fill-ups, services, expenses, readings), for "Jan 2024 to Nov 2026". */
    List<Instant> span() {
        var moments = new ArrayList<Instant>();
        fills.forEach(fill -> moments.add(fill.record().filledAt));
        readings.forEach(reading -> moments.add(reading.record().readAt));
        services.forEach(service -> moments.add(service.record().servicedOn.atStartOfDay(java.time.ZoneId.systemDefault()).toInstant()));
        expenses.forEach(expense -> moments.add(expense.record().spentOn.atStartOfDay(java.time.ZoneId.systemDefault()).toInstant()));
        if (moments.isEmpty()) return List.of();
        return List.of(moments.stream().min(Instant::compareTo).orElseThrow(), moments.stream().max(Instant::compareTo).orElseThrow());
    }
}
