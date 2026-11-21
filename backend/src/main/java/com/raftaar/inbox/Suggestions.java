package com.raftaar.inbox;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.raftaar.hisaab.HisaabClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.*;
import com.raftaar.places.Dwells;
import com.raftaar.expense.Expense;
import com.raftaar.expense.ExpenseRepo;
import com.raftaar.fuel.FuelEntries;
import com.raftaar.fuel.FuelEntry;
import com.raftaar.fuel.FuelEntryRepo;
import com.raftaar.fuel.FuelPrices;
import com.raftaar.places.FuelStation;
import com.raftaar.fuel.FuelType;
import com.raftaar.places.Places;
import com.raftaar.vehicle.Vehicle;
import com.raftaar.vehicle.VehicleRepo;

/**
 * Turns what Hisaab and GeoPulse saw into fill-ups and expenses to confirm. A Hisaab fuel payment and a GeoPulse
 * stop at a pump within {@link #MATCH_WINDOW} of each other are the same fill-up and become one suggestion.
 */
@Service
public class Suggestions {
    private static final Logger log = LoggerFactory.getLogger(Suggestions.class);
    static final Duration MATCH_WINDOW = Duration.ofMinutes(45);

    private final SuggestionRepo repo;
    private final VehicleRepo vehicles;
    private final TripRepo trips;
    private final FuelEntryRepo fuel;
    private final ExpenseRepo expenses;
    private final Places places;
    private final FuelPrices prices;
    private final FuelEntries fuelEntries;

    public Suggestions(SuggestionRepo repo, VehicleRepo vehicles, TripRepo trips, FuelEntryRepo fuel, ExpenseRepo expenses,
                       Places places, FuelPrices prices, FuelEntries fuelEntries) {
        this.repo = repo;
        this.vehicles = vehicles;
        this.trips = trips;
        this.fuel = fuel;
        this.expenses = expenses;
        this.places = places;
        this.prices = prices;
        this.fuelEntries = fuelEntries;
    }

    // ---- vehicles ---------------------------------------------------------------------------------------------

    /** The vehicle that fits a GeoPulse movement type best, if there's a clear one. */
    public Optional<Vehicle> vehicleForMovement(String movementType) {
        List<Vehicle> active = vehicles.findByArchivedFalse();
        int best = active.stream().mapToInt(v -> v.movementScore(movementType)).max().orElse(0);
        if (best == 0) return Optional.empty();
        List<Vehicle> top = active.stream().filter(v -> v.movementScore(movementType) == best).toList();
        if (top.size() == 1) return Optional.of(top.getFirst());
        return top.stream().filter(v -> v.isDefault).findFirst();
    }

    /** Is there exactly one vehicle that could have made this trip? (Then it can be assigned without asking.) */
    public Optional<Vehicle> onlyVehicleFor(String movementType) {
        List<Vehicle> fit = vehicles.findByArchivedFalse().stream().filter(v -> v.matchesMovement(movementType)).toList();
        return fit.size() == 1 ? Optional.of(fit.getFirst()) : Optional.empty();
    }

    /** The vehicle you were most likely on at a moment: the trip around it, else your default, else your only one. */
    public Optional<Long> vehicleAt(Instant at) {
        var around = trips.findByStartedAtBetween(at.minus(Duration.ofHours(3)), at.plus(Duration.ofMinutes(30))).stream()
                .filter(t -> t.status != Trip.Status.IGNORED)
                .filter(t -> !t.startedAt.isAfter(at.plus(Duration.ofMinutes(20))) && !t.endedAt.isBefore(at.minus(Duration.ofMinutes(20))))
                .min(Comparator.comparingLong(t -> Math.abs(Duration.between(t.startedAt.plus(Duration.between(t.startedAt, t.endedAt).dividedBy(2)), at).toSeconds())));
        if (around.isPresent()) {
            Long id = around.get().vehicleId != null ? around.get().vehicleId : around.get().suggestedVehicleId;
            if (id != null) return Optional.of(id);
        }
        List<Vehicle> active = vehicles.findByArchivedFalse();
        return active.stream().filter(v -> v.isDefault).findFirst().or(() -> active.size() == 1 ? Optional.of(active.getFirst()) : Optional.empty())
                .map(v -> v.id);
    }

    /** A vehicle named in a Hisaab transaction's tags or notes, e.g. tag "duke" or note "Fuel for KA01AB1234". */
    Optional<Long> vehicleNamedIn(HisaabClient.Txn payment) {
        String text = (String.join(" ", payment.tags() == null ? List.of() : payment.tags()) + " " + Objects.toString(payment.notes(), "")).toLowerCase(Locale.ROOT);
        if (text.isBlank()) return Optional.empty();
        String squashed = text.replace(" ", "");
        return vehicles.findByArchivedFalse().stream()
                .filter(v -> (v.name != null && text.contains(v.name.toLowerCase(Locale.ROOT)))
                        || (v.registration != null && squashed.contains(v.registration.toLowerCase(Locale.ROOT).replace(" ", ""))))
                .map(v -> v.id).findFirst();
    }

