package com.raftaar.inbox;

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
    Optional<Long> vehicleNamedIn(HisaabClient.Txn t) {
        String text = (String.join(" ", t.tags() == null ? List.of() : t.tags()) + " " + Objects.toString(t.notes(), "")).toLowerCase(Locale.ROOT);
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
        if (nearby.stream().anyMatch(s -> s.stopAt != null)) return Optional.empty(); // already seen this stop
        if (alreadyLogged(at)) return Optional.empty();
        Suggestion s = nearby.stream().filter(x -> x.status == Suggestion.Status.PENDING && x.hisaabTxnId != null && x.latitude == null)
                .min(Comparator.comparingLong(x -> Math.abs(Duration.between(x.occurredAt, at).toSeconds())))
                .orElseGet(() -> {
                    Suggestion n = new Suggestion();
                    n.kind = Suggestion.Kind.FUEL;
                    n.occurredAt = at;
                    return n;
                });
        s.stopAt = at;
        s.stopSeconds = (int) seconds;
        setPlace(s, lat, lon, pump.get().station());
        if (s.suggestedVehicleId == null) s.suggestedVehicleId = vehicleAt(at).orElse(null);
        s.note = s.hisaabTxnId != null ? "Paid in Hisaab and stopped at this pump" : "Stopped at this pump for " + Math.max(1, seconds / 60) + " min";
        price(s);
        return Optional.of(save(s));
    }

    private boolean alreadyLogged(Instant at) {
        return vehicles.findByArchivedFalse().stream().anyMatch(v -> fuel.findByVehicleIdOrderByFilledAtAscIdAsc(v.id).stream()
                .anyMatch(f -> Math.abs(Duration.between(f.filledAt, at).toMinutes()) <= MATCH_WINDOW.toMinutes()));
    }

    // ---- from Hisaab ------------------------------------------------------------------------------------------

    public enum Outcome { NEW, UPDATED, LINKED, UNCHANGED, FLAGGED }

    /** A fuel payment in Hisaab, new or changed. */
    @Transactional
    public Outcome fromHisaabFuel(HisaabClient.Txn t) {
        Instant at = t.occurredAt().toInstant();
        BigDecimal amount = t.amount().value();
        // Already confirmed: only tell you when Hisaab's figure no longer matches.
        var entry = fuel.findByHisaabTxnId(t.id());
        if (entry.isPresent()) {
            FuelEntry e = entry.get();
            if (e.totalCost.compareTo(amount) != 0) {
                e.sourceIssue = "Hisaab now says ₹" + amount.toPlainString() + " for this payment";
                fuel.save(e);
                return Outcome.FLAGGED;
            }
            if (e.sourceIssue != null && e.sourceIssue.startsWith("Hisaab")) {
                e.sourceIssue = null;
                fuel.save(e);
            }
            return Outcome.UNCHANGED;
        }
        var existing = repo.findByHisaabTxnId(t.id());
        if (existing.isPresent()) {
            Suggestion s = existing.get();
            if (s.status != Suggestion.Status.PENDING) return Outcome.UNCHANGED;
            fillFromTxn(s, t);
            price(s);
            save(s);
            return Outcome.UPDATED;
        }
        // Logged by hand already? Same amount, around the same time: link it instead of suggesting it again.
        for (Vehicle v : vehicles.findAll()) {
            for (FuelEntry f : fuel.findByVehicleIdOrderByFilledAtAscIdAsc(v.id)) {
                if (f.hisaabTxnId == null && f.totalCost.compareTo(amount) == 0 && Math.abs(Duration.between(f.filledAt, at).toHours()) <= 3) {
                    f.hisaabTxnId = t.id();
                    f.source = f.source == FuelEntry.Source.GEOPULSE ? FuelEntry.Source.HISAAB_GEOPULSE : f.source;
                    fuel.save(f);
                    return Outcome.LINKED;
                }
            }
        }
        // A GeoPulse pump stop waiting for its payment?
        Suggestion s = repo.findByKindAndOccurredAtBetween(Suggestion.Kind.FUEL, at.minus(MATCH_WINDOW), at.plus(MATCH_WINDOW)).stream()
                .filter(x -> x.status == Suggestion.Status.PENDING && x.hisaabTxnId == null)
                .min(Comparator.comparingLong(x -> Math.abs(Duration.between(x.occurredAt, at).toSeconds())))
                .orElseGet(() -> {
                    Suggestion n = new Suggestion();
                    n.kind = Suggestion.Kind.FUEL;
                    return n;
                });
        boolean merged = s.id != null;
        fillFromTxn(s, t);
        s.note = merged ? "Paid in Hisaab and stopped at this pump" : "Fuel payment in Hisaab";
        price(s);
        save(s);
        return Outcome.NEW;
    }

    private void fillFromTxn(Suggestion s, HisaabClient.Txn t) {
        s.occurredAt = t.occurredAt().toInstant();
        s.amount = t.amount().value();
        s.payee = t.payee();
        s.hisaabTxnId = t.id();
        s.hisaabCategory = t.category() == null ? null : t.category().name();
        s.hisaabAccount = t.account() == null ? null : t.account().name();
        var named = vehicleNamedIn(t);
        if (named.isPresent()) s.suggestedVehicleId = named.get();
        else if (s.suggestedVehicleId == null) s.suggestedVehicleId = vehicleAt(s.occurredAt).orElse(null);
        if (s.stationName == null && t.payee() != null) s.stationName = t.payee();
    }

    @Transactional
    public Outcome fromHisaabExpense(HisaabClient.Txn t) {
        if (expenses.findByHisaabTxnId(t.id()).isPresent()) return Outcome.UNCHANGED;
        Suggestion s = repo.findByHisaabTxnId(t.id()).orElseGet(() -> {
            Suggestion n = new Suggestion();
            n.kind = Suggestion.Kind.EXPENSE;
            return n;
        });
        if (s.status != Suggestion.Status.PENDING) return Outcome.UNCHANGED;
        boolean isNew = s.id == null;
        fillFromTxn(s, t);
        s.stationName = null;
        s.note = "Payment in Hisaab (" + s.hisaabCategory + ")";
        save(s);
        return isNew ? Outcome.NEW : Outcome.UPDATED;
    }

    /** The Hisaab payment behind a pending suggestion is gone (deleted, or moved out of the categories). */
    @Transactional
    public void hisaabGone(Suggestion s, String why) {
        if (s.status != Suggestion.Status.PENDING) return;
        if (s.stopAt != null && s.kind == Suggestion.Kind.FUEL) {
            // The pump stop is still real; only the payment went away.
            s.hisaabTxnId = null;
            s.amount = null;
            s.payee = null;
            s.hisaabCategory = null;
            s.hisaabAccount = null;
            s.note = "Stopped at this pump (" + why + ")";
        } else {
            s.status = Suggestion.Status.DISMISSED;
            s.dismissReason = why;
        }
        save(s);
    }

    // ---- shared -----------------------------------------------------------------------------------------------

    private void setPlace(Suggestion s, double lat, double lon, FuelStation st) {
        s.latitude = lat;
        s.longitude = lon;
        if (st != null) {
            s.stationName = st.name != null ? st.name : s.stationName;
            s.stationBrand = st.brand;
            s.latitude = st.latitude;
            s.longitude = st.longitude;
        }
        places.region(s.latitude, s.longitude).ifPresent(r -> {
            s.region = r.state();
            s.district = r.district();
        });
    }

    /** Fills in GPS stop details for a Hisaab payment, when GeoPulse has points around its time. */
    @Transactional
    public void attachStop(Long suggestionId, Dwells.Dwell d, FuelStation st) {
        repo.findById(suggestionId).ifPresent(s -> {
            if (s.stopAt != null) return;
            s.stopAt = d.middle();
            s.stopSeconds = (int) d.seconds();
            setPlace(s, d.lat(), d.lon(), st);
            s.note = "Paid in Hisaab and stopped at this pump";
            price(s);
            save(s);
        });
    }

    private void price(Suggestion s) {
        if (s.kind != Suggestion.Kind.FUEL) return;
        FuelType type = s.suggestedVehicleId == null ? FuelType.PETROL
                : vehicles.findById(s.suggestedVehicleId).map(v -> v.fuelType).orElse(FuelType.PETROL);
        prices.current(s.region, s.district, type, s.suggestedVehicleId).ifPresent(q -> s.suggestedPrice = q.price());
    }

    private Suggestion save(Suggestion s) {
        s.updatedAt = Instant.now();
        return repo.save(s);
    }

    // ---- your answers -----------------------------------------------------------------------------------------

    @Transactional
    public FuelEntry acceptFuel(Long id, FuelEntries.Input in) {
        Suggestion s = pending(id, Suggestion.Kind.FUEL);
        FuelEntry e = new FuelEntry();
        e.hisaabTxnId = s.hisaabTxnId;
        e.source = s.hisaabTxnId != null && s.stopAt != null ? FuelEntry.Source.HISAAB_GEOPULSE
                : s.hisaabTxnId != null ? FuelEntry.Source.HISAAB : FuelEntry.Source.GEOPULSE;
        FuelEntries.Input withPlace = new FuelEntries.Input(in.vehicleId(), in.filledAt() != null ? in.filledAt() : s.occurredAt,
                in.odometer(), in.volume(), in.pricePerUnit(), in.totalCost(), in.fullTank(), in.missedPrevious(),
                in.stationName() != null ? in.stationName() : s.stationName, in.stationBrand() != null ? in.stationBrand() : s.stationBrand,
                in.latitude() != null ? in.latitude() : s.latitude, in.longitude() != null ? in.longitude() : s.longitude,
                in.region() != null ? in.region() : s.region, in.district() != null ? in.district() : s.district, in.notes());
        FuelEntry saved = fuelEntries.save(e, withPlace);
        s.status = Suggestion.Status.ACCEPTED;
        save(s);
        return saved;
    }

    public record ExpenseInput(Long vehicleId, java.time.LocalDate spentOn, Expense.Category category, String title,
                               BigDecimal amount, BigDecimal odometer, String vendor, String notes) {}

    @Transactional
    public Expense acceptExpense(Long id, ExpenseInput in) {
        Suggestion s = pending(id, Suggestion.Kind.EXPENSE);
        if (in.vehicleId() == null || vehicles.findById(in.vehicleId()).isEmpty()) throw new IllegalArgumentException("Pick a vehicle");
        Expense e = new Expense();
        e.vehicleId = in.vehicleId();
        e.spentOn = in.spentOn() != null ? in.spentOn() : s.occurredAt.atZone(ZoneId.systemDefault()).toLocalDate();
        e.category = in.category() != null ? in.category() : Expense.Category.OTHER;
        e.title = in.title() != null && !in.title().isBlank() ? in.title().trim() : Objects.toString(s.payee, "Expense");
        e.amount = in.amount() != null ? in.amount() : s.amount;
        e.odometer = in.odometer();
        e.vendor = in.vendor() != null ? in.vendor() : s.payee;
        e.notes = in.notes();
        e.hisaabTxnId = s.hisaabTxnId;
        Expense saved = expenses.save(e);
        s.status = Suggestion.Status.ACCEPTED;
        save(s);
        return saved;
    }

    @Transactional
    public void dismiss(Long id, String reason) {
        Suggestion s = repo.require(id, "Suggestion");
        s.status = Suggestion.Status.DISMISSED;
        s.dismissReason = reason == null || reason.isBlank() ? "Dismissed" : reason;
        save(s);
    }

    private Suggestion pending(Long id, Suggestion.Kind kind) {
        Suggestion s = repo.require(id, "Suggestion");
        if (s.kind != kind) throw new IllegalArgumentException("That isn't a " + kind.name().toLowerCase() + " suggestion");
        if (s.status != Suggestion.Status.PENDING) throw new IllegalStateException("Already " + s.status.name().toLowerCase());
        return s;
    }
}
