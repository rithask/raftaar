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

    public Notifications(AppriseClient apprise, NotificationChannelRepo repo, AppProperties props) {
        this.apprise = apprise;
        this.repo = repo;
        this.cfg = props.apprise();
    }

    /** A channel as the browser sees it. {@code id} is null for one from APPRISE_URLS (read-only). */
    public record Channel(Long id, String label, String service, String masked, boolean enabled, boolean fromEnvironment,
                          Instant lastSentAt, Boolean lastOk, String lastError) {}

    /** Says at startup when Apprise is missing, since nothing can be sent without it. */
    @org.springframework.context.event.EventListener(org.springframework.boot.context.event.ApplicationReadyEvent.class)
    public void checkApprise() {
        String v = apprise.version();
        if (v != null) log.info("Notifications go out through {}", v);
        else if (configured()) log.warn("Apprise can't be run ({}), so notifications can't be sent. Use the Docker image, or set APPRISE_BIN.", cfg.binary());
        else log.info("Apprise isn't available ({}); notifications are off until it is", cfg.binary());
    }

    public boolean configured() {
        return !repo.findByEnabledTrueOrderByIdAsc().isEmpty() || !cfg.envUrls().isEmpty();
    }

    public List<Channel> channels() {
        List<Channel> out = new ArrayList<>();
        for (NotificationChannel c : repo.findAllByOrderByIdAsc()) {
            out.add(new Channel(c.id, c.label, service(c.url), mask(c.url), c.enabled, false, c.lastSentAt, c.lastOk, c.lastError));
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
        NotificationChannel c = new NotificationChannel();
        c.label = label == null || label.isBlank() ? null : label.trim();
        c.url = url;
        repo.save(c);
        log.info("Notification channel {} added ({})", name(c), service(url));
        return view(c);
    }

    public Channel update(Long id, String label, Boolean enabled) {
        NotificationChannel c = find(id);
        if (label != null) c.label = label.isBlank() ? null : label.trim();
        if (enabled != null && enabled != c.enabled) log.info("Notification channel {} turned {}", name(c), enabled ? "on" : "off");
        if (enabled != null) c.enabled = enabled;
        repo.save(c);
        return view(c);
    }

    public void delete(Long id) {
        NotificationChannel c = find(id);
        repo.delete(c);
        log.info("Notification channel {} removed", name(c));
    }

    /** Sends a test to one channel and remembers how it went. */
    public Channel test(Long id) {
        NotificationChannel c = find(id);
        if (deliver(c, "Raftaar", "Notifications from Raftaar work.", AppriseClient.Level.SUCCESS)) log.info("Test sent to {}", name(c));
        else log.warn("Test to {} failed: {}", name(c), c.lastError);
        return view(c);
    }

    public record Outcome(int sent, int failed, List<String> errors) {}

    /** Sends to every enabled channel. Throws only when nothing at all got through. */
    public Outcome send(String title, String body, AppriseClient.Level level) {
        int sent = 0, failed = 0;
        List<String> errors = new ArrayList<>();
        for (NotificationChannel c : repo.findByEnabledTrueOrderByIdAsc()) {
            if (deliver(c, title, body, level)) sent++;
            else {
                failed++;
                errors.add(name(c) + ": " + c.lastError);
            }
        }
        for (String url : cfg.envUrls()) {
            var r = apprise.send(url, title, body, level);
            if (r.ok()) sent++;
            else {
                failed++;
                errors.add(service(url) + " (APPRISE_URLS): " + r.output());
            }
        }
        if (sent == 0 && failed == 0) throw new IllegalStateException("No notification channels. Add one in Settings → Notifications.");
        if (sent == 0) throw new IllegalStateException("Every channel failed: " + String.join("; ", errors));
        if (failed > 0) log.warn("Some notification channels failed: {}", errors);
        log.debug("\"{}\" sent to {}", title, Text.plural(sent, "channel"));
        return new Outcome(sent, failed, errors);
    }

    private boolean deliver(NotificationChannel c, String title, String body, AppriseClient.Level level) {
        var r = apprise.send(c.url, title, body, level);
        c.lastSentAt = Instant.now();
        c.lastOk = r.ok();
        c.lastError = r.ok() ? null : (r.output().isBlank() ? "Failed" : r.output());
        repo.save(c);
        return r.ok();
    }

    private NotificationChannel find(Long id) {
        return repo.require(id, "Channel");
    }

    private Channel view(NotificationChannel c) {
        return new Channel(c.id, c.label, service(c.url), mask(c.url), c.enabled, false, c.lastSentAt, c.lastOk, c.lastError);
    }

    private static String name(NotificationChannel c) {
        return c.label != null ? c.label : service(c.url);
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