    // ---- from GeoPulse ----------------------------------------------------------------------------------------

    /** You stopped somewhere for a while. If it was at a fuel pump, that's probably a fill-up. */
    @Transactional
    public Optional<Suggestion> fromStop(Instant at, long seconds, double lat, double lon) {
        var pump = places.nearestStation(lat, lon, 80);
        if (pump.isEmpty()) return Optional.empty();
        var nearby = repo.findByKindAndOccurredAtBetween(Suggestion.Kind.FUEL, at.minus(MATCH_WINDOW), at.plus(MATCH_WINDOW));
        if (nearby.stream().anyMatch(suggestion -> suggestion.stopAt != null)) return Optional.empty(); // already seen this stop
        if (alreadyLogged(at)) return Optional.empty();
        Suggestion suggestion = nearby.stream().filter(candidate -> candidate.status == Suggestion.Status.PENDING && candidate.hisaabTxnId != null && candidate.latitude == null)
                .min(Comparator.comparingLong(candidate -> Math.abs(Duration.between(candidate.occurredAt, at).toSeconds())))
                .orElseGet(() -> {
                    Suggestion created = new Suggestion();
                    created.kind = Suggestion.Kind.FUEL;
                    created.occurredAt = at;
                    return created;
                });
        suggestion.stopAt = at;
        suggestion.stopSeconds = (int) seconds;
        setPlace(suggestion, lat, lon, pump.get().station());
        if (suggestion.suggestedVehicleId == null) suggestion.suggestedVehicleId = vehicleAt(at).orElse(null);
        suggestion.note = suggestion.hisaabTxnId != null ? "Paid in Hisaab and stopped at this pump" : "Stopped at this pump for " + Math.max(1, seconds / 60) + " min";
        price(suggestion);
        Suggestion saved = save(suggestion);
        log.debug("Fuel stop at {} ({} min): suggestion {}{}", saved.stationName, Math.max(1, seconds / 60), saved.id,
                saved.hisaabTxnId != null ? ", matched to a Hisaab payment" : "");
        return Optional.of(saved);
    }

    private boolean alreadyLogged(Instant at) {
        return vehicles.findByArchivedFalse().stream().anyMatch(v -> fuel.findByVehicleIdOrderByFilledAtAscIdAsc(v.id).stream()
                .anyMatch(f -> Math.abs(Duration.between(f.filledAt, at).toMinutes()) <= MATCH_WINDOW.toMinutes()));
    }

    // ---- from Hisaab ------------------------------------------------------------------------------------------

    public enum Outcome { NEW, UPDATED, LINKED, UNCHANGED, FLAGGED }

    /** A fuel payment in Hisaab, new or changed. */
    @Transactional
    public Outcome fromHisaabFuel(HisaabClient.Txn payment) {
        Instant at = payment.occurredAt().toInstant();
        BigDecimal amount = payment.amount().value();
        // Already confirmed: only tell you when Hisaab's figure no longer matches.
        var entry = fuel.findByHisaabTxnId(payment.id());
        if (entry.isPresent()) {
            FuelEntry fill = entry.get();
            if (fill.totalCost.compareTo(amount) != 0) {
                fill.sourceIssue = "Hisaab now says ₹" + amount.toPlainString() + " for this payment";
                fuel.save(fill);
                return Outcome.FLAGGED;
            }
            if (fill.sourceIssue != null && fill.sourceIssue.startsWith("Hisaab")) {
                fill.sourceIssue = null;
                fuel.save(fill);
            }
            return Outcome.UNCHANGED;
        }
        var existing = repo.findByHisaabTxnId(payment.id());
        if (existing.isPresent()) {
            Suggestion suggestion = existing.get();
            if (suggestion.status != Suggestion.Status.PENDING) return Outcome.UNCHANGED;
            fillFromTxn(suggestion, payment);
            price(suggestion);
            save(suggestion);
            return Outcome.UPDATED;
        }
        // Logged by hand already? Same amount, around the same time: link it instead of suggesting it again.
        for (Vehicle vehicle : vehicles.findAll()) {
            for (FuelEntry fill : fuel.findByVehicleIdOrderByFilledAtAscIdAsc(vehicle.id)) {
                if (fill.hisaabTxnId == null && fill.totalCost.compareTo(amount) == 0 && Math.abs(Duration.between(fill.filledAt, at).toHours()) <= 3) {
                    fill.hisaabTxnId = payment.id();
                    fill.source = fill.source == FuelEntry.Source.GEOPULSE ? FuelEntry.Source.HISAAB_GEOPULSE : fill.source;
                    fuel.save(fill);
                    return Outcome.LINKED;
                }
            }
        }
        // A GeoPulse pump stop waiting for its payment?
        Suggestion suggestion = repo.findByKindAndOccurredAtBetween(Suggestion.Kind.FUEL, at.minus(MATCH_WINDOW), at.plus(MATCH_WINDOW)).stream()
                .filter(candidate -> candidate.status == Suggestion.Status.PENDING && candidate.hisaabTxnId == null)
                .min(Comparator.comparingLong(candidate -> Math.abs(Duration.between(candidate.occurredAt, at).toSeconds())))
                .orElseGet(() -> {
                    Suggestion created = new Suggestion();
                    created.kind = Suggestion.Kind.FUEL;
                    return created;
                });
        boolean merged = suggestion.id != null;
        fillFromTxn(suggestion, payment);
        suggestion.note = merged ? "Paid in Hisaab and stopped at this pump" : "Fuel payment in Hisaab";
        price(suggestion);
        save(suggestion);
        return Outcome.NEW;
    }

