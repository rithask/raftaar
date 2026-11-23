package com.raftaar.inbox;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** Which handled suggestions can go back to the Inbox. */
class RestoreTest {
    static Suggestion suggestion(Suggestion.Status status, String paymentId, String dismissReason) {
        Suggestion suggestion = new Suggestion();
        suggestion.status = status;
        suggestion.hisaabTxnId = paymentId;
        suggestion.dismissReason = dismissReason;
        return suggestion;
    }

    @Test
    void oneYouDismissedCanComeBack() {
        assertTrue(Suggestions.restorable(suggestion(Suggestion.Status.DISMISSED, "T1", Suggestions.DISMISSED_BY_YOU), false));
    }

    @Test
    void oneTheSyncDismissedCannot() {
        assertFalse(Suggestions.restorable(suggestion(Suggestion.Status.DISMISSED, "T1", "No longer in Hisaab (deleted or moved out of fuel)"), false));
    }

    @Test
    void oneYouAddedComesBackOnlyOnceItsRecordIsGone() {
        assertFalse(Suggestions.restorable(suggestion(Suggestion.Status.ACCEPTED, "T1", null), true));
        assertTrue(Suggestions.restorable(suggestion(Suggestion.Status.ACCEPTED, "T1", null), false));
        // a GeoPulse stop alone has no payment to find its fill-up by
        assertFalse(Suggestions.restorable(suggestion(Suggestion.Status.ACCEPTED, null, null), false));
    }

    @Test
    void onePendingIsAlreadyThere() {
        assertFalse(Suggestions.restorable(suggestion(Suggestion.Status.PENDING, "T1", null), false));
    }
}
