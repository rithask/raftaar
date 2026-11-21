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
}
