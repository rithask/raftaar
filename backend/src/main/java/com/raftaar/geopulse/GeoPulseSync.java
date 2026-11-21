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
        Instant from = settings.instant("geopulse.syncedTo").map(syncedTo -> syncedTo.minus(OVERLAP))
                .orElse(to.minus(Duration.ofDays(cfg.importDays())));
        var timeline = client.timeline(from, to);
        log.debug("GeoPulse timeline from {}: {} trips, {} stays", from, timeline.trips().size(), timeline.stays().size());
        List<String> types = cfg.movementTypeList();

        int added = 0, stops = 0;
        for (var trip : timeline.trips()) {
            if (trip.id() == null || trip.timestamp() == null) continue;
            String type = trip.movementType() == null ? "UNKNOWN" : trip.movementType().toUpperCase();
            if (!types.contains(type)) continue;
            if (upsertTrip(trip, type)) added++;
        }
        for (var stay : timeline.stays()) {
            if (stay.timestamp() == null || stay.latitude() == null || stay.stayDuration() == null || stay.stayDuration() > MAX_STAY_SECONDS) continue;
            if (suggestions.fromStop(stay.timestamp(), stay.stayDuration(), stay.latitude(), stay.longitude()).isPresent()) stops++;
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
    private boolean upsertTrip(GeoPulseClient.Trip found, String type) {
        Trip trip = trips.findByGeopulseId(found.id()).orElse(null);
        if (trip == null) {
            // A rebuilt timeline gives trips new ids: the same start time is the same trip.
            trip = trips.findByStartedAtBetween(found.timestamp().minusSeconds(90), found.timestamp().plusSeconds(90)).stream().findFirst().orElse(null);
        }
        boolean isNew = trip == null;
        if (isNew) trip = new Trip();
        trip.geopulseId = found.id();
        trip.startedAt = found.timestamp();
        trip.endedAt = found.timestamp().plusSeconds(found.tripDuration() == null ? 0 : found.tripDuration());
        trip.distanceM = BigDecimal.valueOf(found.distanceMeters() == null ? 0 : found.distanceMeters());
        trip.movementType = type;
        trip.startLat = found.latitude();
        trip.startLon = found.longitude();
        trip.endLat = found.endLatitude();
        trip.endLon = found.endLongitude();
        if (isNew) {
            Trip created = trip;
            suggestions.vehicleForMovement(type).ifPresent(v -> created.suggestedVehicleId = v.id);
            if (cfg.autoAssign()) {
                suggestions.onlyVehicleFor(type).ifPresent(v -> {
                    created.vehicleId = v.id;
                    created.status = Trip.Status.ASSIGNED;
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
                    .filter(point -> point.coordinates() != null && (point.accuracy() == null || point.accuracy() <= 50))
                    .map(point -> new Dwells.Point(point.timestamp(), point.coordinates().lat(), point.coordinates().lng())).toList();
            int found = 0;
            for (var dwell : Dwells.find(points, 40, 60, MAX_STAY_SECONDS)) {
                if (suggestions.fromStop(dwell.middle(), dwell.seconds(), dwell.lat(), dwell.lon()).isPresent()) found++;
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
                    .filter(point -> point.coordinates() != null && (point.accuracy() == null || point.accuracy() <= 50))
                    .map(point -> new Dwells.Point(point.timestamp(), point.coordinates().lat(), point.coordinates().lng())).toList();
            for (var dwell : Dwells.find(points, 40, 30, MAX_STAY_SECONDS).reversed()) {
                var pump = places.nearestStation(dwell.lat(), dwell.lon(), 80);
                if (pump.isPresent()) {
                    log.debug("Suggestion {}: found the stop at {} for the payment", suggestionId, pump.get().station().name);
                    suggestions.attachStop(suggestionId, dwell, pump.get().station());
                    return;
                }
            }
        } catch (Exception e) {
            Failures.log(log, "GeoPulse points around a payment", e);
        }
    }
}
