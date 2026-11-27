package com.raftaar.data;

import com.raftaar.data.DataExport.Table;
import com.raftaar.data.Imported.Named;
import com.raftaar.expense.Expense;
import com.raftaar.fuel.FuelEntry;
import com.raftaar.fuel.FuelMath;
import com.raftaar.fuel.FuelType;
import com.raftaar.papers.Document;
import com.raftaar.upkeep.Reminder;
import com.raftaar.upkeep.ServiceRecord;
import com.raftaar.vehicle.OdometerReading;
import com.raftaar.vehicle.Vehicle;
import com.raftaar.vehicle.Vehicles;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.zip.ZipInputStream;

/**
 * Reading a file into {@link Imported}, whichever app it came from:
 *
 * - Raftaar's own export (DataExport): the zip, or any one of its CSV files, by its columns.
 * - Fuelio's backup CSV: sections "## Vehicle", "## Log" (fill-ups), "## CostCategories" and "## Costs" (services
 *   and other costs, sorted by their category's name). Fuelio's "Price" on a fill-up is what was paid in all.
 * - Other apps (Drivvo and the like): CSV sections of fill-ups, services or expenses, told apart by their heading or
 *   their columns, with columns found by the names apps commonly use, in English and Portuguese. Best effort: a row
 *   that can't be read is skipped and said so.
 */
final class ImportFormats {
    private ImportFormats() {}

    /** Reads {@code bytes} (a CSV, or a zip of Raftaar's CSVs); {@code fileName} tells a zip and names an unnamed vehicle. */
    static Imported read(String fileName, byte[] bytes) throws IOException {
        String name = fileName == null ? "import" : fileName;
        if (name.toLowerCase(Locale.ROOT).endsWith(".zip")) return raftaarZip(bytes);
        String text = new String(bytes, StandardCharsets.UTF_8);
        List<List<String>> rows = Csv.parse(text);
        if (rows.isEmpty()) throw new IllegalArgumentException("The file is empty");
        if (isFuelio(rows)) return fuelio(rows);
        Table table = raftaarTable(rows.getFirst());
        if (table != null) {
            var imported = new Imported(ImportSource.RAFTAAR);
            raftaar(table, rows, imported);
            return imported;
        }
        return other(rows, vehicleNameFrom(name));
    }

    // ---- Raftaar ---------------------------------------------------------------------------------------------

    private static Imported raftaarZip(byte[] bytes) throws IOException {
        var imported = new Imported(ImportSource.RAFTAAR);
        var files = new HashMap<String, String>();
        try (var zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            for (var entry = zip.getNextEntry(); entry != null; entry = zip.getNextEntry()) {
                if (!entry.isDirectory()) files.put(entry.getName().replaceAll(".*/", ""), new String(zip.readAllBytes(), StandardCharsets.UTF_8));
            }
        }
        // vehicles first, so records can be matched to them
        for (Table table : Table.values()) {
            String text = files.get(table.file + ".csv");
            if (text != null) raftaar(table, Csv.parse(text), imported);
        }
        if (imported.isEmpty() && imported.skipped.isEmpty()) throw new IllegalArgumentException("That zip has none of Raftaar's export files in it");
        return imported;
    }

    /** The Raftaar table a header is, if it's one of them. */
    private static Table raftaarTable(List<String> header) {
        Set<String> names = Set.copyOf(header.stream().map(String::strip).map(column -> column.replace("﻿", "")).toList());
        for (Table table : Table.values()) if (names.containsAll(table.columns)) return table;
        return null;
    }

