package com.raftaar.notifications;

import com.raftaar.common.AppProperties;
import com.raftaar.common.Settings;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.GeneralSecurityException;
import java.security.KeyPair;
import java.security.PrivateKey;
import java.security.interfaces.ECPublicKey;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Notifications to phones and browsers by Web Push, alongside Apprise's channels. A browser that turns them on sends
 * its push address and keys ({@link #subscribe}); each message is encrypted for it and posted to its push service
 * (Google's, Apple's, Mozilla's…), which wakes the app's service worker to show it. A device whose push service
 * says it's gone (it was uninstalled, or turned off) is forgotten.
 *
 * The server's own keys (VAPID) are made the first time they're needed and kept in the settings.
 */
@Service
public class WebPush {
    private static final Logger log = LoggerFactory.getLogger(WebPush.class);
    private static final String PRIVATE_KEY = "push.vapidPrivateKey";
    private static final String PUBLIC_KEY = "push.vapidPublicKey";
    /** How long a push service keeps trying a phone that's off: a day's reminders are still worth it the next morning. */
    private static final Duration KEEP_FOR = Duration.ofDays(1);

    public record Outcome(int sent, int failed, List<String> errors) {}

    private final PushSubscriptionRepo subscriptions;
    private final Settings settings;
    private final String contact;
    private final ObjectMapper json;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    public WebPush(PushSubscriptionRepo subscriptions, Settings settings, AppProperties props, ObjectMapper json) {
        this.subscriptions = subscriptions;
        this.settings = settings;
        this.contact = props.push() == null || props.push().contact() == null ? "https://github.com/rithask/raftaar" : props.push().contact();
        this.json = json;
    }

    /** The server's public key, for a browser to subscribe with (made the first time it's asked for). */
    public synchronized String publicKey() {
        return settings.get(PUBLIC_KEY).orElseGet(() -> {
            try {
                KeyPair keys = PushCrypto.newKeyPair();
                String publicKey = PushCrypto.base64(PushCrypto.uncompressed((ECPublicKey) keys.getPublic()));
                settings.set(PRIVATE_KEY, PushCrypto.base64(keys.getPrivate().getEncoded()));
                settings.set(PUBLIC_KEY, publicKey);
                log.info("Made the server's keys for push notifications");
                return publicKey;
            } catch (GeneralSecurityException e) {
                throw new IllegalStateException("Couldn't make the keys for push notifications", e);
            }
        });
    }

    public List<PushSubscription> devices() {
        return subscriptions.findAllByOrderByIdAsc();
    }

    public boolean any() {
        return subscriptions.count() > 0;
    }

    /** Turns notifications on for a browser (again, if it already was: its keys may have changed). */
    public PushSubscription subscribe(String endpoint, String p256dh, String auth, String label) {
        URI address = URI.create(endpoint);
        if (!"https".equals(address.getScheme()) || address.getHost() == null) throw new IllegalArgumentException("That isn't a push address");
        try {
            if (PushCrypto.unbase64(auth).length < 16) throw new IllegalArgumentException("That device's keys aren't right");
            PushCrypto.publicKey(PushCrypto.unbase64(p256dh));
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalArgumentException("That device's keys aren't right");
        }
        PushSubscription device = subscriptions.findByEndpoint(endpoint).orElseGet(PushSubscription::new);
        boolean isNew = device.id == null;
        device.endpoint = endpoint;
        device.p256dh = p256dh;
        device.auth = auth;
        device.label = label == null || label.isBlank() ? "A browser" : label.strip();
        subscriptions.save(device);
        if (isNew) log.info("Push notifications on for {} ({})", device.label, address.getHost());
        return device;
    }

    public void remove(Long id) {
        subscriptions.findById(id).ifPresent(device -> {
            subscriptions.delete(device);
            log.info("Push notifications off for {}", device.label);
        });
    }

    /** To every device; {@code url} is what tapping the notification opens. */
    public Outcome send(String title, String body, String url) {
        int sent = 0, failed = 0;
        var errors = new ArrayList<String>();
        for (PushSubscription device : subscriptions.findAllByOrderByIdAsc()) {
            if (deliver(device, title, body, url)) sent++;
            else if (device.id != null) {
                failed++;
                errors.add(device.label + ": " + device.lastError);
            }
        }
        return new Outcome(sent, failed, errors);
    }

    /** To one device, to check it works: the device with how it went (lastOk, lastError), as a channel's test does. */
    public PushSubscription test(Long id) {
        PushSubscription device = subscriptions.require(id, "Device");
        deliver(device, "Raftaar", "Notifications on this device work.", "/settings/notifications");
        if (device.id == null) throw new IllegalStateException("That device has turned notifications off, so it's been taken off the list");
        return device;
    }

    /** True when the push service took it. A device it says is gone is forgotten (and its id cleared). */
    private boolean deliver(PushSubscription device, String title, String body, String url) {
        String host = URI.create(device.endpoint).getHost();
        try {
            byte[] message = json.writeValueAsBytes(Map.of("title", title, "body", body, "url", url));
            byte[] sealed = PushCrypto.encrypt(message, PushCrypto.unbase64(device.p256dh), PushCrypto.unbase64(device.auth));
            var request = HttpRequest.newBuilder(URI.create(device.endpoint))
                    .timeout(Duration.ofSeconds(15))
                    .header("TTL", String.valueOf(KEEP_FOR.toSeconds()))
                    .header("Content-Encoding", "aes128gcm")
                    .header("Content-Type", "application/octet-stream")
                    .header("Authorization", PushCrypto.vapidHeader(device.endpoint, contact, serverKey(), PushCrypto.unbase64(publicKey()), Instant.now()))
                    .POST(HttpRequest.BodyPublishers.ofByteArray(sealed))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            int status = response.statusCode();
            log.debug("Push to {} ({}): {}", device.label, host, status);
            if (status == 404 || status == 410) {
                subscriptions.delete(device);
                log.info("{} no longer takes push notifications (its push service says {}); forgotten", device.label, status);
                device.id = null;
                return false;
            }
            return record(device, status / 100 == 2, status / 100 == 2 ? null : "The push service answered " + status + bodyOf(response));
        } catch (IOException e) {
            return record(device, false, "Couldn't reach its push service (" + host + ")");
        } catch (GeneralSecurityException e) {
            return record(device, false, "Couldn't encrypt for it: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return record(device, false, "Interrupted");
        }
    }

    private boolean record(PushSubscription device, boolean ok, String error) {
        device.lastSentAt = Instant.now();
        device.lastOk = ok;
        device.lastError = error;
        subscriptions.save(device);
        if (!ok) log.warn("Push to {} failed: {}", device.label, error);
        return ok;
    }

    private PrivateKey serverKey() throws GeneralSecurityException {
        publicKey(); // makes the pair if there isn't one
        return PushCrypto.privateKeyFromPkcs8(PushCrypto.unbase64(settings.get(PRIVATE_KEY).orElseThrow()));
    }

    private static String bodyOf(HttpResponse<String> response) {
        String text = response.body() == null ? "" : response.body().strip();
        return text.isEmpty() ? "" : ": " + (text.length() > 200 ? text.substring(0, 200) + "…" : text);
    }
}
