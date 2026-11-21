package com.raftaar.inbox;

import com.raftaar.fuel.FuelEntry;
import com.raftaar.fuel.FuelEntryRepo;
import com.raftaar.vehicle.VehicleRepo;
import com.raftaar.vehicle.VehicleStats;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/** What's waiting for you: GeoPulse trips to put on a vehicle, fill-ups or expenses to confirm, and fill-ups to check. */
@Service
public class Inbox {
    private final TripRepo trips;
    private final SuggestionRepo suggestions;
    private final VehicleRepo vehicles;
    private final VehicleStats stats;
    private final FuelEntryRepo fills;

    public Inbox(TripRepo trips, SuggestionRepo suggestions, VehicleRepo vehicles, VehicleStats stats, FuelEntryRepo fills) {
        this.trips = trips;
        this.suggestions = suggestions;
        this.vehicles = vehicles;
        this.stats = stats;
        this.fills = fills;
    }

    /** A suggestion with what its form needs pre-filled: the vehicle's odometer now, and the litres the amount buys. */
    public record SuggestionView(Suggestion suggestion, BigDecimal estimatedOdometer, BigDecimal estimatedVolume) {}

    /** {@code issues}: fill-ups whose Hisaab payment changed or disappeared since. */
    public record Overview(List<Trip> trips, List<SuggestionView> suggestions, List<FuelEntry> issues) {}

    public Overview overview() {
        var pending = suggestions.findByStatusOrderByOccurredAtDesc(Suggestion.Status.PENDING).stream().map(this::view).toList();
        var issues = fills.findAll().stream().filter(fill -> fill.sourceIssue != null).toList();
        return new Overview(trips.findByStatusOrderByStartedAtDesc(Trip.Status.PENDING), pending, issues);
    }

    private SuggestionView view(Suggestion suggestion) {
        BigDecimal odometer = suggestion.suggestedVehicleId == null ? null : vehicles.findById(suggestion.suggestedVehicleId)
                .map(stats::odometer).map(reading -> reading.estimated() != null ? reading.estimated() : reading.known()).orElse(null);
        BigDecimal volume = suggestion.amount != null && suggestion.suggestedPrice != null && suggestion.suggestedPrice.signum() > 0
                ? suggestion.amount.divide(suggestion.suggestedPrice, 2, RoundingMode.HALF_UP) : null;
        return new SuggestionView(suggestion, odometer, volume);
    }
}
