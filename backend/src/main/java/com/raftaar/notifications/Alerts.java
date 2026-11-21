package com.raftaar.notifications;

import com.raftaar.papers.Document;
import com.raftaar.upkeep.Reminder;
import com.raftaar.inbox.Suggestion;
import com.raftaar.inbox.Trip;
import com.raftaar.vehicle.Vehicle;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import com.raftaar.papers.DocumentRepo;
import com.raftaar.upkeep.ReminderRepo;
import com.raftaar.upkeep.ReminderState;
import com.raftaar.inbox.SuggestionRepo;
import com.raftaar.common.SyncJob;
import com.raftaar.common.SyncLog;
import com.raftaar.inbox.TripRepo;
import com.raftaar.vehicle.VehicleRepo;
import com.raftaar.vehicle.VehicleStats;

/**
 * The daily check: service reminders that are due or overdue, and papers about to expire. Each reminder is sent
 * when it becomes due soon and when it becomes overdue (then weekly while overdue). A document is sent at its own
 * warning (e.g. 30 days), then 7 days, 1 day, on the day and the day after it expires.
 */
@Service
public class Alerts extends SyncJob {
    private static final Logger log = LoggerFactory.getLogger(Alerts.class);
    public static final String NAME = "alerts";
    private static final int[] DOC_STEPS = {7, 1, 0, -1};
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("d MMM yyyy");

    private final Notifications notifier;
    private final VehicleRepo vehicles;
    private final ReminderRepo reminders;
    private final DocumentRepo documents;
    private final TripRepo trips;
    private final SuggestionRepo suggestions;
    private final VehicleStats stats;

    public Alerts(Notifications notifier, VehicleRepo vehicles, ReminderRepo reminders, DocumentRepo documents, TripRepo trips,
                  SuggestionRepo suggestions, VehicleStats stats, SyncLog syncLog) {
        super(syncLog);
        this.notifier = notifier;
        this.vehicles = vehicles;
        this.reminders = reminders;
        this.documents = documents;
        this.trips = trips;
        this.suggestions = suggestions;
        this.stats = stats;
    }

    @Scheduled(cron = "${app.alerts.cron:0 0 9 * * *}")
    void scheduled() {
        runOnSchedule();
    }

    @Override
    public String name() {
        return NAME;
    }

    @Override
    protected String title() {
        return "Daily reminders";
    }

    @Override
    protected boolean configured() {
        return notifier.configured();
    }

    @Override
    protected String notConfiguredMessage() {
        return "No notification channels yet. Add one in Settings → Notifications.";
    }

    @Override
    protected String work() {
        return check();
    }

    private String check() {
        Map<Long, Vehicle> byId = vehicles.findAll().stream().collect(Collectors.toMap(v -> v.id, Function.identity()));
        LocalDate today = LocalDate.now();
        List<String> lines = new ArrayList<>();
        List<Runnable> afterSend = new ArrayList<>();
        boolean anyOverdue = false;

        // each active vehicle's odometer, worked out once for all its reminders (one round of queries for all of them)
        var odometers = new java.util.HashMap<Long, VehicleStats.Odometer>();
        stats.odometerHistories(byId.values().stream().filter(vehicle -> !vehicle.archived).toList())
                .forEach((vehicleId, history) -> odometers.put(vehicleId, stats.odometer(history)));
        for (Reminder r : reminders.findByActiveTrue()) {
            Vehicle v = byId.get(r.vehicleId);
            if (v == null || v.archived) continue;
            var odo = odometers.get(v.id);
            var current = odo.estimated() != null ? odo.estimated() : odo.known();
            var status = ReminderState.of(r, current, odo.kmPerDay(), today);
            var state = status.state();
            if (state != ReminderState.State.DUE_SOON && state != ReminderState.State.OVERDUE) continue;
            boolean changed = !state.name().equals(r.lastNotifiedState);
            boolean weeklyAgain = state == ReminderState.State.OVERDUE && r.lastNotifiedAt != null
                    && r.lastNotifiedAt.isBefore(Instant.now().minus(Duration.ofDays(7)));
            if (!changed && !weeklyAgain) continue;
            anyOverdue |= state == ReminderState.State.OVERDUE;
            lines.add("• " + v.name + ": " + r.title + " — " + status.summary());
            afterSend.add(() -> {
                r.lastNotifiedState = state.name();
                r.lastNotifiedAt = Instant.now();
                reminders.save(r);
            });
        }

        for (Document d : documents.findByExpiresOnNotNull()) {
            Vehicle v = d.vehicleId == null ? null : byId.get(d.vehicleId);
            if (v != null && v.archived) continue;
            long days = ChronoUnit.DAYS.between(today, d.expiresOn);
            Integer step = step(d, days);
            if (step == null) continue;
            if (d.expiresOn.equals(d.lastNotifiedExpiry) && d.lastNotifiedDays != null && d.lastNotifiedDays <= step) continue;
            anyOverdue |= days < 0;
            String who = v == null ? "Your" : v.name + ":";
            String when = days < 0 ? "expired on " + DAY.format(d.expiresOn) : days == 0 ? "expires today" : days == 1 ? "expires tomorrow"
                    : "expires in " + days + " days (" + DAY.format(d.expiresOn) + ")";
            lines.add("• " + who + " " + d.title + " " + when);
            afterSend.add(() -> {
                d.lastNotifiedExpiry = d.expiresOn;
                d.lastNotifiedDays = step;
                documents.save(d);
            });
        }

        long tripsToSort = trips.countByStatus(Trip.Status.PENDING);
        long toConfirm = suggestions.countByStatus(Suggestion.Status.PENDING);
        if (lines.isEmpty()) return "Nothing due";
        if (tripsToSort + toConfirm > 0) {
            lines.add("");
            lines.add("Inbox: " + toConfirm + " to confirm, " + tripsToSort + " trips to sort");
        }
        var outcome = notifier.send(afterSend.size() == 1 ? "Vehicle reminder" : "Vehicle reminders", String.join("\n", lines),
                anyOverdue ? AppriseClient.Level.WARNING : AppriseClient.Level.INFO);
        afterSend.forEach(Runnable::run);
        return "Sent " + afterSend.size() + " reminder" + (afterSend.size() == 1 ? "" : "s") + (outcome.failed() > 0 ? " (" + outcome.failed() + " channel" + (outcome.failed() == 1 ? "" : "s") + " failed)" : "");
    }

    /** Which warning step a document is at today, or null if none yet. */
    static Integer step(Document d, long days) {
        if (days < DOC_STEPS[DOC_STEPS.length - 1]) return days >= -7 ? -1 : null; // still warn once if it expired in the last week (e.g. the app was down)
        Integer step = null;
        if (days <= d.remindDaysBefore) step = d.remindDaysBefore;
        for (int s : DOC_STEPS) if (days <= s) step = s;
        return step;
    }
}
