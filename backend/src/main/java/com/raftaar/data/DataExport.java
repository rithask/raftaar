package com.raftaar.data;

import com.raftaar.expense.Expense;
import com.raftaar.expense.ExpenseRepo;
import com.raftaar.fuel.FuelEntry;
import com.raftaar.fuel.FuelEntryRepo;
import com.raftaar.papers.Document;
import com.raftaar.papers.DocumentRepo;
import com.raftaar.upkeep.Reminder;
import com.raftaar.upkeep.ReminderRepo;
import com.raftaar.upkeep.ServiceRecord;
import com.raftaar.upkeep.ServiceRecordRepo;
import com.raftaar.vehicle.OdometerReading;
import com.raftaar.vehicle.OdometerReadingRepo;
import com.raftaar.vehicle.Vehicle;
import com.raftaar.vehicle.VehicleRepo;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Your records as CSV files, one per kind ({@link Table}), for a spreadsheet or another app, or to bring into another
 * Raftaar (see DataImport). Each row names its vehicle; a vehicle can be exported on its own.
 */
@Service
@Transactional(readOnly = true)
public class DataExport {

    /** The kinds of record, each a file with these columns (also what DataImport reads back). */
    public enum Table {
        VEHICLES("vehicles", "name", "kind", "fuel_type", "make", "model", "year", "registration", "color", "tank_capacity",
                "purchase_date", "purchase_odometer", "purchase_price", "archived", "sold_on", "sale_price", "sale_odometer", "notes"),
        FUEL("fuel", "vehicle", "filled_at", "odometer", "volume", "unit", "price_per_unit", "total_cost", "full_tank", "missed_previous",
                "station", "brand", "district", "region", "latitude", "longitude", "source", "notes"),
        SERVICES("services", "vehicle", "serviced_on", "odometer", "title", "workshop", "cost", "notes"),
        EXPENSES("expenses", "vehicle", "spent_on", "category", "title", "amount", "odometer", "vendor", "notes"),
        ODOMETER("odometer", "vehicle", "read_at", "odometer", "notes"),
        PAPERS("papers", "vehicle", "type", "title", "number", "provider", "issued_on", "expires_on", "cost", "notes"),
        REMINDERS("reminders", "vehicle", "title", "interval_km", "interval_months", "last_done_on", "last_done_odometer",
                "due_on", "due_odometer", "active", "notes");

        public final String file;
        public final List<String> columns;

        Table(String file, String... columns) {
            this.file = file;
            this.columns = List.of(columns);
        }

