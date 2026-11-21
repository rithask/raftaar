package com.raftaar.vehicle;

import com.raftaar.fuel.FuelEntry;
import com.raftaar.inbox.Suggestion;
import com.raftaar.inbox.SuggestionRepo;
import com.raftaar.inbox.Trip;
import com.raftaar.inbox.TripRepo;
import com.raftaar.upkeep.ReminderState;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

/** The garage page: a card per vehicle with what needs attention, and how much is waiting in the inbox. */
@Service
public class Garage {
    private final VehicleRepo vehicles;
    private final VehicleStats stats;
    private final TripRepo trips;
    private final SuggestionRepo suggestions;

    public Garage(VehicleRepo vehicles, VehicleStats stats, TripRepo trips, SuggestionRepo suggestions) {
        this.vehicles = vehicles;
        this.stats = stats;
        this.trips = trips;
        this.suggestions = suggestions;
    }

    public record Card(Vehicle vehicle, VehicleStats.Odometer odometer, BigDecimal averageEconomy, BigDecimal lastEconomy, String unit,
                       FuelEntry lastFill, BigDecimal spentThisMonth, BigDecimal costPerKm,
                       List<VehicleStats.ReminderView> attention, List<VehicleStats.DocumentView> papers) {}

    public record Overview(List<Card> vehicles, long tripsToSort, long toConfirm) {}

    public Overview overview() {
        // every vehicle's records in one round of queries, however many vehicles
        List<Card> cards = stats.summaries(vehicles.findAllByOrderByArchivedAscSortOrderAscIdAsc()).stream().map(this::card).toList();
        return new Overview(cards, trips.countByStatus(Trip.Status.PENDING), suggestions.countByStatus(Suggestion.Status.PENDING));
    }

    private Card card(VehicleStats.Summary summary) {
        Vehicle vehicle = summary.vehicle();
        var attention = summary.reminders().stream().filter(reminder -> reminder.status().state() != ReminderState.State.OK
                && reminder.status().state() != ReminderState.State.UNKNOWN).toList();
        var papers = summary.documents().stream().filter(paper -> !"VALID".equals(paper.state()) && !"NO_EXPIRY".equals(paper.state())).toList();
        return new Card(vehicle, summary.odometer(), summary.averageEconomy(), summary.lastEconomy(), summary.unit(), summary.lastFill(),
                summary.costs().thisMonth(), summary.costs().perKm(), attention, papers);
    }
}
