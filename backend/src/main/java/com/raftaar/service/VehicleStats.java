package com.raftaar.service;

import com.raftaar.domain.*;
import com.raftaar.repo.*;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

/** Everything worked out about a vehicle: where its odometer is, its mileage, what it has cost, what's due. */
@Service
public class VehicleStats {
    private final FuelEntryRepo fuel;
    private final ServiceRecordRepo services;
    private final ExpenseRepo expenses;
    private final OdometerReadingRepo readings;
    private final TripRepo trips;
    private final ReminderRepo reminders;
    private final DocumentRepo documents;

    public VehicleStats(FuelEntryRepo fuel, ServiceRecordRepo services, ExpenseRepo expenses, OdometerReadingRepo readings,
                        TripRepo trips, ReminderRepo reminders, DocumentRepo documents) {
        this.fuel = fuel;
        this.services = services;
        this.expenses = expenses;
        this.readings = readings;
        this.trips = trips;
        this.reminders = reminders;
        this.documents = documents;
    }

    public record Reading(Instant at, BigDecimal odometer, String source) {}

    public record Odometer(BigDecimal known, Instant knownAt, String knownSource, BigDecimal estimated, BigDecimal tripKmSince,
                           BigDecimal kmPerDay) {}

    public record ReminderView(Reminder reminder, ReminderState.Status status) {}

    public record DocumentView(Document document, Long daysLeft, String state) {}

    public record Costs(BigDecimal fuel, BigDecimal service, BigDecimal expenses, BigDecimal total, BigDecimal perKm,
                        BigDecimal thisMonth) {}

    public record Summary(Vehicle vehicle, Odometer odometer, BigDecimal averageEconomy, BigDecimal lastEconomy, String unit,
                          FuelEntry lastFill, Costs costs, List<ReminderView> reminders, List<DocumentView> documents,
                          List<Economy.Stretch> economyHistory, Map<Long, Economy.Stretch> economyByFill) {}

