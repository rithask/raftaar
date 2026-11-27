package com.raftaar.vehicle;

import com.raftaar.expense.Expense;
import com.raftaar.expense.ExpenseRepo;
import com.raftaar.fuel.Economy;
import com.raftaar.fuel.FuelEntry;
import com.raftaar.fuel.FuelEntryRepo;
import com.raftaar.inbox.Trip;
import com.raftaar.inbox.TripRepo;
import com.raftaar.papers.Document;
import com.raftaar.papers.DocumentRepo;
import com.raftaar.upkeep.Reminder;
import com.raftaar.upkeep.ReminderRepo;
import com.raftaar.upkeep.ReminderState;
import com.raftaar.upkeep.ServiceRecord;
import com.raftaar.upkeep.ServiceRecordRepo;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.transaction.annotation.Transactional;

/**
 * Everything worked out about a vehicle: where its odometer is, its mileage, what it has cost, what's due.
 * <p>
 * The records of any number of vehicles are loaded together ({@link #histories}: one query per kind of record, however
 * many vehicles), and the stats are then worked out in memory.
 */
@Service
@Transactional(readOnly = true)
public class VehicleStats {
    private static final Duration TRIP_RATE_WINDOW = Duration.ofDays(60);
    /** The fewest days of readings (or trips) a km-per-day figure is worked out from: fewer, and it's too rough to predict a date with. */
    static final int MIN_RATE_DAYS = 14;

    private final FuelEntryRepo fills;
    private final ServiceRecordRepo services;
    private final ExpenseRepo expenses;
    private final OdometerReadingRepo readings;
    private final TripRepo trips;
    private final ReminderRepo reminders;
    private final DocumentRepo papers;

    public VehicleStats(FuelEntryRepo fills, ServiceRecordRepo services, ExpenseRepo expenses, OdometerReadingRepo readings,
                        TripRepo trips, ReminderRepo reminders, DocumentRepo papers) {
        this.fills = fills;
        this.services = services;
        this.expenses = expenses;
        this.readings = readings;
        this.trips = trips;
        this.reminders = reminders;
        this.papers = papers;
    }

    /** One odometer reading; {@code id} is set only for manual readings, which are the ones you can delete. */
    public record Reading(Instant at, BigDecimal odometer, String source, Long id) {
        public Reading(Instant at, BigDecimal odometer, String source) {
            this(at, odometer, source, null);
        }
    }

    public record Odometer(BigDecimal known, Instant knownAt, String knownSource, BigDecimal estimated, BigDecimal tripKmSince,
                           BigDecimal kmPerDay) {}

    public record ReminderView(Reminder reminder, ReminderState.Status status) {}

    public record DocumentView(Document document, Long daysLeft, String state) {}

    public record Costs(BigDecimal fuel, BigDecimal service, BigDecimal expenses, BigDecimal total, BigDecimal perKm,
                        BigDecimal thisMonth) {}

    public record Summary(Vehicle vehicle, Odometer odometer, BigDecimal averageEconomy, BigDecimal lastEconomy, String unit,
                          FuelEntry lastFill, Costs costs, List<ReminderView> reminders, List<DocumentView> documents,
                          List<Economy.Stretch> economyHistory, Map<Long, Economy.Stretch> economyByFill, List<MonthCost> monthly,
                          Ownership ownership) {}

    /** What one calendar month cost, {@code month} as "2026-11". */
    public record MonthCost(String month, BigDecimal fuel, BigDecimal service, BigDecimal other) {}

    // ---- loading ----------------------------------------------------------------------------------------------

    /** The records of these vehicles, by vehicle id: one query per kind of record, however many vehicles. */
    public Map<Long, VehicleHistory> histories(List<Vehicle> vehicles) {
        return histories(vehicles, true);
    }

    /** Only what the odometer needs (no reminders or papers): for callers that want just where it stands. */
    public Map<Long, VehicleHistory> odometerHistories(List<Vehicle> vehicles) {
        return histories(vehicles, false);
    }

