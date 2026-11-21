package com.raftaar.common;

/** Small text helpers shared by every feature. */
public final class Text {
    private Text() {}

    /** The trimmed text, or null when there's nothing in it (so blank form fields are stored as null). */
    public static String trimToNull(String text) {
        return text == null || text.isBlank() ? null : text.trim();
    }

    /** The first value with something in it, trimmed; null when none has. */
    public static String firstNonBlank(String... values) {
        for (String value : values) if (value != null && !value.isBlank()) return value.trim();
        return null;
    }

    /** "1 fuel payment", "3 fuel payments". */
    public static String plural(int count, String noun) {
        return count + " " + noun + (count == 1 ? "" : "s");
    }
}