    private void fillFromTxn(Suggestion suggestion, HisaabClient.Txn payment) {
        suggestion.occurredAt = payment.occurredAt().toInstant();
        suggestion.amount = payment.amount().value();
        suggestion.payee = payment.payee();
        suggestion.hisaabTxnId = payment.id();
        suggestion.hisaabCategory = payment.category() == null ? null : payment.category().name();
        suggestion.hisaabAccount = payment.account() == null ? null : payment.account().name();
        var named = vehicleNamedIn(payment);
        if (named.isPresent()) suggestion.suggestedVehicleId = named.get();
        else if (suggestion.suggestedVehicleId == null) suggestion.suggestedVehicleId = vehicleAt(suggestion.occurredAt).orElse(null);
        if (suggestion.stationName == null && payment.payee() != null) suggestion.stationName = payment.payee();
    }

    @Transactional
    public Outcome fromHisaabExpense(HisaabClient.Txn payment) {
        if (expenses.findByHisaabTxnId(payment.id()).isPresent()) return Outcome.UNCHANGED;
        Suggestion suggestion = repo.findByHisaabTxnId(payment.id()).orElseGet(() -> {
            Suggestion created = new Suggestion();
            created.kind = Suggestion.Kind.EXPENSE;
            return created;
        });
        if (suggestion.status != Suggestion.Status.PENDING) return Outcome.UNCHANGED;
        boolean isNew = suggestion.id == null;
        fillFromTxn(suggestion, payment);
        suggestion.stationName = null;
        suggestion.note = "Payment in Hisaab (" + suggestion.hisaabCategory + ")";
        save(suggestion);
        return isNew ? Outcome.NEW : Outcome.UPDATED;
    }

    /** The Hisaab payment behind a pending suggestion is gone (deleted, or moved out of the categories). */
    @Transactional
    public void hisaabGone(Suggestion suggestion, String why) {
        if (suggestion.status != Suggestion.Status.PENDING) return;
        if (suggestion.stopAt != null && suggestion.kind == Suggestion.Kind.FUEL) {
            // The pump stop is still real; only the payment went away.
            suggestion.hisaabTxnId = null;
            suggestion.amount = null;
            suggestion.payee = null;
            suggestion.hisaabCategory = null;
            suggestion.hisaabAccount = null;
            suggestion.note = "Stopped at this pump (" + why + ")";
        } else {
            suggestion.status = Suggestion.Status.DISMISSED;
            suggestion.dismissReason = why;
        }
        save(suggestion);
        log.debug("Suggestion {}: {}", suggestion.id, why);
    }

    // ---- shared -----------------------------------------------------------------------------------------------

    private void setPlace(Suggestion suggestion, double lat, double lon, FuelStation station) {
        suggestion.latitude = lat;
        suggestion.longitude = lon;
        if (station != null) {
            suggestion.stationName = station.name != null ? station.name : suggestion.stationName;
            suggestion.stationBrand = station.brand;
            suggestion.latitude = station.latitude;
            suggestion.longitude = station.longitude;
        }
        places.region(suggestion.latitude, suggestion.longitude).ifPresent(region -> {
            suggestion.region = region.state();
            suggestion.district = region.district();
        });
    }

    /** Fills in GPS stop details for a Hisaab payment, when GeoPulse has points around its time. */
    @Transactional
    public void attachStop(Long suggestionId, Dwells.Dwell dwell, FuelStation station) {
        repo.findById(suggestionId).ifPresent(suggestion -> {
            if (suggestion.stopAt != null) return;
            suggestion.stopAt = dwell.middle();
            suggestion.stopSeconds = (int) dwell.seconds();
            setPlace(suggestion, dwell.lat(), dwell.lon(), station);
            suggestion.note = "Paid in Hisaab and stopped at this pump";
            price(suggestion);
            save(suggestion);
        });
    }

