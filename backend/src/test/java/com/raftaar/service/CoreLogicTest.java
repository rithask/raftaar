package com.raftaar.service;

import com.raftaar.domain.Reminder;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class CoreLogicTest {
    static BigDecimal d(String s) { return new BigDecimal(s); }

    @Test
    void fuelMathFillsInTheMissingValue() {
        assertEquals(d("1025.00"), FuelMath.complete(d("10"), d("102.5"), null).totalCost());
        assertEquals(d("4.878"), FuelMath.complete(null, d("102.50"), d("500")).volume());
        assertEquals(d("102.50"), FuelMath.complete(d("4.878"), null, d("500")).pricePerUnit());
        // all three given: the receipt wins
        assertEquals(d("499.99"), FuelMath.complete(d("4.878"), d("102.5"), d("499.99")).totalCost());
        assertThrows(IllegalArgumentException.class, () -> FuelMath.complete(d("5"), null, null));
    }

    @Test
    void mileageOnlyBetweenFullTanks() {
        var r = Economy.compute(List.of(
                new Economy.Fill(1, d("1000"), d("10"), d("1000"), true, false),
                new Economy.Fill(2, d("1200"), d("4"), d("400"), false, false), // partial
                new Economy.Fill(3, d("1450"), d("6"), d("600"), true, false),  // 450 km on 10 L
                new Economy.Fill(4, d("1800"), d("5"), d("500"), true, true),   // missed one: no figure, new anchor
                new Economy.Fill(5, d("2100"), d("7.5"), d("750"), true, false) // 300 km on 7.5 L
        ));
        assertEquals(d("45.00"), r.byEndId().get(3L).kmPerUnit());
        assertNull(r.byEndId().get(4L));
        assertEquals(d("40.00"), r.byEndId().get(5L).kmPerUnit());
        assertEquals(d("750"), r.distance());
        assertEquals(d("42.86"), r.average()); // 750 / 17.5
    }

    @Test
    void firstFillIsPartialSoNothingIsMeasuredUntilAFullTank() {
        var r = Economy.compute(List.of(
                new Economy.Fill(1, d("100"), d("3"), d("300"), false, false),
                new Economy.Fill(2, d("200"), d("3"), d("300"), true, false),
                new Economy.Fill(3, d("350"), d("3"), d("300"), true, false)));
        assertEquals(1, r.byEndId().size());
        assertEquals(d("50.00"), r.byEndId().get(3L).kmPerUnit());
    }

    @Test
    void reminderByDistanceOrDateWhicheverFirst() {
        Reminder r = new Reminder();
        r.intervalKm = d("3000");
        r.lastDoneOdometer = d("10000");
        r.intervalMonths = 6;
        r.lastDoneOn = LocalDate.of(2026, 6, 1);
        LocalDate today = LocalDate.of(2026, 11, 13);

        var ok = ReminderState.of(r, d("11000"), d("10"), today); // 2000 km left at 10 km/day = 200 days; date 18 days away
        assertEquals(ReminderState.State.OK, ok.state());
        assertEquals(18, ok.daysLeft());

        var soonByKm = ReminderState.of(r, d("12800"), d("10"), today);
        assertEquals(ReminderState.State.DUE_SOON, soonByKm.state());

        var soonByProjection = ReminderState.of(r, d("11500"), d("120"), today); // 1500 km at 120/day ≈ 13 days
        assertEquals(ReminderState.State.DUE_SOON, soonByProjection.state());

        var over = ReminderState.of(r, d("13100"), d("10"), today);
        assertEquals(ReminderState.State.OVERDUE, over.state());
        assertTrue(over.summary().startsWith("Overdue"));
    }

    @Test
    void findsAShortStopInsideADrive() {
        Instant t = Instant.parse("2026-11-12T08:00:00Z");
        double lat = 12.9716, lon = 77.5946;
        List<Dwells.Point> pts = List.of(
                new Dwells.Point(t, lat - 0.01, lon),
                new Dwells.Point(t.plusSeconds(30), lat - 0.005, lon),
                new Dwells.Point(t.plusSeconds(60), lat, lon),               // arrives at the pump
                new Dwells.Point(t.plusSeconds(120), lat + 0.0001, lon),
                new Dwells.Point(t.plusSeconds(240), lat, lon + 0.0001),     // leaves 3 min later
                new Dwells.Point(t.plusSeconds(270), lat + 0.005, lon),
                new Dwells.Point(t.plusSeconds(300), lat + 0.01, lon));
        var dwells = Dwells.find(pts, 40, 60, 1800);
        assertEquals(1, dwells.size());
        assertEquals(180, dwells.getFirst().seconds());
        assertTrue(Geo.meters(lat, lon, dwells.getFirst().lat(), dwells.getFirst().lon()) < 15);
    }

    @Test
    void monthlyCostsFillEmptyMonthsAndStopAtTwelve() {
        var zone = java.time.ZoneOffset.UTC;
        var today = LocalDate.of(2026, 11, 14);
        var fill = new com.raftaar.domain.FuelEntry();
        fill.filledAt = Instant.parse("2026-09-03T08:00:00Z");
        fill.totalCost = d("1000");
        var old = new com.raftaar.domain.FuelEntry();
        old.filledAt = Instant.parse("2024-01-10T08:00:00Z"); // older than a year: outside the window
        old.totalCost = d("500");
        var svc = new com.raftaar.domain.ServiceRecord();
        svc.servicedOn = LocalDate.of(2026, 11, 2);
        svc.cost = d("800");
        var exp = new com.raftaar.domain.Expense();
        exp.spentOn = LocalDate.of(2026, 9, 20);
        exp.amount = d("200");

        var months = VehicleStats.monthly(List.of(fill), List.of(svc), List.of(exp), today, zone);
        assertEquals(List.of("2026-09", "2026-10", "2026-11"), months.stream().map(VehicleStats.MonthCost::month).toList());
        assertEquals(d("1000"), months.get(0).fuel());
        assertEquals(d("200"), months.get(0).other());
        assertEquals(BigDecimal.ZERO, months.get(1).fuel());
        assertEquals(d("800"), months.get(2).service());

        var withOld = VehicleStats.monthly(List.of(old, fill), List.of(), List.of(), today, zone);
        assertEquals(12, withOld.size());
        assertEquals("2025-12", withOld.getFirst().month());
        assertTrue(VehicleStats.monthly(List.of(), List.of(), List.of(), today, zone).isEmpty());
    }
}
