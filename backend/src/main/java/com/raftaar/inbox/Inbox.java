package com.raftaar.inbox;

import com.raftaar.expense.ExpenseRepo;
import com.raftaar.fuel.FuelEntry;
import com.raftaar.fuel.FuelEntryRepo;
import com.raftaar.vehicle.VehicleRepo;
import com.raftaar.vehicle.VehicleStats;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import org.springframework.data.domain.Limit;
import org.springframework.transaction.annotation.Transactional;

/** What's waiting for you: GeoPulse trips to put on a vehicle, fill-ups or expenses to confirm, and fill-ups to check. */
@Service
@Transactional(readOnly = true)
public class Inbox {
    private final TripRepo trips;
    private final SuggestionRepo suggestions;
    private final VehicleRepo vehicles;
    private final VehicleStats stats;
    private final FuelEntryRepo fills;
    private final ExpenseRepo expenses;

    public Inbox(TripRepo trips, SuggestionRepo suggestions, VehicleRepo vehicles, VehicleStats stats, FuelEntryRepo fills, ExpenseRepo expenses) {
        this.trips = trips;
        this.suggestions = suggestions;
        this.vehicles = vehicles;
        this.stats = stats;
        this.fills = fills;
        this.expenses = expenses;
    }

    /** A suggestion with what its form needs pre-filled: the vehicle's odometer now, and the litres the amount buys. */
    public record SuggestionView(Suggestion suggestion, BigDecimal estimatedOdometer, BigDecimal estimatedVolume) {}

    /** {@code issues}: fill-ups whose Hisaab payment changed or disappeared since. */
    public record Overview(List<Trip> trips, List<SuggestionView> suggestions, List<FuelEntry> issues) {}

    public Overview overview() {
        var pending = suggestions.findByStatusOrderByOccurredAtDesc(Suggestion.Status.PENDING).stream().map(this::view).toList();
        var issues = fills.findBySourceIssueIsNotNullOrderByIdAsc();
        return new Overview(trips.findByStatusOrderByStartedAtDesc(Trip.Status.PENDING), pending, issues);
    }

    private SuggestionView view(Suggestion suggestion) {
        BigDecimal odometer = suggestion.suggestedVehicleId == null ? null : vehicles.findById(suggestion.suggestedVehicleId)
                .map(stats::odometer).map(reading -> reading.estimated() != null ? reading.estimated() : reading.known()).orElse(null);
        BigDecimal volume = suggestion.amount != null && suggestion.suggestedPrice != null && suggestion.suggestedPrice.signum() > 0
                ? suggestion.amount.divide(suggestion.suggestedPrice, 2, RoundingMode.HALF_UP) : null;
        return new SuggestionView(suggestion, odometer, volume);
    }

    /**
     * Something already dealt with: a suggestion (added or dismissed) or a trip (on a vehicle or not mine).
     * {@code vehicleId}: where it went (for an added suggestion, its fill-up's or expense's vehicle, while that exists).
     * {@code restorable}: it can go back to the Inbox.
     */
    public record Handled(Instant at, Suggestion suggestion, Trip trip, Long vehicleId, boolean restorable) {}

    /** {@code next}: pass it as {@code before} for the page after this one; null when there's no more. */
    public record HandledPage(List<Handled> items, Instant next) {}

    /** What's been dealt with, newest first by when it happened, {@code limit} at a time from before {@code before}. */
    public HandledPage handled(Instant before, int limit) {
        Limit oneMore = Limit.of(limit + 1);
        var handled = new ArrayList<Handled>(views(suggestions.findByStatusNotAndOccurredAtBeforeOrderByOccurredAtDescIdDesc(Suggestion.Status.PENDING, before, oneMore)));
        handled.addAll(trips.findByStatusNotAndStartedAtBeforeOrderByStartedAtDescIdDesc(Trip.Status.PENDING, before, oneMore).stream().map(Inbox::handled).toList());
        handled.sort(Comparator.comparing(Handled::at).reversed());
        if (handled.size() <= limit) return new HandledPage(handled, null);
        // The page ends with everything at the instant of its last item, read whole (the lists above may have stopped
        // part way through it), so the next page, strictly before that instant, misses nothing.
        Instant last = handled.get(limit - 1).at();
        var page = new ArrayList<>(handled.stream().filter(item -> item.at().isAfter(last)).toList());
        page.addAll(views(suggestions.findByStatusNotAndOccurredAtOrderByIdDesc(Suggestion.Status.PENDING, last)));
        page.addAll(trips.findByStatusNotAndStartedAtOrderByIdDesc(Trip.Status.PENDING, last).stream().map(Inbox::handled).toList());
        return new HandledPage(page, last);
    }

    private static Handled handled(Trip trip) {
        return new Handled(trip.startedAt, null, trip, trip.vehicleId, true);
    }

    /** Handled suggestions, with the fill-ups and expenses they became looked up in one go. */
    private List<Handled> views(List<Suggestion> handled) {
        var paymentIds = handled.stream().filter(s -> s.status == Suggestion.Status.ACCEPTED).map(s -> s.hisaabTxnId).filter(Objects::nonNull).toList();
        Map<String, Long> fillVehicles = paymentIds.isEmpty() ? Map.of()
                : fills.findByHisaabTxnIdIn(paymentIds).stream().collect(Collectors.toMap(fill -> fill.hisaabTxnId, fill -> fill.vehicleId, (a, b) -> a));
        Map<String, Long> expenseVehicles = paymentIds.isEmpty() ? Map.of()
                : expenses.findByHisaabTxnIdIn(paymentIds).stream().collect(Collectors.toMap(expense -> expense.hisaabTxnId, expense -> expense.vehicleId, (a, b) -> a));
        return handled.stream().map(suggestion -> {
            Long vehicleId = suggestion.status != Suggestion.Status.ACCEPTED || suggestion.hisaabTxnId == null ? null
                    : (suggestion.kind == Suggestion.Kind.FUEL ? fillVehicles : expenseVehicles).get(suggestion.hisaabTxnId);
            return new Handled(suggestion.occurredAt, suggestion, null, vehicleId, Suggestions.restorable(suggestion, vehicleId != null));
        }).toList();
    }
}
