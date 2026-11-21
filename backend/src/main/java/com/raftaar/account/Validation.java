package com.raftaar.account;

/** Rules for the account's username and password; each returns what's wrong, or null when it's fine. */
final class Validation {
    private Validation() {}

    static String username(String name) {
        if (name == null || name.isBlank()) return "Choose a username";
        if (name.trim().length() > 64) return "Keep the username under 64 characters";
        if (name.trim().chars().anyMatch(Character::isWhitespace)) return "The username can't have spaces";
        return null;
    }

    static String password(String value) {
        if (value == null || value.length() < 8) return "Use at least 8 characters for the password";
        if (value.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) return "Keep the password under 72 characters"; // bcrypt's limit
        if (value.startsWith("{")) return "The password can't start with {";
        return null;
    }
}