        public static Table named(String file) {
            return Arrays.stream(values()).filter(table -> table.file.equals(file)).findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("No such export: " + file));
        }
    }

    private final VehicleRepo vehicles;
    private final FuelEntryRepo fills;
    private final ServiceRecordRepo services;
    private final ExpenseRepo expenses;
    private final OdometerReadingRepo readings;
    private final DocumentRepo papers;
    private final ReminderRepo reminders;

    public DataExport(VehicleRepo vehicles, FuelEntryRepo fills, ServiceRecordRepo services, ExpenseRepo expenses,
                      OdometerReadingRepo readings, DocumentRepo papers, ReminderRepo reminders) {
        this.vehicles = vehicles;
        this.fills = fills;
        this.services = services;
        this.expenses = expenses;
        this.readings = readings;
        this.papers = papers;
        this.reminders = reminders;
    }

    /** One table as CSV, oldest first; {@code vehicleId} null for every vehicle (and, for papers, your own too). */
    public void write(Table table, Long vehicleId, OutputStream out) throws IOException {
        Writer writer = new OutputStreamWriter(out, StandardCharsets.UTF_8);
        writeTable(table, vehicleId, writer);
        writer.flush();
    }

    /** Every table, each its own CSV file in one zip. */
    public void writeAll(Long vehicleId, OutputStream out) throws IOException {
        var zip = new ZipOutputStream(out);
        Writer writer = new OutputStreamWriter(zip, StandardCharsets.UTF_8);
        for (Table table : Table.values()) {
            zip.putNextEntry(new ZipEntry(table.file + ".csv"));
            writeTable(table, vehicleId, writer);
            writer.flush();
            zip.closeEntry();
        }
        zip.finish();
    }

    /** The vehicle's name, for a file name; null for every vehicle. */
    public String vehicleName(Long vehicleId) {
        return vehicleId == null ? null : vehicles.require(vehicleId, "Vehicle").name;
    }

    private void writeTable(Table table, Long vehicleId, Writer out) throws IOException {
        ZoneId zone = ZoneId.systemDefault();
        Map<Long, Vehicle> byId = vehicles.findAll().stream().collect(Collectors.toMap(vehicle -> vehicle.id, Function.identity()));
        out.write(Csv.BYTE_ORDER_MARK);
        Csv.writeRow(out, table.columns, zone);
        for (List<?> row : rows(table, vehicleId, byId).toList()) Csv.writeRow(out, row, zone);
    }

    private Stream<List<?>> rows(Table table, Long vehicleId, Map<Long, Vehicle> byId) {
        Function<Long, String> name = id -> id == null || !byId.containsKey(id) ? null : byId.get(id).name;
        Function<Long, String> unit = id -> id == null || !byId.containsKey(id) || byId.get(id).fuelType == null ? null : byId.get(id).fuelType.unit;
        return switch (table) {
            case VEHICLES -> vehicles.findAllByOrderByArchivedAscSortOrderAscIdAsc().stream().filter(v -> vehicleId == null || v.id.equals(vehicleId))
                    .map(DataExport::vehicleRow);
            case FUEL -> mine(fills.findAll(Sort.by("filledAt", "id")), vehicleId, fill -> fill.vehicleId)
                    .map(fill -> fuelRow(fill, name.apply(fill.vehicleId), unit.apply(fill.vehicleId)));
            case SERVICES -> mine(services.findAll(Sort.by("servicedOn", "id")), vehicleId, service -> service.vehicleId)
                    .map(service -> Arrays.asList(name.apply(service.vehicleId), service.servicedOn, service.odometer, service.title,
                            service.workshop, service.cost, service.notes));
            case EXPENSES -> mine(expenses.findAll(Sort.by("spentOn", "id")), vehicleId, expense -> expense.vehicleId)
                    .map(expense -> Arrays.asList(name.apply(expense.vehicleId), expense.spentOn, expense.category, expense.title, expense.amount,
                            expense.odometer, expense.vendor, expense.notes));
            case ODOMETER -> mine(readings.findAll(Sort.by("readAt", "id")), vehicleId, reading -> reading.vehicleId)
                    .map(reading -> Arrays.asList(name.apply(reading.vehicleId), reading.readAt, reading.odometer, reading.notes));
            // your own papers (a licence) belong to no vehicle: in the full export, not in one vehicle's
            case PAPERS -> papers.findAll(Sort.by("expiresOn", "id")).stream()
                    .filter(paper -> vehicleId == null || vehicleId.equals(paper.vehicleId))
                    .map(paper -> paperRow(paper, name.apply(paper.vehicleId)));
            case REMINDERS -> mine(reminders.findAll(Sort.by("id")), vehicleId, reminder -> reminder.vehicleId)
                    .map(reminder -> reminderRow(reminder, name.apply(reminder.vehicleId)));
        };
    }

    private static <T> Stream<T> mine(List<T> all, Long vehicleId, Function<T, Long> vehicleOf) {
        return all.stream().filter(record -> vehicleId == null || Objects.equals(vehicleOf.apply(record), vehicleId));
    }

    private static List<?> vehicleRow(Vehicle v) {
        return Arrays.asList(v.name, v.kind, v.fuelType, v.make, v.model, v.year, v.registration, v.color, v.tankCapacity,
                v.purchaseDate, v.purchaseOdometer, v.purchasePrice, v.archived, v.soldOn, v.salePrice, v.saleOdometer, v.notes);
    }

    private static List<?> fuelRow(FuelEntry fill, String vehicle, String unit) {
        return Arrays.asList(vehicle, fill.filledAt, fill.odometer, fill.volume, unit, fill.pricePerUnit, fill.totalCost, fill.fullTank,
                fill.missedPrevious, fill.stationName, fill.stationBrand, fill.district, fill.region, fill.latitude, fill.longitude, fill.source, fill.notes);
    }

    private static List<?> paperRow(Document paper, String vehicle) {
        return Arrays.asList(vehicle, paper.type, paper.title, paper.number, paper.provider, paper.issuedOn, paper.expiresOn, paper.cost, paper.notes);
    }

    private static List<?> reminderRow(Reminder reminder, String vehicle) {
        return Arrays.asList(vehicle, reminder.title, reminder.intervalKm, reminder.intervalMonths, reminder.lastDoneOn, reminder.lastDoneOdometer,
                reminder.dueOn, reminder.dueOdometer, reminder.active, reminder.notes);
    }
}