    private void price(Suggestion suggestion) {
        if (suggestion.kind != Suggestion.Kind.FUEL) return;
        FuelType type = suggestion.suggestedVehicleId == null ? FuelType.PETROL
                : vehicles.findById(suggestion.suggestedVehicleId).map(v -> v.fuelType).orElse(FuelType.PETROL);
        prices.current(suggestion.region, suggestion.district, type, suggestion.suggestedVehicleId).ifPresent(quote -> suggestion.suggestedPrice = quote.price());
    }

    private Suggestion save(Suggestion suggestion) {
        suggestion.updatedAt = Instant.now();
        return repo.save(suggestion);
    }

    // ---- your answers -----------------------------------------------------------------------------------------

    @Transactional
    public FuelEntry acceptFuel(Long id, FuelEntries.Input input) {
        Suggestion suggestion = pending(id, Suggestion.Kind.FUEL);
        FuelEntry fill = new FuelEntry();
        fill.hisaabTxnId = suggestion.hisaabTxnId;
        fill.source = suggestion.hisaabTxnId != null && suggestion.stopAt != null ? FuelEntry.Source.HISAAB_GEOPULSE
                : suggestion.hisaabTxnId != null ? FuelEntry.Source.HISAAB : FuelEntry.Source.GEOPULSE;
        FuelEntries.Input withPlace = new FuelEntries.Input(input.vehicleId(), input.filledAt() != null ? input.filledAt() : suggestion.occurredAt,
                input.odometer(), input.volume(), input.pricePerUnit(), input.totalCost(), input.fullTank(), input.missedPrevious(),
                input.stationName() != null ? input.stationName() : suggestion.stationName, input.stationBrand() != null ? input.stationBrand() : suggestion.stationBrand,
                input.latitude() != null ? input.latitude() : suggestion.latitude, input.longitude() != null ? input.longitude() : suggestion.longitude,
                input.region() != null ? input.region() : suggestion.region, input.district() != null ? input.district() : suggestion.district, input.notes());
        FuelEntry saved = fuelEntries.save(fill, withPlace);
        suggestion.status = Suggestion.Status.ACCEPTED;
        save(suggestion);
        log.debug("Suggestion {} confirmed as fill-up {} on vehicle {}", id, saved.id, saved.vehicleId);
        return saved;
    }

    public record ExpenseInput(Long vehicleId, java.time.LocalDate spentOn, Expense.Category category, String title,
                               BigDecimal amount, BigDecimal odometer, String vendor, String notes) {}

    @Transactional
    public Expense acceptExpense(Long id, ExpenseInput input) {
        Suggestion suggestion = pending(id, Suggestion.Kind.EXPENSE);
        if (input.vehicleId() == null || vehicles.findById(input.vehicleId()).isEmpty()) throw new IllegalArgumentException("Pick a vehicle");
        Expense expense = new Expense();
        expense.vehicleId = input.vehicleId();
        expense.spentOn = input.spentOn() != null ? input.spentOn() : suggestion.occurredAt.atZone(ZoneId.systemDefault()).toLocalDate();
        expense.category = input.category() != null ? input.category() : Expense.Category.OTHER;
        expense.title = input.title() != null && !input.title().isBlank() ? input.title().trim() : Objects.toString(suggestion.payee, "Expense");
        expense.amount = input.amount() != null ? input.amount() : suggestion.amount;
        expense.odometer = input.odometer();
        expense.vendor = input.vendor() != null ? input.vendor() : suggestion.payee;
        expense.notes = input.notes();
        expense.hisaabTxnId = suggestion.hisaabTxnId;
        Expense saved = expenses.save(expense);
        suggestion.status = Suggestion.Status.ACCEPTED;
        save(suggestion);
        log.debug("Suggestion {} confirmed as expense {} on vehicle {}", id, saved.id, saved.vehicleId);
        return saved;
    }

    @Transactional
    public void dismiss(Long id, String reason) {
        Suggestion suggestion = repo.require(id, "Suggestion");
        suggestion.status = Suggestion.Status.DISMISSED;
        suggestion.dismissReason = reason == null || reason.isBlank() ? "Dismissed" : reason;
        save(suggestion);
        log.debug("Suggestion {} dismissed", id);
    }

    private Suggestion pending(Long id, Suggestion.Kind kind) {
        Suggestion suggestion = repo.require(id, "Suggestion");
        if (suggestion.kind != kind) throw new IllegalArgumentException("That isn't a " + kind.name().toLowerCase() + " suggestion");
        if (suggestion.status != Suggestion.Status.PENDING) throw new IllegalStateException("Already " + suggestion.status.name().toLowerCase());
        return suggestion;
    }
}
