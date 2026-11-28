package com.raftaar.geopulse;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class TripPlacesTest {
    static final Instant NINE = Instant.parse("2026-11-27T03:30:00Z"); // 9:00 in India

    static GeoPulseClient.Stay stay(String name, Instant from, long seconds) {
        return new GeoPulseClient.Stay(1L, from, name, seconds, 9.9, 76.3);
    }

    /** A 25-minute trip leaving at 9:00. */
    static final GeoPulseClient.Trip TRIP = new GeoPulseClient.Trip(7L, NINE, 9.9, 76.3, 10.0, 76.4, 25L * 60, 12_000.0, "CAR");

    @Test
    void fromTheStayItLeftToTheOneItReached() {
        var places = TripPlaces.of(TRIP, List.of(
                stay("Home", NINE.minusSeconds(10 * 3600), 10 * 3600),          // ends as the trip starts
                stay("Office", NINE.plusSeconds(25 * 60), 8 * 3600),            // starts as it arrives
                stay("Tea shop", NINE.plusSeconds(9 * 3600), 600)));            // later the same day
        assertEquals(new TripPlaces.Places("Home", "Office"), places);
    }

    @Test
    void theClosestWithinHalfAnHourCounts() {
        var places = TripPlaces.of(TRIP, List.of(
                stay("Home", NINE.minusSeconds(10 * 3600), 10 * 3600 - 20 * 60), // left 20 minutes before (no signal)
                stay("Gym", NINE.minusSeconds(3 * 3600), 3600),                  // long before
                stay("Office", NINE.plusSeconds(25 * 60 + 50 * 60), 3600)));     // 50 minutes after it arrived: too far
        assertEquals(new TripPlaces.Places("Home", null), places);
    }

    @Test
    void aStayWithoutANameNamesNothing() {
        var places = TripPlaces.of(TRIP, List.of(stay("  ", NINE.minusSeconds(3600), 3600), stay(null, NINE.plusSeconds(25 * 60), 600)));
        assertEquals(new TripPlaces.Places(null, null), places);
    }

    @Test
    void anEndTheTimelineDoesntNameKeepsTheOneItHad() {
        var trip = new com.raftaar.inbox.Trip();
        trip.startPlace = "Home";
        trip.endPlace = "Office";
        assertTrue(new TripPlaces.Places("Parents' place", null).applyTo(trip));
        assertEquals("Parents' place", trip.startPlace);
        assertEquals("Office", trip.endPlace, "not named this time: kept");
        assertFalse(new TripPlaces.Places("Parents' place", "Office").applyTo(trip), "nothing new: unchanged");
    }
}