    private static void raftaar(Table table, List<List<String>> rows, Imported into) {
        var cells = Cells.table(rows);
        for (int i = 0; i < cells.size(); i++) {
            Cells row = cells.get(i);
            String where = table.file + ".csv row " + (i + 2);
            String vehicle = row.text("vehicle");
            switch (table) {
                case VEHICLES -> {
                    String name = row.text("name");
                    if (name == null) { into.skipped.add(where + ": no name"); continue; }
                    into.vehicles.put(name, new Vehicles.Input(name, constant(Vehicle.Kind.class, row.text("kind"), null),
                            constant(FuelType.class, row.text("fuel_type"), null), row.text("make"), row.text("model"),
                            row.number("year") == null ? null : row.number("year").intValue(), row.text("registration"), row.text("color"),
                            row.number("tank_capacity"), row.date("purchase_date"), row.number("purchase_odometer"), row.number("purchase_price"),
                            false, row.yes(false, "archived"), row.text("notes"), row.date("sold_on"), row.number("sale_price"), row.number("sale_odometer")));
                }
                case FUEL -> addFill(into, vehicle, row.instant("filled_at"), row.number("odometer"), row.number("volume"),
                        row.number("price_per_unit"), row.number("total_cost"), row.yes(true, "full_tank"), row.yes(false, "missed_previous"),
                        row.text("station"), row.text("notes"), where, fill -> {
                            fill.stationBrand = row.text("brand");
                            fill.district = row.text("district");
                            fill.region = row.text("region");
                            BigDecimal lat = row.number("latitude"), lon = row.number("longitude");
                            fill.latitude = lat == null ? null : lat.doubleValue();
                            fill.longitude = lon == null ? null : lon.doubleValue();
                        });
                case SERVICES -> addService(into, vehicle, row.date("serviced_on"), row.number("odometer"), row.text("title"),
                        row.text("workshop"), row.number("cost"), row.text("notes"), where);
                case EXPENSES -> addExpense(into, vehicle, row.date("spent_on"), constant(Expense.Category.class, row.text("category"), Expense.Category.OTHER),
                        row.text("title"), row.number("amount"), row.number("odometer"), row.text("vendor"), row.text("notes"), where);
                case ODOMETER -> {
                    var reading = new OdometerReading();
                    reading.readAt = row.instant("read_at");
                    reading.odometer = row.number("odometer");
                    reading.notes = row.text("notes");
                    if (reading.readAt == null || reading.odometer == null) { into.skipped.add(where + ": no date or reading"); continue; }
                    into.readings.add(new Named<>(vehicle, reading));
                }
                case PAPERS -> {
                    var paper = new Document();
                    paper.type = constant(Document.Type.class, row.text("type"), Document.Type.OTHER);
                    paper.title = row.text("title");
                    paper.number = row.text("number");
                    paper.provider = row.text("provider");
                    paper.issuedOn = row.date("issued_on");
                    paper.expiresOn = row.date("expires_on");
                    paper.cost = row.number("cost");
                    paper.notes = row.text("notes");
                    if (paper.title == null) { into.skipped.add(where + ": no title"); continue; }
                    into.papers.add(new Named<>(vehicle, paper));
                }
                case REMINDERS -> {
                    var reminder = new Reminder();
                    reminder.title = row.text("title");
                    reminder.intervalKm = row.number("interval_km");
                    reminder.intervalMonths = row.number("interval_months") == null ? null : row.number("interval_months").intValue();
                    reminder.lastDoneOn = row.date("last_done_on");
                    reminder.lastDoneOdometer = row.number("last_done_odometer");
                    reminder.dueOn = row.date("due_on");
                    reminder.dueOdometer = row.number("due_odometer");
                    reminder.active = row.yes(true, "active");
                    reminder.notes = row.text("notes");
                    if (reminder.title == null || vehicle == null) { into.skipped.add(where + ": no title or vehicle"); continue; }
                    into.reminders.add(new Named<>(vehicle, reminder));
                }
            }
        }
    }

    // ---- Fuelio ----------------------------------------------------------------------------------------------

    private static boolean isFuelio(List<List<String>> rows) {
        return rows.stream().anyMatch(row -> row.size() >= 1 && row.getFirst().strip().equalsIgnoreCase("## Log"));
    }

    private static final BigDecimal KM_PER_MILE = new BigDecimal("1.609344");
    private static final BigDecimal LITRES_PER_US_GALLON = new BigDecimal("3.785411784");
    private static final BigDecimal LITRES_PER_UK_GALLON = new BigDecimal("4.54609");