    private Map<Long, VehicleHistory> histories(List<Vehicle> vehicles, boolean withRemindersAndPapers) {
        if (vehicles.isEmpty()) return Map.of();
        List<Long> ids = vehicles.stream().map(vehicle -> vehicle.id).toList();
        var fillsByVehicle = byVehicle(fills.findByVehicleIdInOrderByFilledAtAscIdAsc(ids), fill -> fill.vehicleId);
        var servicesByVehicle = byVehicle(services.findByVehicleIdInOrderByServicedOnDescIdDesc(ids), service -> service.vehicleId);
        var expensesByVehicle = byVehicle(expenses.findByVehicleIdInOrderBySpentOnDescIdDesc(ids), expense -> expense.vehicleId);
        var readingsByVehicle = byVehicle(readings.findByVehicleIdInOrderByReadAtDesc(ids), reading -> reading.vehicleId);
        Map<Long, List<Reminder>> remindersByVehicle = withRemindersAndPapers
                ? byVehicle(reminders.findByVehicleIdInOrderByIdAsc(ids), reminder -> reminder.vehicleId) : Map.of();
        Map<Long, List<Document>> papersByVehicle = withRemindersAndPapers
                ? byVehicle(papers.findByVehicleIdInOrderByExpiresOnAscIdAsc(ids), paper -> paper.vehicleId) : Map.of();

        // Trips count from each vehicle's last reading (and over the last 60 days for its daily km): one query from
        // the earliest of those, then each vehicle keeps its own.
        Instant rateWindowStart = Instant.now().minus(TRIP_RATE_WINDOW);
        Instant earliest = rateWindowStart;
        for (Vehicle vehicle : vehicles) {
            var top = topReading(vehicle, fillsByVehicle.getOrDefault(vehicle.id, List.of()), servicesByVehicle.getOrDefault(vehicle.id, List.of()),
                    expensesByVehicle.getOrDefault(vehicle.id, List.of()), readingsByVehicle.getOrDefault(vehicle.id, List.of()));
            if (top.isPresent() && top.get().at().isBefore(earliest)) earliest = top.get().at();
        }
        var tripsByVehicle = byVehicle(trips.findByVehicleIdInAndStatusAndEndedAtAfter(ids, Trip.Status.ASSIGNED, earliest), trip -> trip.vehicleId);

        Map<Long, VehicleHistory> histories = new LinkedHashMap<>();
        for (Vehicle vehicle : vehicles) {
            histories.put(vehicle.id, new VehicleHistory(vehicle, fillsByVehicle.getOrDefault(vehicle.id, List.of()),
                    servicesByVehicle.getOrDefault(vehicle.id, List.of()), expensesByVehicle.getOrDefault(vehicle.id, List.of()),
                    readingsByVehicle.getOrDefault(vehicle.id, List.of()), remindersByVehicle.getOrDefault(vehicle.id, List.of()),
                    papersByVehicle.getOrDefault(vehicle.id, List.of()), tripsByVehicle.getOrDefault(vehicle.id, List.of())));
        }
        return histories;
    }

    public VehicleHistory history(Vehicle vehicle) {
        return histories(List.of(vehicle)).get(vehicle.id);
    }

    private static <T> Map<Long, List<T>> byVehicle(List<T> records, Function<T, Long> vehicleId) {
        // groupingBy keeps each vehicle's records in the order the query returned them
        return records.stream().collect(Collectors.groupingBy(vehicleId, Collectors.toList()));
    }

    // ---- worked out -------------------------------------------------------------------------------------------

    public Summary summary(Vehicle vehicle) {
        return summary(history(vehicle));
    }

    /** Summaries of several vehicles from one round of queries, in the order given. */
    public List<Summary> summaries(List<Vehicle> vehicles) {
        return histories(vehicles).values().stream().map(this::summary).toList();
    }

