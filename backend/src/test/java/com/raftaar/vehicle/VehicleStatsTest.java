package com.raftaar.vehicle;

import com.raftaar.expense.Expense;
import com.raftaar.fuel.FuelEntry;
import com.raftaar.upkeep.ServiceRecord;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class VehicleStatsTest {
    static BigDecimal d(String s) { return new BigDecimal(s); }

    @Test
    void monthlyCostsFillEmptyMonthsAndStopAtTwelve() {
        var zone = java.time.ZoneOffset.UTC;
        var today = LocalDate.of(2026, 11, 14);
        var fill = new FuelEntry();
        fill.filledAt = Instant.parse("2026-09-03T08:00:00Z");
        fill.totalCost = d("1000");
        var old = new FuelEntry();
        old.filledAt = Instant.parse("2024-01-10T08:00:00Z"); // older than a year: outside the window
        old.totalCost = d("500");
        var svc = new ServiceRecord();
        svc.servicedOn = LocalDate.of(2026, 11, 2);
        svc.cost = d("800");
        var exp = new Expense();
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

    @Test
    void kmPerDayNeedsTwoWeeksOfReadings() {
        Instant now = Instant.now();
        var tenDays = List.of(new VehicleStats.Reading(now.minus(java.time.Duration.ofDays(10)), new BigDecimal("1000"), "FUEL", 1L),
                new VehicleStats.Reading(now, new BigDecimal("1400"), "FUEL", 2L));
        assertNull(VehicleStats.kmPerDay(tenDays), "10 days is too few to predict from");

        var twentyDays = List.of(new VehicleStats.Reading(now.minus(java.time.Duration.ofDays(20)), new BigDecimal("1000"), "FUEL", 1L),
                new VehicleStats.Reading(now, new BigDecimal("1400"), "FUEL", 2L));
        assertEquals(new BigDecimal("20.0"), VehicleStats.kmPerDay(twentyDays));
    }
}