    private static Imported fuelio(List<List<String>> rows) {
        var imported = new Imported(ImportSource.FUELIO);
        Map<String, List<List<String>>> sections = sections(rows, row -> row.size() >= 1 && row.getFirst().strip().startsWith("## ")
                ? row.getFirst().strip().substring(3).strip().toLowerCase(Locale.ROOT) : null);

        String vehicle = "Fuelio vehicle";
        BigDecimal distance = BigDecimal.ONE, volume = BigDecimal.ONE;
        var vehicleRows = Cells.table(sections.getOrDefault("vehicle", List.of()));
        if (!vehicleRows.isEmpty()) {
            Cells v = vehicleRows.getFirst();
            if (v.text("name") != null) vehicle = v.text("name");
            if ("1".equals(v.text("distunit"))) distance = KM_PER_MILE;
            String fuelUnit = v.text("fuelunit");
            if ("1".equals(fuelUnit)) volume = LITRES_PER_US_GALLON;
            if ("2".equals(fuelUnit)) volume = LITRES_PER_UK_GALLON;
            Integer year = Cells.parseNumber(v.text("year")) == null ? null : Cells.parseNumber(v.text("year")).intValue();
            imported.vehicles.put(vehicle, new Vehicles.Input(vehicle, null, null, v.text("make"), v.text("model"), year,
                    v.text("plate"), null, Cells.parseNumber(v.text("tank1capacity")), null, null, null, false, false, v.text("description"),
                    null, null, null));
        }

        var log = Cells.table(sections.getOrDefault("log", List.of()));
        for (int i = 0; i < log.size(); i++) {
            Cells row = log.get(i);
            BigDecimal odo = times(row.number("odo"), distance, 1);
            BigDecimal litres = times(row.number("fuel"), volume, 3);
            BigDecimal total = row.number("price");
            addFill(imported, vehicle, row.instant("data", "date"), odo, litres, null, total, row.yes(true, "full"), row.yes(false, "missed"),
                    null, row.text("notes"), "Log row " + (i + 2), fill -> {
                        fill.district = row.text("city");
                        BigDecimal lat = row.number("latitude"), lon = row.number("longitude");
                        fill.latitude = lat == null || lat.signum() == 0 ? null : lat.doubleValue();
                        fill.longitude = lon == null || lon.signum() == 0 ? null : lon.doubleValue();
                    });
        }

        Map<String, String> categories = new HashMap<>();
        for (Cells row : Cells.table(sections.getOrDefault("costcategories", List.of()))) {
            if (row.text("costtypeid") != null) categories.put(row.text("costtypeid"), row.text("name"));
        }
        var costs = Cells.table(sections.getOrDefault("costs", List.of()));
        for (int i = 0; i < costs.size(); i++) {
            Cells row = costs.get(i);
            if (row.yes(false, "isincome")) continue;
            String category = categories.getOrDefault(row.text("costtypeid"), "");
            String title = row.text("costtitle") != null ? row.text("costtitle") : category;
            String where = "Costs row " + (i + 2);
            if (isService(category) || isService(title == null ? "" : title)) {
                addService(imported, vehicle, row.date("date"), times(row.number("odo"), distance, 1), title, null, row.number("cost"), row.text("notes"), where);
            } else {
                addExpense(imported, vehicle, row.date("date"), expenseCategory(category + " " + (title == null ? "" : title)), title,
                        row.number("cost"), times(row.number("odo"), distance, 1), null, row.text("notes"), where);
            }
        }
        return imported;
    }

    // ---- other apps (Drivvo and the like) --------------------------------------------------------------------

    private static final String[] DATE = {"date", "data", "date/time", "data/hora", "datetime", "day", "date time"};
    private static final String[] ODO = {"odometer", "odometro", "odo", "km", "mileage", "quilometragem", "odometer reading"};
    private static final String[] VOLUME = {"liters", "litres", "liters filled", "litres filled", "volume", "quantity", "litros", "fuel amount", "qty"};
    private static final String[] UNIT_PRICE = {"price/l", "price per liter", "price per litre", "unit price", "price/unit", "preco/l",
            "preco por litro", "preco do litro", "rate", "price"};
    private static final String[] TOTAL = {"total cost", "total", "valor total", "total price", "cost", "amount", "value", "valor", "custo"};
    private static final String[] FULL = {"full tank", "full tank?", "full", "tanque cheio", "encheu o tanque"};
    private static final String[] STATION = {"gas station", "fuel station", "station", "posto", "petrol pump", "pump"};
    private static final String[] NOTES = {"notes", "note", "observation", "observations", "observacao", "observacoes", "comments", "remarks"};
    private static final String[] TITLE = {"type of service", "service", "tipo de servico", "servico", "title", "description", "descricao",
            "type of expense", "tipo de despesa", "expense", "despesa", "item", "name"};
    private static final String[] VENDOR = {"workshop", "oficina", "place", "local", "vendor", "shop"};
    private static final String[] VEHICLE = {"vehicle", "veiculo", "car", "bike", "vehicle name"};