    public Summary summary(VehicleHistory history) {
        Vehicle vehicle = history.vehicle();
        List<FuelEntry> vehicleFills = history.fills();
        List<ServiceRecord> vehicleServices = history.services();
        List<Expense> vehicleExpenses = history.expenses();

        Odometer odometer = odometer(history);
        Economy.Result economy = Economy.of(vehicleFills);
        Economy.Stretch lastStretch = economy.stretches().isEmpty() ? null : economy.stretches().getLast();

        LocalDate today = LocalDate.now();
        ZoneId zone = ZoneId.systemDefault();
        LocalDate monthStart = today.withDayOfMonth(1);
        BigDecimal fuelCost = sum(vehicleFills.stream().map(fill -> fill.totalCost).toList());
        BigDecimal serviceCost = sum(vehicleServices.stream().map(service -> service.cost).toList());
        BigDecimal expenseCost = sum(vehicleExpenses.stream().map(expense -> expense.amount).toList());
        BigDecimal total = fuelCost.add(serviceCost).add(expenseCost);
        BigDecimal thisMonth = sum(vehicleFills.stream().filter(fill -> !fill.filledAt.atZone(zone).toLocalDate().isBefore(monthStart)).map(fill -> fill.totalCost).toList())
                .add(sum(vehicleServices.stream().filter(service -> !service.servicedOn.isBefore(monthStart)).map(service -> service.cost).toList()))
                .add(sum(vehicleExpenses.stream().filter(expense -> !expense.spentOn.isBefore(monthStart)).map(expense -> expense.amount).toList()));
        // Running cost per km, over the distance you've logged (purchase price left out).
        BigDecimal firstOdometer = firstOdometer(history);
        BigDecimal perKm = null;
        if (firstOdometer != null && odometer.known() != null) {
            BigDecimal distance = odometer.known().subtract(firstOdometer);
            if (distance.compareTo(BigDecimal.valueOf(50)) > 0) perKm = total.divide(distance, 2, RoundingMode.HALF_UP);
        }

        BigDecimal current = odometer.estimated() != null ? odometer.estimated() : odometer.known();
        List<ReminderView> due = history.reminders().stream()
                .filter(reminder -> reminder.active)
                .map(reminder -> new ReminderView(reminder, ReminderState.of(reminder, current, odometer.kmPerDay(), today)))
                .sorted(Comparator.comparingInt((ReminderView view) -> rank(view.status().state()))
                        .thenComparing(view -> view.status().dueOn(), Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        List<DocumentView> papersDue = history.papers().stream().map(VehicleStats::documentView).toList();

        return new Summary(vehicle, odometer, economy.average(), lastStretch == null ? null : lastStretch.kmPerUnit(), vehicle.fuelType.unit,
                vehicleFills.isEmpty() ? null : vehicleFills.getLast(), new Costs(fuelCost, serviceCost, expenseCost, total, perKm, thisMonth),
                due, papersDue, economy.stretches(), economy.byEndId(), monthly(vehicleFills, vehicleServices, vehicleExpenses, today, zone),
                Ownership.of(vehicle, total, firstOdometer, odometer.known(), today));
    }

    /** The last twelve months (or fewer, back to the first month with any spending), oldest first, empty months as zero. */
    static List<MonthCost> monthly(List<FuelEntry> fills, List<ServiceRecord> services, List<Expense> expenses, LocalDate today, ZoneId zone) {
        Map<YearMonth, BigDecimal[]> byMonth = new HashMap<>();
        fills.forEach(fill -> add(byMonth, YearMonth.from(fill.filledAt.atZone(zone)), 0, fill.totalCost));
        services.forEach(service -> add(byMonth, YearMonth.from(service.servicedOn), 1, service.cost));
        expenses.forEach(expense -> add(byMonth, YearMonth.from(expense.spentOn), 2, expense.amount));
        YearMonth end = YearMonth.from(today);
        YearMonth start = byMonth.keySet().stream().filter(month -> !month.isAfter(end)).min(Comparator.naturalOrder()).orElse(end);
        if (start.isBefore(end.minusMonths(11))) start = end.minusMonths(11);
        if (byMonth.isEmpty()) return List.of();
        List<MonthCost> months = new ArrayList<>();
        for (YearMonth month = start; !month.isAfter(end); month = month.plusMonths(1)) {
            BigDecimal[] costs = byMonth.getOrDefault(month, new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO});
            months.add(new MonthCost(month.toString(), costs[0], costs[1], costs[2]));
        }
        return months;
    }

    private static void add(Map<YearMonth, BigDecimal[]> byMonth, YearMonth month, int slot, BigDecimal amount) {
        if (amount == null) return;
        BigDecimal[] costs = byMonth.computeIfAbsent(month, unused -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO});
        costs[slot] = costs[slot].add(amount);
    }

