package com.raftaar.notifications;

import com.raftaar.common.AppProperties;
import com.raftaar.common.Text;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Where notifications go: Apprise URLs added in Settings (stored here), plus any fixed ones from APPRISE_URLS.
 * Each channel gets its own Apprise run, so one broken channel doesn't hide whether the others worked.
 * A URL usually contains a token, so it's never sent back to the browser in full.
 */
@Service
public class Notifications {
    private static final Logger log = LoggerFactory.getLogger(Notifications.class);

    private final AppriseClient apprise;
    private final NotificationChannelRepo repo;
    private final AppProperties.Apprise cfg;
    private final WebPush push;

    public Notifications(AppriseClient apprise, NotificationChannelRepo repo, AppProperties props, WebPush push) {
        this.apprise = apprise;
        this.repo = repo;
        this.cfg = props.apprise();
        this.push = push;
    }

    /** A channel as the browser sees it. {@code id} is null for one from APPRISE_URLS (read-only). */
    public record Channel(Long id, String label, String service, String masked, boolean enabled, boolean fromEnvironment,
                          Instant lastSentAt, Boolean lastOk, String lastError) {}

    /** Says at startup when Apprise is missing, since nothing can be sent without it. */
    @org.springframework.context.event.EventListener(org.springframework.boot.context.event.ApplicationReadyEvent.class)
    public void checkApprise() {
        String version = apprise.version();
        if (version != null) log.info("Notifications go out through {}", version);
        else if (configured()) log.warn("Apprise can't be run ({}), so notifications can't be sent. Use the Docker image, or set APPRISE_BIN.", cfg.binary());
        else log.info("Apprise isn't available ({}); notifications are off until it is", cfg.binary());
    }

    /** Somewhere to send to: an enabled channel, one from APPRISE_URLS, or a device with push notifications on. */
    public boolean configured() {
        return !repo.findByEnabledTrueOrderByIdAsc().isEmpty() || !cfg.envUrls().isEmpty() || push.any();
    }

    public List<Channel> channels() {
        List<Channel> out = new ArrayList<>();
        for (NotificationChannel channel : repo.findAllByOrderByIdAsc()) {
            out.add(new Channel(channel.id, channel.label, service(channel.url), mask(channel.url), channel.enabled, false, channel.lastSentAt, channel.lastOk, channel.lastError));
        }
        for (String url : cfg.envUrls()) {
            out.add(new Channel(null, "From APPRISE_URLS", service(url), mask(url), true, true, null, null, null));
        }
        return out;
    }

    public String appriseVersion() {
        return apprise.version();
    }

    public Channel add(String label, String url) {
        if (url == null || url.isBlank()) throw new IllegalArgumentException("Paste an Apprise URL, e.g. ntfys://ntfy.sh/your-topic");
        url = url.trim();
        if (!url.contains("://")) throw new IllegalArgumentException("That doesn't look like an Apprise URL (scheme://…)");
        var check = apprise.check(url);
        if (!check.ok()) throw new IllegalArgumentException("Apprise doesn't understand that URL" + (check.output().isBlank() ? "" : ": " + check.output()));
        NotificationChannel channel = new NotificationChannel();
        channel.label = label == null || label.isBlank() ? null : label.trim();
        channel.url = url;
        repo.save(channel);
        log.info("Notification channel {} added ({})", name(channel), service(url));
        return view(channel);
    }

    public Channel update(Long id, String label, Boolean enabled) {
        NotificationChannel channel = find(id);
        if (label != null) channel.label = label.isBlank() ? null : label.trim();
        if (enabled != null && enabled != channel.enabled) log.info("Notification channel {} turned {}", name(channel), enabled ? "on" : "off");
        if (enabled != null) channel.enabled = enabled;
        repo.save(channel);
        return view(channel);
    }

    public void delete(Long id) {
        NotificationChannel channel = find(id);
        repo.delete(channel);
        log.info("Notification channel {} removed", name(channel));
    }

    /** Sends a test to one channel and remembers how it went. */
    public Channel test(Long id) {
        NotificationChannel channel = find(id);
        if (deliver(channel, "Raftaar", "Notifications from Raftaar work.", AppriseClient.Level.SUCCESS)) log.info("Test sent to {}", name(channel));
        else log.warn("Test to {} failed: {}", name(channel), channel.lastError);
        return view(channel);
    }

    public record Outcome(int sent, int failed, List<String> errors) {}

    /**
     * Sends to every enabled channel and every device with push notifications on (where tapping it {@code opens} a page).
     * Throws only when nothing at all got through.
     */
    public Outcome send(String title, String body, AppriseClient.Level level, String opens) {
        int sent = 0, failed = 0;
        List<String> errors = new ArrayList<>();
        for (NotificationChannel channel : repo.findByEnabledTrueOrderByIdAsc()) {
            if (deliver(channel, title, body, level)) sent++;
            else {
                failed++;
                errors.add(name(channel) + ": " + channel.lastError);
            }
        }
        for (String url : cfg.envUrls()) {
            var result = apprise.send(url, title, body, level);
            if (result.ok()) sent++;
            else {
                failed++;
                errors.add(service(url) + " (APPRISE_URLS): " + result.output());
            }
        }
        var pushed = push.send(title, body, opens);
        sent += pushed.sent();
        failed += pushed.failed();
        errors.addAll(pushed.errors());
        if (sent == 0 && failed == 0) throw new IllegalStateException("No notification channels or devices. Add one in Settings → Notifications.");
        if (sent == 0) throw new IllegalStateException("Every channel failed: " + String.join("; ", errors));
        if (failed > 0) log.warn("Some notification channels failed: {}", errors);
        log.debug("\"{}\" sent to {} (channels and devices)", title, sent);
        return new Outcome(sent, failed, errors);
    }

    private boolean deliver(NotificationChannel channel, String title, String body, AppriseClient.Level level) {
        var result = apprise.send(channel.url, title, body, level);
        channel.lastSentAt = Instant.now();
        channel.lastOk = result.ok();
        channel.lastError = result.ok() ? null : (result.output().isBlank() ? "Failed" : result.output());
        repo.save(channel);
        return result.ok();
    }

    private NotificationChannel find(Long id) {
        return repo.require(id, "Channel");
    }

    private Channel view(NotificationChannel channel) {
        return new Channel(channel.id, channel.label, service(channel.url), mask(channel.url), channel.enabled, false, channel.lastSentAt, channel.lastOk, channel.lastError);
    }

    private static String name(NotificationChannel channel) {
        return channel.label != null ? channel.label : service(channel.url);
    }

    /** The scheme, e.g. "ntfys" or "tgram". */
    static String service(String url) {
        int i = url.indexOf("://");
        return i > 0 ? url.substring(0, i).toLowerCase() : "?";
    }

    /** {@code tgram://1234…cdef} — enough to tell channels apart, not enough to use one. */
    static String mask(String url) {
        int i = url.indexOf("://");
        if (i < 0) return "•••";
        String rest = url.substring(i + 3);
        if (rest.length() <= 8) return url.substring(0, i + 3) + "•••";
        return url.substring(0, i + 3) + rest.substring(0, 4) + "•••" + rest.substring(rest.length() - 3);
    }
}