    private enum Kind { FUEL, SERVICE, EXPENSE }

    private static Imported other(List<List<String>> rows, String defaultVehicle) {
        var imported = new Imported(ImportSource.OTHER);
        // a section starts at a line with one field beginning with # ("#Refuelling"), or is the whole file
        Map<String, List<List<String>>> sections = sections(rows, row -> row.size() == 1 && row.getFirst().strip().startsWith("#")
                ? row.getFirst().strip().replaceFirst("^#+", "").strip().toLowerCase(Locale.ROOT) : null);
        if (sections.isEmpty()) sections = Map.of("", rows);
        for (var section : sections.entrySet()) {
            List<List<String>> table = section.getValue();
            if (table.size() < 2) continue;
            Kind kind = kindOf(section.getKey(), Cells.names(table.getFirst()));
            String label = section.getKey().isEmpty() ? "Row " : section.getKey() + " row ";
            if (kind == null) {
                imported.skipped.add((section.getKey().isEmpty() ? "The file" : "Section " + section.getKey())
                        + ": couldn't tell whether it's fill-ups, services or expenses");
                continue;
            }
            var cells = Cells.table(table);
            for (int i = 0; i < cells.size(); i++) {
                Cells row = cells.get(i);
                String vehicle = row.text(VEHICLE) != null ? row.text(VEHICLE) : defaultVehicle;
                String where = label + (i + 2);
                switch (kind) {
                    case FUEL -> addFill(imported, vehicle, row.instant(DATE), row.number(ODO), row.number(VOLUME), row.number(UNIT_PRICE),
                            row.number(TOTAL), row.yes(true, FULL), false, row.text(STATION), row.text(NOTES), where, fill -> {});
                    case SERVICE -> addService(imported, vehicle, row.date(DATE), row.number(ODO), row.text(TITLE), row.text(VENDOR),
                            row.number(TOTAL), row.text(NOTES), where);
                    case EXPENSE -> addExpense(imported, vehicle, row.date(DATE), expenseCategory(row.text(TITLE) == null ? "" : row.text(TITLE)),
                            row.text(TITLE), row.number(TOTAL), row.number(ODO), row.text(VENDOR), row.text(NOTES), where);
                }
            }
        }
        return imported;
    }

    /** What a section holds: by its heading if that says, else by its columns. */
    private static Kind kindOf(String heading, Set<String> columns) {
        if (heading.matches(".*(refuel|abastec|fuel|fill).*")) return Kind.FUEL;
        if (heading.matches(".*(serv|maint|manut).*")) return Kind.SERVICE;
        if (heading.matches(".*(expens|despes|cost|gasto).*")) return Kind.EXPENSE;
        boolean volume = has(columns, VOLUME), odo = has(columns, ODO), total = has(columns, TOTAL);
        if (volume && odo) return Kind.FUEL;
        if (columns.stream().anyMatch(column -> column.contains("service") || column.contains("servico"))) return Kind.SERVICE;
        if (has(columns, TITLE) && total && has(columns, DATE)) return Kind.EXPENSE;
        return null;
    }

    private static boolean has(Set<String> columns, String[] names) {
        for (String name : names) if (columns.contains(Cells.key(name))) return true;
        return false;
    }

    // ---- making records --------------------------------------------------------------------------------------

    private static void addFill(Imported into, String vehicle, java.time.Instant at, BigDecimal odometer, BigDecimal volume, BigDecimal price,
                                BigDecimal total, boolean full, boolean missed, String station, String notes, String where,
                                java.util.function.Consumer<FuelEntry> more) {
        if (at == null) { into.skipped.add(where + ": no date"); return; }
        if (odometer == null) { into.skipped.add(where + ": no odometer reading"); return; }
        FuelMath.Fill amounts;
        try {
            amounts = FuelMath.complete(volume, price, total);
        } catch (IllegalArgumentException e) {
            into.skipped.add(where + ": " + e.getMessage().toLowerCase(Locale.ROOT));
            return;
        }
        var fill = new FuelEntry();
        fill.filledAt = at;
        fill.odometer = odometer;
        fill.volume = amounts.volume();
        fill.pricePerUnit = amounts.pricePerUnit();
        fill.totalCost = amounts.totalCost();
        fill.fullTank = full;
        fill.missedPrevious = missed;
        fill.stationName = station;
        fill.notes = notes;
        more.accept(fill);
        into.fills.add(new Named<>(vehicle, fill));
    }