    public Summary summary(Vehicle v) {
        List<FuelEntry> fills = fuel.findByVehicleIdOrderByFilledAtAscIdAsc(v.id);
        List<ServiceRecord> svc = services.findByVehicleIdOrderByServicedOnDescIdDesc(v.id);
        List<Expense> exp = expenses.findByVehicleIdOrderBySpentOnDescIdDesc(v.id);

        Odometer odo = odometer(v, fills, svc, exp);
        Economy.Result eco = economy(fills);
        Economy.Stretch last = eco.stretches().isEmpty() ? null : eco.stretches().getLast();

        LocalDate today = LocalDate.now();
        ZoneId zone = ZoneId.systemDefault();
        LocalDate monthStart = today.withDayOfMonth(1);
        BigDecimal fuelCost = sum(fills.stream().map(f -> f.totalCost).toList());
        BigDecimal svcCost = sum(svc.stream().map(s -> s.cost).toList());
        BigDecimal expCost = sum(exp.stream().map(e -> e.amount).toList());
        BigDecimal total = fuelCost.add(svcCost).add(expCost);
        BigDecimal month = sum(fills.stream().filter(f -> !f.filledAt.atZone(zone).toLocalDate().isBefore(monthStart)).map(f -> f.totalCost).toList())
                .add(sum(svc.stream().filter(s -> !s.servicedOn.isBefore(monthStart)).map(s -> s.cost).toList()))
                .add(sum(exp.stream().filter(e -> !e.spentOn.isBefore(monthStart)).map(e -> e.amount).toList()));
        // Running cost per km, over the distance you've logged (purchase price left out).
        BigDecimal first = firstOdometer(v, fills, svc, exp);
        BigDecimal perKm = null;
        if (first != null && odo.known() != null) {
            BigDecimal dist = odo.known().subtract(first);
            if (dist.compareTo(BigDecimal.valueOf(50)) > 0) perKm = fuelCost.add(svcCost).add(expCost).divide(dist, 2, RoundingMode.HALF_UP);
        }

        BigDecimal current = odo.estimated() != null ? odo.estimated() : odo.known();
        List<ReminderView> rems = reminders.findByVehicleIdOrderByIdAsc(v.id).stream()
                .filter(r -> r.active)
                .map(r -> new ReminderView(r, ReminderState.of(r, current, odo.kmPerDay(), today)))
                .sorted(Comparator.comparingInt((ReminderView r) -> rank(r.status().state())).thenComparing(r -> r.status().dueOn(), Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        List<DocumentView> docs = documents.findByVehicleIdOrderByExpiresOnAsc(v.id).stream().map(VehicleStats::documentView).toList();

        return new Summary(v, odo, eco.average(), last == null ? null : last.kmPerUnit(), v.fuelType.unit,
                fills.isEmpty() ? null : fills.getLast(), new Costs(fuelCost, svcCost, expCost, total, perKm, month),
                rems, docs, eco.stretches(), eco.byEndId());
    }

    public static DocumentView documentView(Document d) {
        if (d.expiresOn == null) return new DocumentView(d, null, "NO_EXPIRY");
        long days = ChronoUnit.DAYS.between(LocalDate.now(), d.expiresOn);
        String state = days < 0 ? "EXPIRED" : days <= d.remindDaysBefore ? "EXPIRING" : "VALID";
        return new DocumentView(d, days, state);
    }

    public Economy.Result economy(List<FuelEntry> fillsInOrder) {
        // Mileage follows the odometer; sort by it so a fill-up entered late still lands in the right place.
        List<FuelEntry> sorted = new ArrayList<>(fillsInOrder);
        sorted.sort(Comparator.comparing((FuelEntry f) -> f.odometer).thenComparing(f -> f.filledAt));
        return Economy.compute(sorted.stream()
                .map(f -> new Economy.Fill(f.id, f.odometer, f.volume, f.totalCost, f.fullTank, f.missedPrevious)).toList());
    }

    /** Every odometer reading the vehicle has, from fill-ups, services, expenses and manual readings. */
    public List<Reading> readings(Vehicle v, List<FuelEntry> fills, List<ServiceRecord> svc, List<Expense> exp) {
        ZoneId zone = ZoneId.systemDefault();
        List<Reading> out = new ArrayList<>();
        // Without a purchase date the reading has no place in time, so it only counts as the starting point (below).
        if (v.purchaseOdometer != null && v.purchaseDate != null) {
            out.add(new Reading(v.purchaseDate.atStartOfDay(zone).toInstant(), v.purchaseOdometer, "PURCHASE"));
        }
        fills.forEach(f -> out.add(new Reading(f.filledAt, f.odometer, "FUEL")));
        svc.stream().filter(s -> s.odometer != null).forEach(s -> out.add(new Reading(s.servicedOn.atTime(12, 0).atZone(zone).toInstant(), s.odometer, "SERVICE")));
        exp.stream().filter(e -> e.odometer != null).forEach(e -> out.add(new Reading(e.spentOn.atTime(12, 0).atZone(zone).toInstant(), e.odometer, "EXPENSE")));
        readings.findByVehicleIdOrderByReadAtDesc(v.id).forEach(r -> out.add(new Reading(r.readAt, r.odometer, "MANUAL")));
        out.sort(Comparator.comparing(Reading::at));
        return out;
    }

    public Odometer odometer(Vehicle v) {
        return odometer(v, fuel.findByVehicleIdOrderByFilledAtAscIdAsc(v.id), services.findByVehicleIdOrderByServicedOnDescIdDesc(v.id),
                expenses.findByVehicleIdOrderBySpentOnDescIdDesc(v.id));
    }

    private Odometer odometer(Vehicle v, List<FuelEntry> fills, List<ServiceRecord> svc, List<Expense> exp) {
        List<Reading> all = readings(v, fills, svc, exp);
        if (all.isEmpty() && v.purchaseOdometer != null) all = List.of(new Reading(v.createdAt, v.purchaseOdometer, "PURCHASE"));
        if (all.isEmpty()) return new Odometer(null, null, null, null, null, tripKmPerDay(v));
        // The highest reading is the truth; a later but lower one is a typo somewhere.
        Reading top = all.stream().max(Comparator.comparing(Reading::odometer).thenComparing(Reading::at)).orElseThrow();
        BigDecimal tripKm = sum(trips.findByVehicleIdAndStatusAndEndedAtAfter(v.id, Trip.Status.ASSIGNED, top.at()).stream()
                .map(t -> t.distanceM.divide(BigDecimal.valueOf(1000), 1, RoundingMode.HALF_UP)).toList());
        BigDecimal estimated = tripKm.signum() > 0 ? top.odometer().add(tripKm) : null;
        BigDecimal perDay = kmPerDay(all);
        if (perDay == null) perDay = tripKmPerDay(v);
        return new Odometer(top.odometer(), top.at(), top.source(), estimated, tripKm.signum() > 0 ? tripKm : null, perDay);
    }

    /** km per day over the last ~4 months of readings (at least a week of them), else over all of them. */
    static BigDecimal kmPerDay(List<Reading> all) {
        if (all.size() < 2) return null;
        Instant cutoff = Instant.now().minus(Duration.ofDays(120));
        List<Reading> recent = all.stream().filter(r -> r.at().isAfter(cutoff)).toList();
        List<Reading> use = recent.size() >= 2 && Duration.between(recent.getFirst().at(), recent.getLast().at()).toDays() >= 7 ? recent : all;
        Reading a = use.getFirst(), b = use.getLast();
        double days = Duration.between(a.at(), b.at()).toHours() / 24.0;
        if (days < 3) return null;
        BigDecimal km = b.odometer().subtract(a.odometer());
        if (km.signum() <= 0) return null;
        return km.divide(BigDecimal.valueOf(days), 1, RoundingMode.HALF_UP);
    }

    private BigDecimal tripKmPerDay(Vehicle v) {
        Instant since = Instant.now().minus(Duration.ofDays(60));
        var recent = trips.findByVehicleIdAndStatusAndEndedAtAfter(v.id, Trip.Status.ASSIGNED, since);
        if (recent.isEmpty()) return null;
        BigDecimal km = sum(recent.stream().map(t -> t.distanceM).toList()).divide(BigDecimal.valueOf(1000), 1, RoundingMode.HALF_UP);
        Instant first = recent.stream().map(t -> t.startedAt).min(Comparator.naturalOrder()).orElse(since);
        long days = Math.max(7, Duration.between(first, Instant.now()).toDays());
        return km.divide(BigDecimal.valueOf(days), 1, RoundingMode.HALF_UP);
    }

    private BigDecimal firstOdometer(Vehicle v, List<FuelEntry> fills, List<ServiceRecord> svc, List<Expense> exp) {
        var lowest = readings(v, fills, svc, exp).stream().map(Reading::odometer).min(Comparator.naturalOrder());
        if (v.purchaseOdometer != null && (lowest.isEmpty() || v.purchaseOdometer.compareTo(lowest.get()) < 0)) return v.purchaseOdometer;
        return lowest.orElse(null);
    }

    static int rank(ReminderState.State s) {
        return switch (s) {
            case OVERDUE -> 0;
            case DUE_SOON -> 1;
            case OK -> 2;
            case UNKNOWN -> 3;
        };
    }

    static BigDecimal sum(Collection<BigDecimal> values) {
        BigDecimal t = BigDecimal.ZERO;
        for (BigDecimal b : values) if (b != null) t = t.add(b);
        return t;
    }
}
