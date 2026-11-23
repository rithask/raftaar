package com.raftaar.inbox;

import com.raftaar.expense.Expense;
import com.raftaar.fuel.FuelEntries;
import com.raftaar.fuel.FuelEntry;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api")
public class InboxController {
    private final Inbox inbox;
    private final Trips trips;
    private final Suggestions suggestions;

    public InboxController(Inbox inbox, Trips trips, Suggestions suggestions) {
        this.inbox = inbox;
        this.trips = trips;
        this.suggestions = suggestions;
    }

    @GetMapping("/inbox")
    public Inbox.Overview overview() {
        return inbox.overview();
    }

    @GetMapping("/inbox/handled")
    public Inbox.HandledPage handled(@RequestParam(required = false) Instant before, @RequestParam(defaultValue = "30") int limit) {
        return inbox.handled(before != null ? before : Instant.now().plusSeconds(60), Math.clamp(limit, 1, 100));
    }

    public record Assign(Long vehicleId) {}

    public record AssignAll(List<Long> tripIds, Long vehicleId) {}

    public record Dismiss(String reason) {}

    public record TripIds(List<Long> tripIds) {}

    public record UndoAdd(Long recordId) {}

    @PostMapping("/trips/{id}/assign")
    public Trip assign(@PathVariable Long id, @RequestBody Assign assign) {
        return trips.assign(id, assign.vehicleId());
    }

    @PostMapping("/trips/assign")
    public int assignAll(@RequestBody AssignAll assign) {
        return trips.assignAll(assign.tripIds(), assign.vehicleId());
    }

    @PostMapping("/trips/unassign")
    public int unassignAll(@RequestBody TripIds trips) {
        return this.trips.unassignAll(trips.tripIds());
    }

    @PostMapping("/trips/{id}/unassign")
    public Trip unassign(@PathVariable Long id) {
        return trips.unassign(id);
    }

    @GetMapping("/vehicles/{vehicleId}/trips")
    public List<Trip> forVehicle(@PathVariable Long vehicleId) {
        return trips.forVehicle(vehicleId);
    }

    @PostMapping("/suggestions/{id}/fuel")
    public FuelEntry acceptFuel(@PathVariable Long id, @RequestBody FuelEntries.Input input) {
        return suggestions.acceptFuel(id, input);
    }

    @PostMapping("/suggestions/{id}/expense")
    public Expense acceptExpense(@PathVariable Long id, @RequestBody Suggestions.ExpenseInput input) {
        return suggestions.acceptExpense(id, input);
    }

    @PostMapping("/suggestions/{id}/undo-add")
    public Suggestion undoAdd(@PathVariable Long id, @RequestBody UndoAdd undo) {
        return suggestions.undoAdd(id, undo.recordId());
    }

    @PostMapping("/suggestions/{id}/restore")
    public Suggestion restore(@PathVariable Long id) {
        return suggestions.restore(id);
    }

    @PostMapping("/suggestions/{id}/dismiss")
    public void dismiss(@PathVariable Long id, @RequestBody(required = false) Dismiss dismiss) {
        suggestions.dismiss(id, dismiss == null ? null : dismiss.reason());
    }
}
