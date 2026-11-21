package com.raftaar.notifications;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class NotificationsTest {
    @Test
    void masksTheSecretPartOfAUrl() {
        assertEquals("tgram://1234•••def", Notifications.mask("tgram://123456789:AAbbCCdd/987654321abcdef"));
        assertEquals("ntfys://•••", Notifications.mask("ntfys://short"));
        assertFalse(Notifications.mask("discord://webhookid/supersecrettoken").contains("supersecret"));
        assertEquals("tgram", Notifications.service("TGRAM://x/y"));
    }
}
