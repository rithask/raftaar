package com.raftaar.geopulse;

import com.raftaar.inbox.Trip;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;

/**
 * Where a trip went between, by GeoPulse's timeline: a trip runs from one stay to the next, so it starts where the
 * stay that just ended was ("Home") and ends where the next one begins ("Office"). The closest stay within
 * {@link #NEAR} of the trip's start (or end) is taken; a stay without a name, or none near enough, leaves that end
 * unnamed.
 */
final class TripPlaces {
    private TripPlaces() {}

    /** How far apart a trip and the stay beside it may be (GeoPulse leaves gaps where it had no signal). */
    static final Duration NEAR = Duration.ofMinutes(30);

    record Places(String start, String end) {
        /** Gives the trip these places where they're named (an end not named keeps the one it had); true if it changed. */
        boolean applyTo(Trip trip) {
            String newStart = start != null ? start : trip.startPlace;
            String newEnd = end != null ? end : trip.endPlace;
            boolean changed = !Objects.equals(newStart, trip.startPlace) || !Objects.equals(newEnd, trip.endPlace);
            trip.startPlace = newStart;
            trip.endPlace = newEnd;
            return changed;
        }
    }

    static Places of(GeoPulseClient.Trip trip, List<GeoPulseClient.Stay> stays) {
        Instant started = trip.timestamp();
        Instant ended = started.plusSeconds(trip.tripDuration() == null ? 0 : trip.tripDuration());
        return new Places(nameOfClosest(stays, TripPlaces::endOf, started), nameOfClosest(stays, GeoPulseClient.Stay::timestamp, ended));
    }

    private static String nameOfClosest(List<GeoPulseClient.Stay> stays, Function<GeoPulseClient.Stay, Instant> when, Instant moment) {
        Optional<GeoPulseClient.Stay> closest = stays.stream()
                .filter(stay -> stay.timestamp() != null && Duration.between(when.apply(stay), moment).abs().compareTo(NEAR) <= 0)
                .min(Comparator.comparing(stay -> Duration.between(when.apply(stay), moment).abs()));
        return closest.map(GeoPulseClient.Stay::locationName).map(String::strip).filter(name -> !name.isEmpty()).orElse(null);
    }

    private static Instant endOf(GeoPulseClient.Stay stay) {
        return stay.timestamp().plusSeconds(stay.stayDuration() == null ? 0 : stay.stayDuration());
    }
}
