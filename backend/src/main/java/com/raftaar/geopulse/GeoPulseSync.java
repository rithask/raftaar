package com.raftaar.geopulse;

import com.raftaar.common.AppProperties;
import com.raftaar.inbox.Trip;
import com.raftaar.inbox.TripRepo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import com.raftaar.places.Dwells;
import com.raftaar.common.Failures;
import com.raftaar.hisaab.HisaabSync;
import com.raftaar.places.Places;
import com.raftaar.common.Settings;
import com.raftaar.inbox.Suggestions;
import com.raftaar.common.SyncJob;
import com.raftaar.common.SyncLog;
import com.raftaar.common.Text;

/**
 * Imports driving trips from GeoPulse and looks for fuel stops. A stop is found two ways: a short GeoPulse stay
 * at a pump, or (because a 3-minute fill-up is usually too short to be a stay) a pause inside a trip's raw GPS
 * points next to a pump.
 */
@Service
public class GeoPulseSync extends SyncJob {
    private static final Logger log = LoggerFactory.getLogger(GeoPulseSync.class);
    public static final String NAME = "geopulse";
    private static final Duration OVERLAP = Duration.ofDays(2); // GeoPulse can rebuild recent timeline
    private static final long MAX_STAY_SECONDS = 30 * 60;

    private final GeoPulseClient client;
    private final AppProperties.GeoPulse cfg;
    private final TripRepo trips;
    private final Suggestions suggestions;
    private final Places places;
    private final Settings settings;

    public GeoPulseSync(GeoPulseClient client, AppProperties props, TripRepo trips, Suggestions suggestions, Places places,
                        Settings settings, SyncLog syncLog) {
        super(syncLog);
        this.client = client;
        this.cfg = props.geopulse();
        this.trips = trips;
        this.suggestions = suggestions;
        this.places = places;
        this.settings = settings;
    }

    @Scheduled(initialDelayString = "PT1M", fixedDelayString = "${app.geopulse.poll-interval:PT30M}")
    void scheduled() {
        runOnSchedule();
    }

    @Override
    public String name() {
        return NAME;
    }

    @Override
    protected String title() {
        return "GeoPulse sync";
    }

    @Override
    protected boolean configured() {
        return client.configured();
    }

    @Override
    protected String notConfiguredMessage() {
        return "GeoPulse isn't set up (GEOPULSE_URL, GEOPULSE_TOKEN)";
    }

    @Override
    protected String work() {
        return sync();
    }

    private String sync() {
        Instant to = Instant.now();
        Instant from = settings.instant("geopulse.syncedTo").map(t -> t.minus(OVERLAP))
                .orElse(to.minus(Duration.ofDays(cfg.importDays())));
        var timeline = client.timeline(from, to);
        log.debug("GeoPulse timeline from {}: {} trips, {} stays", from, timeline.trips().size(), timeline.stays().size());
        List<String> types = cfg.movementTypeList();

        int added = 0, stops = 0;
        for (var t : timeline.trips()) {
            if (t.id() == null || t.timestamp() == null) continue;
            String type = t.movementType() == null ? "UNKNOWN" : t.movementType().toUpperCase();
            if (!types.contains(type)) continue;
            if (upsertTrip(t, type)) added++;
        }
        for (var s : timeline.stays()) {
            if (s.timestamp() == null || s.latitude() == null || s.stayDuration() == null || s.stayDuration() > MAX_STAY_SECONDS) continue;
            if (suggestions.fromStop(s.timestamp(), s.stayDuration(), s.latitude(), s.longitude()).isPresent()) stops++;
        }
        for (Trip trip : trips.findByStopsCheckedFalseAndStatusNot(Trip.Status.IGNORED)) {
            stops += stopsInTrip(trip);
            trip.stopsChecked = true;
            trips.save(trip);
        }
        settings.set("geopulse.syncedTo", to);
        return Text.plural(added, "new trip") + ", " + Text.plural(stops, "fuel stop");
    }

    /** True when the trip is new. */
    private boolean upsertTrip(GeoPulseClient.Trip t, String type) {
        Trip trip = trips.findByGeopulseId(t.id()).orElse(null);
        if (trip == null) {
            // A rebuilt timeline gives trips new ids: the same start time is the same trip.
            trip = trips.findByStartedAtBetween(t.timestamp().minusSeconds(90), t.timestamp().plusSeconds(90)).stream().findFirst().orElse(null);
        }
        boolean isNew = trip == null;
        if (isNew) trip = new Trip();
        trip.geopulseId = t.id();
        trip.startedAt = t.timestamp();
        trip.endedAt = t.timestamp().plusSeconds(t.tripDuration() == null ? 0 : t.tripDuration());
        trip.distanceM = BigDecimal.valueOf(t.distanceMeters() == null ? 0 : t.distanceMeters());
        trip.movementType = type;
        trip.startLat = t.latitude();
        trip.startLon = t.longitude();
        trip.endLat = t.endLatitude();
        trip.endLon = t.endLongitude();
        if (isNew) {
            Trip tr = trip;
            suggestions.vehicleForMovement(type).ifPresent(v -> tr.suggestedVehicleId = v.id);
            if (cfg.autoAssign()) {
                suggestions.onlyVehicleFor(type).ifPresent(v -> {
                    tr.vehicleId = v.id;
                    tr.status = Trip.Status.ASSIGNED;
                });
            }
        }
        trips.save(trip);
        if (isNew) log.debug("New {} trip {} at {}{}", type, trip.id, trip.startedAt, trip.status == Trip.Status.ASSIGNED ? ", assigned to vehicle " + trip.vehicleId : "");
        return isNew;
    }

    private int stopsInTrip(Trip trip) {
        try {
            var points = client.points(trip.startedAt, trip.endedAt, 5000).stream()
                    .filter(p -> p.coordinates() != null && (p.accuracy() == null || p.accuracy() <= 50))
                    .map(p -> new Dwells.Point(p.timestamp(), p.coordinates().lat(), p.coordinates().lng())).toList();
            int found = 0;
            for (var d : Dwells.find(points, 40, 60, MAX_STAY_SECONDS)) {
                if (suggestions.fromStop(d.middle(), d.seconds(), d.lat(), d.lon()).isPresent()) found++;
            }
            return found;
        } catch (Exception e) {
            Failures.log(log, "GeoPulse points for trip " + trip.id, e);
            return 0;
        }
    }

    /** For a Hisaab payment: where were you around then? A pause next to a pump confirms the fill-up. */
    public void findStopFor(Long suggestionId, Instant paidAt) {
        if (!client.configured()) return;
        try {
            var points = client.points(paidAt.minus(Duration.ofMinutes(45)), paidAt.plus(Duration.ofMinutes(15)), 3000).stream()
                    .filter(p -> p.coordinates() != null && (p.accuracy() == null || p.accuracy() <= 50))
                    .map(p -> new Dwells.Point(p.timestamp(), p.coordinates().lat(), p.coordinates().lng())).toList();
            for (var d : Dwells.find(points, 40, 30, MAX_STAY_SECONDS).reversed()) {
                var pump = places.nearestStation(d.lat(), d.lon(), 80);
                if (pump.isPresent()) {
                    log.debug("Suggestion {}: found the stop at {} for the payment", suggestionId, pump.get().station().name);
                    suggestions.attachStop(suggestionId, d, pump.get().station());
                    return;
                }
            }
        } catch (Exception e) {
            Failures.log(log, "GeoPulse points around a payment", e);
        }
    }
}
