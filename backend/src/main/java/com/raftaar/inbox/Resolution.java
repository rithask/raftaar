package com.raftaar.inbox;

/** What became of something in the Inbox once it was dealt with, and whether it can go back to the Inbox. */
public enum Resolution {
    /** Added as a fill-up or expense, which is still there (or, for a pump stop alone, can't be looked up). */
    ADDED(false),
    /** Added, but that fill-up or expense has since been deleted: it can be added again. */
    ADDED_THEN_DELETED(true),
    /** Dismissed by you. */
    DISMISSED(true),
    /** Dismissed by the sync, because its payment left Hisaab: there's nothing left to add. */
    DISMISSED_BY_SYNC(false),
    /** A trip put on a vehicle. */
    ON_VEHICLE(true),
    /** A trip that's not on any of your vehicles. */
    NOT_MINE(true);

    /** The reason a suggestion you dismissed yourself carries; the sync's own dismissals say why instead. */
    public static final String DISMISSED_BY_YOU = "Dismissed";

    public final boolean restorable;

    Resolution(boolean restorable) {
        this.restorable = restorable;
    }

    /** Null while it's still pending. {@code recordExists}: the fill-up or expense an added one became is still there. */
    public static Resolution of(Suggestion suggestion, boolean recordExists) {
        return switch (suggestion.status) {
            case PENDING -> null;
            case DISMISSED -> DISMISSED_BY_YOU.equals(suggestion.dismissReason) ? DISMISSED : DISMISSED_BY_SYNC;
            case ACCEPTED -> suggestion.hisaabTxnId != null && !recordExists ? ADDED_THEN_DELETED : ADDED;
        };
    }

    /** Null while it's still pending. */
    public static Resolution of(Trip trip) {
        return switch (trip.status) {
            case PENDING -> null;
            case ASSIGNED -> ON_VEHICLE;
            case IGNORED -> NOT_MINE;
        };
    }
}
