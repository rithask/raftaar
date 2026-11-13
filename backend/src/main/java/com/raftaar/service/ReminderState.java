package com.raftaar.service;

import com.raftaar.domain.Reminder;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * Whether a reminder is due: by date or by distance, whichever comes first. Distance is turned into a date with the
 * vehicle's recent km per day, so "due at 12,000 km" can also warn a few days ahead.
 */
public final class ReminderState {
    private ReminderState() {}

    public enum State { OK, DUE_SOON, OVERDUE, UNKNOWN }

    public record Status(State state, LocalDate dueOn, BigDecimal dueOdometer, Long daysLeft, BigDecimal kmLeft,
                         LocalDate projectedOn, String summary) {}

    public static Status of(Reminder r, BigDecimal odometer, BigDecimal kmPerDay, LocalDate today) {
        LocalDate dueOn = r.effectiveDueOn();
        BigDecimal dueOdo = r.effectiveDueOdometer();
        if (dueOn == null && dueOdo == null) return new Status(State.UNKNOWN, null, null, null, null, null, "Set when it was last done");

        Long daysLeft = dueOn == null ? null : ChronoUnit.DAYS.between(today, dueOn);
        BigDecimal kmLeft = dueOdo == null || odometer == null ? null : dueOdo.subtract(odometer);
        LocalDate projected = null;
        if (kmLeft != null && kmPerDay != null && kmPerDay.signum() > 0 && kmLeft.signum() > 0) {
            projected = today.plusDays(kmLeft.divide(kmPerDay, 0, RoundingMode.CEILING).longValue());
        }

        boolean overdue = (daysLeft != null && daysLeft < 0) || (kmLeft != null && kmLeft.signum() <= 0);
        boolean soon = (daysLeft != null && daysLeft <= r.notifyDaysBefore)
                || (kmLeft != null && kmLeft.compareTo(BigDecimal.valueOf(r.notifyKmBefore)) <= 0)
                || (projected != null && ChronoUnit.DAYS.between(today, projected) <= r.notifyDaysBefore);
        State state = overdue ? State.OVERDUE : soon ? State.DUE_SOON : State.OK;
        return new Status(state, dueOn, dueOdo, daysLeft, kmLeft, projected, summary(state, daysLeft, kmLeft));
    }

    private static String summary(State state, Long daysLeft, BigDecimal kmLeft) {
        StringBuilder s = new StringBuilder();
        if (kmLeft != null) {
            long km = kmLeft.setScale(0, RoundingMode.HALF_UP).longValue();
            s.append(km >= 0 ? "in " + String.format("%,d", km) + " km" : String.format("%,d", -km) + " km over");
        }
        if (daysLeft != null) {
            if (!s.isEmpty()) s.append(" or ");
            s.append(daysLeft > 1 ? "in " + daysLeft + " days" : daysLeft == 1 ? "tomorrow" : daysLeft == 0 ? "today" : -daysLeft + " days late");
        }
        return (state == State.OVERDUE ? "Overdue: " : "Due ") + s;
    }
}
