package com.raftaar.inbox;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** What became of a handled suggestion or trip, and which can go back to the Inbox. */
class ResolutionTest {
    static Suggestion suggestion(Suggestion.Status status, String paymentId, String dismissReason) {
        Suggestion suggestion = new Suggestion();
        suggestion.status = status;
        suggestion.hisaabTxnId = paymentId;
        suggestion.dismissReason = dismissReason;
        return suggestion;
    }

    static Trip trip(Trip.Status status) {
        Trip trip = new Trip();
        trip.status = status;
        return trip;
    }

    @Test
    void oneYouDismissedCanComeBack() {
        Resolution resolution = Resolution.of(suggestion(Suggestion.Status.DISMISSED, "T1", Resolution.DISMISSED_BY_YOU), false);
        assertEquals(Resolution.DISMISSED, resolution);
        assertTrue(resolution.restorable);
    }

    @Test
    void oneTheSyncDismissedCannot() {
        Resolution resolution = Resolution.of(suggestion(Suggestion.Status.DISMISSED, "T1", "No longer in Hisaab (deleted or moved out of fuel)"), false);
        assertEquals(Resolution.DISMISSED_BY_SYNC, resolution);
        assertFalse(resolution.restorable);
    }

    @Test
    void oneYouAddedComesBackOnlyOnceItsRecordIsGone() {
        assertEquals(Resolution.ADDED, Resolution.of(suggestion(Suggestion.Status.ACCEPTED, "T1", null), true));
        assertEquals(Resolution.ADDED_THEN_DELETED, Resolution.of(suggestion(Suggestion.Status.ACCEPTED, "T1", null), false));
        assertTrue(Resolution.ADDED_THEN_DELETED.restorable);
        assertFalse(Resolution.ADDED.restorable);
        // a GeoPulse stop alone has no payment to find its fill-up by
        assertEquals(Resolution.ADDED, Resolution.of(suggestion(Suggestion.Status.ACCEPTED, null, null), false));
    }

    @Test
    void anySortedTripCanComeBack() {
        assertEquals(Resolution.ON_VEHICLE, Resolution.of(trip(Trip.Status.ASSIGNED)));
        assertEquals(Resolution.NOT_MINE, Resolution.of(trip(Trip.Status.IGNORED)));
        assertTrue(Resolution.ON_VEHICLE.restorable && Resolution.NOT_MINE.restorable);
    }

    @Test
    void pendingOnesHaveNone() {
        assertNull(Resolution.of(suggestion(Suggestion.Status.PENDING, "T1", null), false));
        assertNull(Resolution.of(trip(Trip.Status.PENDING)));
    }
}