    private static void addService(Imported into, String vehicle, java.time.LocalDate on, BigDecimal odometer, String title, String workshop,
                                   BigDecimal cost, String notes, String where) {
        if (on == null || title == null) { into.skipped.add(where + ": no date or title"); return; }
        var service = new ServiceRecord();
        service.servicedOn = on;
        service.odometer = odometer;
        service.title = title;
        service.workshop = workshop;
        service.cost = cost == null ? BigDecimal.ZERO : cost;
        service.notes = notes;
        into.services.add(new Named<>(vehicle, service));
    }

    private static void addExpense(Imported into, String vehicle, java.time.LocalDate on, Expense.Category category, String title, BigDecimal amount,
                                   BigDecimal odometer, String vendor, String notes, String where) {
        if (on == null || title == null || amount == null) { into.skipped.add(where + ": no date, title or amount"); return; }
        var expense = new Expense();
        expense.spentOn = on;
        expense.category = category;
        expense.title = title;
        expense.amount = amount;
        expense.odometer = odometer;
        expense.vendor = vendor;
        expense.notes = notes;
        into.expenses.add(new Named<>(vehicle, expense));
    }

    private static boolean isService(String text) {
        return text.toLowerCase(Locale.ROOT).matches(".*(serv|maint|repair|oil|tyre|tire|brake|chain|manut|revis).*");
    }

    /** An expense's category from words in its title or category name. */
    static Expense.Category expenseCategory(String text) {
        String words = text.toLowerCase(Locale.ROOT);
        if (words.matches(".*(insur|seguro).*")) return Expense.Category.INSURANCE;
        if (words.matches(".*(tax|registration|imposto|ipva|licen).*")) return Expense.Category.TAX;
        if (words.matches(".*(park|estacion).*")) return Expense.Category.PARKING;
        if (words.matches(".*(toll|pedag).*")) return Expense.Category.TOLL;
        if (words.matches(".*(wash|clean|lavag).*")) return Expense.Category.CLEANING;
        if (words.matches(".*(helmet|glove|jacket|gear|boots).*")) return Expense.Category.GEAR;
        if (words.matches(".*(accessor|acessor).*")) return Expense.Category.ACCESSORY;
        if (words.matches(".*(upgrade|tuning|mod).*")) return Expense.Category.UPGRADE;
        return Expense.Category.OTHER;
    }

    /** The file's rows split at the lines {@code heading} names (each section: its header row, then its rows). */
    private static Map<String, List<List<String>>> sections(List<List<String>> rows, Function<List<String>, String> heading) {
        var sections = new LinkedHashMap<String, List<List<String>>>();
        List<List<String>> current = null;
        for (List<String> row : rows) {
            String name = heading.apply(row);
            if (name != null) sections.put(name, current = new ArrayList<>());
            else if (current != null) current.add(row);
        }
        return sections;
    }

    private static <E extends Enum<E>> E constant(Class<E> type, String text, E otherwise) {
        if (text == null) return otherwise;
        try {
            return Enum.valueOf(type, text.strip().toUpperCase(Locale.ROOT).replace(' ', '_'));
        } catch (IllegalArgumentException e) {
            return otherwise;
        }
    }

    /** {@code value} in other units ({@code factor} per unit), kept to {@code places} decimals as the database does. */
    private static BigDecimal times(BigDecimal value, BigDecimal factor, int places) {
        return value == null ? null : factor.compareTo(BigDecimal.ONE) == 0 ? value : value.multiply(factor).setScale(places, RoundingMode.HALF_UP);
    }

    /** "drivvo-export.csv" → "drivvo export": the vehicle's name when the file doesn't give one. */
    private static String vehicleNameFrom(String fileName) {
        String base = fileName.replaceAll(".*[/\\\\]", "").replaceAll("\\.[^.]*$", "").replaceAll("[-_]+", " ").strip();
        return base.isEmpty() ? "Imported vehicle" : base;
    }
}