    public static DocumentView documentView(Document paper) {
        if (paper.expiresOn == null) return new DocumentView(paper, null, "NO_EXPIRY");
        long daysLeft = ChronoUnit.DAYS.between(LocalDate.now(), paper.expiresOn);
        String state = daysLeft < 0 ? "EXPIRED" : daysLeft <= paper.remindDaysBefore ? "EXPIRING" : "VALID";
        return new DocumentView(paper, daysLeft, state);
    }

    public Economy.Result economy(List<FuelEntry> fillsInOrder) {
        return Economy.of(fillsInOrder);
    }

    /** Every odometer reading the vehicle has, from fill-ups, services, expenses and manual readings, oldest first. */
    public List<Reading> readings(VehicleHistory history) {
        return readings(history.vehicle(), history.fills(), history.services(), history.expenses(), history.enteredReadings());
    }

    private static List<Reading> readings(Vehicle vehicle, List<FuelEntry> fills, List<ServiceRecord> services, List<Expense> expenses,
                                          List<OdometerReading> entered) {
        ZoneId zone = ZoneId.systemDefault();
        List<Reading> all = new ArrayList<>();
        // Without a purchase date the reading has no place in time, so it only counts as the starting point (below).
        if (vehicle.purchaseOdometer != null && vehicle.purchaseDate != null) {
            all.add(new Reading(vehicle.purchaseDate.atStartOfDay(zone).toInstant(), vehicle.purchaseOdometer, "PURCHASE"));
        }
        fills.forEach(fill -> all.add(new Reading(fill.filledAt, fill.odometer, "FUEL")));
        services.stream().filter(service -> service.odometer != null)
                .forEach(service -> all.add(new Reading(service.servicedOn.atTime(12, 0).atZone(zone).toInstant(), service.odometer, "SERVICE")));
        expenses.stream().filter(expense -> expense.odometer != null)
                .forEach(expense -> all.add(new Reading(expense.spentOn.atTime(12, 0).atZone(zone).toInstant(), expense.odometer, "EXPENSE")));
        entered.forEach(reading -> all.add(new Reading(reading.readAt, reading.odometer, "MANUAL", reading.id)));
        all.sort(Comparator.comparing(Reading::at));
        return all;
    }

    /** The highest reading is the truth; a later but lower one is a typo somewhere. */
    private static Optional<Reading> topReading(Vehicle vehicle, List<FuelEntry> fills, List<ServiceRecord> services, List<Expense> expenses,
                                                List<OdometerReading> entered) {
        List<Reading> all = readings(vehicle, fills, services, expenses, entered);
        if (all.isEmpty() && vehicle.purchaseOdometer != null) all = List.of(new Reading(vehicle.createdAt, vehicle.purchaseOdometer, "PURCHASE"));
        return all.stream().max(Comparator.comparing(Reading::odometer).thenComparing(Reading::at));
    }

    public Odometer odometer(Vehicle vehicle) {
        return odometer(odometerHistories(List.of(vehicle)).get(vehicle.id));
    }

    /** Every odometer reading of one vehicle, oldest first. */
    public List<Reading> readings(Vehicle vehicle) {
        return readings(odometerHistories(List.of(vehicle)).get(vehicle.id));
    }

