package com.raftaar.inbox;

import com.raftaar.expense.Expense;
import com.raftaar.fuel.FuelEntries;
import com.raftaar.fuel.FuelEntry;
import org.springframework.web.bind.annotation.*;

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

    public record Assign(Long vehicleId) {}

    public record AssignAll(List<Long> tripIds, Long vehicleId) {}

    public record Dismiss(String reason) {}

    @PostMapping("/trips/{id}/assign")
    public Trip assign(@PathVariable Long id, @RequestBody Assign assign) {
        return trips.assign(id, assign.vehicleId());
    }

    @PostMapping("/trips/assign")
    public int assignAll(@RequestBody AssignAll assign) {
        return trips.assignAll(assign.tripIds(), assign.vehicleId());
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

    @PostMapping("/suggestions/{id}/dismiss")
    public void dismiss(@PathVariable Long id, @RequestBody(required = false) Dismiss dismiss) {
        suggestions.dismiss(id, dismiss == null ? null : dismiss.reason());
    }
}
