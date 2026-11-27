package com.raftaar.upkeep;


import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Locale;

/**
 * Whether a reminder is due: by date or by distance, whichever comes first. Distance is turned into a date with the
 * vehicle's recent km per day, so "due at 12,000 km" can also warn a few days ahead and say roughly when.
 *
 * {@code projectedOn}: the day the distance is likely reached, when that comes before any due date (else the date
 * decides and the projection says nothing more).
 */
public final class ReminderState {
    private ReminderState() {}

    public enum State { OK, DUE_SOON, OVERDUE, UNKNOWN }

    public record Status(State state, LocalDate dueOn, BigDecimal dueOdometer, Long daysLeft, BigDecimal kmLeft,
                         LocalDate projectedOn, String summary) {}

    public static Status of(Reminder reminder, BigDecimal odometer, BigDecimal kmPerDay, LocalDate today) {
        LocalDate dueOn = reminder.effectiveDueOn();
        BigDecimal dueOdo = reminder.effectiveDueOdometer();
        if (dueOn == null && dueOdo == null) return new Status(State.UNKNOWN, null, null, null, null, null, "Set when it was last done");

        Long daysLeft = dueOn == null ? null : ChronoUnit.DAYS.between(today, dueOn);
        BigDecimal kmLeft = dueOdo == null || odometer == null ? null : dueOdo.subtract(odometer);
        LocalDate projected = null;
        if (kmLeft != null && kmPerDay != null && kmPerDay.signum() > 0 && kmLeft.signum() > 0) {
            projected = today.plusDays(kmLeft.divide(kmPerDay, 0, RoundingMode.CEILING).longValue());
            if (dueOn != null && !projected.isBefore(dueOn)) projected = null;
        }

        boolean overdue = (daysLeft != null && daysLeft < 0) || (kmLeft != null && kmLeft.signum() <= 0);
        boolean soon = (daysLeft != null && daysLeft <= reminder.notifyDaysBefore)
                || (kmLeft != null && kmLeft.compareTo(BigDecimal.valueOf(reminder.notifyKmBefore)) <= 0)
                || (projected != null && ChronoUnit.DAYS.between(today, projected) <= reminder.notifyDaysBefore);
        State state = overdue ? State.OVERDUE : soon ? State.DUE_SOON : State.OK;
        return new Status(state, dueOn, dueOdo, daysLeft, kmLeft, projected, summary(state, daysLeft, kmLeft, projected, today));
    }

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("d MMM", Locale.ENGLISH);
    private static final DateTimeFormatter DAY_YEAR = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);

    /** "Due in 1,200 km, around 14 Dec", "Due in 800 km or in 12 days", "Overdue: 300 km over". */
    private static String summary(State state, Long daysLeft, BigDecimal kmLeft, LocalDate projected, LocalDate today) {
        StringBuilder text = new StringBuilder();
        if (kmLeft != null) {
            long km = kmLeft.setScale(0, RoundingMode.HALF_UP).longValue();
            text.append(km >= 0 ? "in " + String.format("%,d", km) + " km" : String.format("%,d", -km) + " km over");
        }
        if (projected != null) return "Due " + text + ", around " + projected.format(projected.getYear() == today.getYear() ? DAY : DAY_YEAR);
        if (daysLeft != null) {
            if (!text.isEmpty()) text.append(" or ");
            text.append(daysLeft > 1 ? "in " + daysLeft + " days" : daysLeft == 1 ? "tomorrow" : daysLeft == 0 ? "today" : -daysLeft + " days late");
        }
        return (state == State.OVERDUE ? "Overdue: " : "Due ") + text;
    }
}