    public Odometer odometer(VehicleHistory history) {
        Vehicle vehicle = history.vehicle();
        List<Reading> all = readings(history);
        if (all.isEmpty() && vehicle.purchaseOdometer != null) all = List.of(new Reading(vehicle.createdAt, vehicle.purchaseOdometer, "PURCHASE"));
        if (all.isEmpty()) return new Odometer(null, null, null, null, null, tripKmPerDay(history));
        Reading top = all.stream().max(Comparator.comparing(Reading::odometer).thenComparing(Reading::at)).orElseThrow();
        BigDecimal tripKm = sum(history.assignedTrips().stream().filter(trip -> trip.endedAt.isAfter(top.at()))
                .map(trip -> trip.distanceM.divide(BigDecimal.valueOf(1000), 1, RoundingMode.HALF_UP)).toList());
        BigDecimal estimated = tripKm.signum() > 0 ? top.odometer().add(tripKm) : null;
        BigDecimal perDay = kmPerDay(all);
        if (perDay == null) perDay = tripKmPerDay(history);
        return new Odometer(top.odometer(), top.at(), top.source(), estimated, tripKm.signum() > 0 ? tripKm : null, perDay);
    }

    /** km per day over the last ~4 months of readings (if they span {@link #MIN_RATE_DAYS}), else over all of them. */
    static BigDecimal kmPerDay(List<Reading> all) {
        if (all.size() < 2) return null;
        Instant cutoff = Instant.now().minus(Duration.ofDays(120));
        List<Reading> recent = all.stream().filter(reading -> reading.at().isAfter(cutoff)).toList();
        List<Reading> use = recent.size() >= 2 && Duration.between(recent.getFirst().at(), recent.getLast().at()).toDays() >= MIN_RATE_DAYS ? recent : all;
        Reading first = use.getFirst(), last = use.getLast();
        double days = Duration.between(first.at(), last.at()).toHours() / 24.0;
        if (days < MIN_RATE_DAYS) return null;
        BigDecimal km = last.odometer().subtract(first.odometer());
        if (km.signum() <= 0) return null;
        return km.divide(BigDecimal.valueOf(days), 1, RoundingMode.HALF_UP);
    }

    /** km per day from the trips of the last 60 days, for a vehicle without enough odometer readings (once they span {@link #MIN_RATE_DAYS}). */
    private static BigDecimal tripKmPerDay(VehicleHistory history) {
        Instant since = Instant.now().minus(TRIP_RATE_WINDOW);
        var recent = history.assignedTrips().stream().filter(trip -> trip.endedAt.isAfter(since)).toList();
        if (recent.isEmpty()) return null;
        BigDecimal km = sum(recent.stream().map(trip -> trip.distanceM).toList()).divide(BigDecimal.valueOf(1000), 1, RoundingMode.HALF_UP);
        Instant first = recent.stream().map(trip -> trip.startedAt).min(Comparator.naturalOrder()).orElse(since);
        long days = Duration.between(first, Instant.now()).toDays();
        if (days < MIN_RATE_DAYS) return null;
        return km.divide(BigDecimal.valueOf(days), 1, RoundingMode.HALF_UP);
    }

    private static BigDecimal firstOdometer(VehicleHistory history) {
        Vehicle vehicle = history.vehicle();
        var lowest = readings(history.vehicle(), history.fills(), history.services(), history.expenses(), history.enteredReadings())
                .stream().map(Reading::odometer).min(Comparator.naturalOrder());
        if (vehicle.purchaseOdometer != null && (lowest.isEmpty() || vehicle.purchaseOdometer.compareTo(lowest.get()) < 0)) return vehicle.purchaseOdometer;
        return lowest.orElse(null);
    }

    static int rank(ReminderState.State state) {
        return switch (state) {
            case OVERDUE -> 0;
            case DUE_SOON -> 1;
            case OK -> 2;
            case UNKNOWN -> 3;
        };
    }

    static BigDecimal sum(Collection<BigDecimal> values) {
        BigDecimal total = BigDecimal.ZERO;
        for (BigDecimal value : values) if (value != null) total = total.add(value);
        return total;
    }
}
