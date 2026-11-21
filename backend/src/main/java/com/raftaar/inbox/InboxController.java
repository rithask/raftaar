package com.raftaar.inbox;

import com.raftaar.fuel.FuelEntries;
import com.raftaar.vehicle.VehicleStats;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import com.raftaar.expense.Expense;
import com.raftaar.fuel.FuelEntry;
import com.raftaar.fuel.FuelEntryRepo;
import com.raftaar.vehicle.VehicleRepo;

/** What's waiting for you: GeoPulse trips to put on a vehicle, and fill-ups or expenses to confirm. */
@RestController
@RequestMapping("/api")
public class InboxController {
    private final TripRepo trips;
    private final SuggestionRepo suggestionRepo;
    private final Suggestions suggestions;
    private final VehicleRepo vehicles;
    private final VehicleStats stats;
    private final FuelEntryRepo fuel;

    public InboxController(TripRepo trips, SuggestionRepo suggestionRepo, Suggestions suggestions, VehicleRepo vehicles,
                           VehicleStats stats, FuelEntryRepo fuel) {
        this.trips = trips;
        this.suggestionRepo = suggestionRepo;
        this.suggestions = suggestions;
        this.vehicles = vehicles;
        this.stats = stats;
        this.fuel = fuel;
    }

    /** A suggestion with what the form needs: the vehicle's odometer, so a reading can be pre-filled. */
    public record SuggestionView(Suggestion suggestion, BigDecimal estimatedOdometer, BigDecimal estimatedVolume) {}

    public record Inbox(List<Trip> trips, List<SuggestionView> suggestions, List<FuelEntry> issues) {}

    @GetMapping("/inbox")
    public Inbox inbox() {
        var pending = suggestionRepo.findByStatusOrderByOccurredAtDesc(Suggestion.Status.PENDING).stream().map(s -> {
            BigDecimal odo = null;
            if (s.suggestedVehicleId != null) {
                var v = vehicles.findById(s.suggestedVehicleId);
                if (v.isPresent()) {
                    var o = stats.odometer(v.get());
                    odo = o.estimated() != null ? o.estimated() : o.known();
                }
            }
            BigDecimal vol = s.amount != null && s.suggestedPrice != null && s.suggestedPrice.signum() > 0
                    ? s.amount.divide(s.suggestedPrice, 2, RoundingMode.HALF_UP) : null;
            return new SuggestionView(s, odo, vol);
        }).toList();
        var issues = fuel.findAll().stream().filter(f -> f.sourceIssue != null).toList();
        return new Inbox(trips.findByStatusOrderByStartedAtDesc(Trip.Status.PENDING), pending, issues);
    }

    public record Assign(Long vehicleId) {}

    @PostMapping("/trips/{id}/assign")
    public Trip assign(@PathVariable Long id, @RequestBody Assign a) {
        Trip t = trips.require(id, "Trip");
        if (a.vehicleId() == null) {
            t.status = Trip.Status.IGNORED;
            t.vehicleId = null;
        } else {
            vehicles.require(a.vehicleId(), "Vehicle");
            t.status = Trip.Status.ASSIGNED;
            t.vehicleId = a.vehicleId();
        }
        return trips.save(t);
    }

    public record Bulk(List<Long> tripIds, Long vehicleId) {}

    /** Several trips at once; {@code vehicleId} null means "not on any of my vehicles". */
    @PostMapping("/trips/assign")
    @Transactional
    public int assignMany(@RequestBody Bulk b) {
        for (Long id : b.tripIds()) assign(id, new Assign(b.vehicleId()));
        return b.tripIds().size();
    }

    @PostMapping("/trips/{id}/unassign")
    public Trip unassign(@PathVariable Long id) {
        Trip t = trips.require(id, "Trip");
        t.status = Trip.Status.PENDING;
        t.vehicleId = null;
        return trips.save(t);
    }

    @GetMapping("/vehicles/{id}/trips")
    public List<Trip> vehicleTrips(@PathVariable Long id) {
        return trips.findByVehicleIdOrderByStartedAtDesc(id);
    }

    @PostMapping("/suggestions/{id}/fuel")
    public FuelEntry acceptFuel(@PathVariable Long id, @RequestBody FuelEntries.Input in) {
        return suggestions.acceptFuel(id, in);
    }

    @PostMapping("/suggestions/{id}/expense")
    public Expense acceptExpense(@PathVariable Long id, @RequestBody Suggestions.ExpenseInput in) {
        return suggestions.acceptExpense(id, in);
    }

    public record Dismiss(String reason) {}

    @PostMapping("/suggestions/{id}/dismiss")
    public void dismiss(@PathVariable Long id, @RequestBody(required = false) Dismiss d) {
        suggestions.dismiss(id, d == null ? null : d.reason());
    }
}
