package com.raftaar.upkeep;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

class ReminderStateTest {
    static BigDecimal d(String s) { return new BigDecimal(s); }

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
    void distanceTurnedIntoARoughDate() {
        Reminder r = new Reminder();
        r.intervalKm = d("3000");
        r.lastDoneOdometer = d("10000");
        LocalDate today = LocalDate.of(2026, 11, 13);

        var status = ReminderState.of(r, d("11800"), d("40"), today); // 1200 km at 40 a day = 30 days
        assertEquals(LocalDate.of(2026, 12, 13), status.projectedOn());
        assertEquals("Due in 1,200 km, around 13 Dec", status.summary());

        var nextYear = ReminderState.of(r, d("10200"), d("10"), today); // 2800 km at 10 a day = 280 days
        assertEquals("Due in 2,800 km, around 20 Aug 2027", nextYear.summary());

        assertNull(ReminderState.of(r, d("11800"), null, today).projectedOn(), "no km per day, no date");
        assertNull(ReminderState.of(r, d("13100"), d("40"), today).projectedOn(), "overdue already");
    }

    @Test
    void aDueDateBeforeTheProjectionDecides() {
        Reminder r = new Reminder();
        r.intervalKm = d("3000");
        r.lastDoneOdometer = d("10000");
        r.intervalMonths = 6;
        r.lastDoneOn = LocalDate.of(2026, 6, 1); // due 1 Dec
        LocalDate today = LocalDate.of(2026, 11, 13);

        var status = ReminderState.of(r, d("11000"), d("10"), today); // 2000 km at 10 a day: long after 1 Dec
        assertNull(status.projectedOn());
        assertEquals("Due in 2,000 km or in 18 days", status.summary());
    }
}
