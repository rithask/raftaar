package com.raftaar.account;

import com.raftaar.common.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.io.Serializable;
import java.time.Instant;
import java.util.Optional;
import com.raftaar.common.Settings;

/**
 * The one account that owns this Raftaar, kept in app_setting. It's created on the onboarding page the first time
 * the app is opened (or from APP_USERNAME/APP_PASSWORD), with a password, or with no password when it's created by
 * signing in with the OIDC provider. At most one provider account is linked to it, identified by issuer + subject.
 */
@Service
public class Account implements org.springframework.beans.factory.SmartInitializingSingleton {
    /** Session attribute: a provider account that signed in but still needs linking. */
    public static final String PENDING = "raftaar.oidc.pending";

    private static final String USERNAME = "account.username", PASSWORD = "account.password", CREATED = "account.created_at";
    private static final String LINK_ID = "oidc.link.id", LINK_EMAIL = "oidc.link.email", LINK_AT = "oidc.link.at";
    private static final Logger log = LoggerFactory.getLogger("com.raftaar.security");

    private final Settings settings;
    private final PasswordEncoder encoder;
    private final AppProperties props;

    public Account(Settings settings, PasswordEncoder encoder, AppProperties props) {
        this.settings = settings;
        this.encoder = encoder;
        this.props = props;
    }

    /** A provider account waiting to be linked; kept in the browser session only. */
    public record Pending(String id, String email, String name) implements Serializable {}

    public record Link(boolean linked, String email, Instant linkedAt) {}

    public boolean exists() {
        return username().isPresent();
    }

    public Optional<String> username() {
        return settings.get(USERNAME);
    }

    public boolean hasPassword() {
        return settings.get(PASSWORD).isPresent();
    }

    public boolean passwordMatches(String username, String raw) {
        Optional<String> name = username();
        Optional<String> hash = settings.get(PASSWORD);
        if (name.isEmpty() || hash.isEmpty() || raw == null) return false;
        // compare the password even when the username is wrong, so both take the same time
        boolean ok = encoder.matches(raw, hash.get());
        return ok && name.get().equalsIgnoreCase(username == null ? "" : username.trim());
    }

    public boolean passwordMatches(String raw) {
        return username().map(u -> passwordMatches(u, raw)).orElse(false);
    }

    /** Creates the account; false if one already exists (the onboarding page can only be used once). */
    public synchronized boolean create(String username, String rawPassword) {
        if (exists()) return false;
        settings.set(USERNAME, username.trim());
        settings.set(PASSWORD, rawPassword == null ? "" : encode(rawPassword));
        settings.set(CREATED, Instant.now().toString());
        log.info("Account \"{}\" created{}", username.trim(), rawPassword == null ? " by signing in with " + props.oidc().name() : "");
        return true;
    }

    /** Creates the account from a first sign-in with the provider and links that provider account to it. */
    public synchronized boolean createFromProvider(Pending p, String username) {
        if (!create(username, null)) return false;
        link(p);
        return true;
    }

    public void setPassword(String rawPassword) {
        settings.set(PASSWORD, encode(rawPassword));
    }

    public void rename(String username) {
        settings.set(USERNAME, username.trim());
    }

    // ---- the linked provider account -------------------------------------------------------------------------

    public String linkedId() {
        return settings.get(LINK_ID).orElse(null);
    }

    public Link link() {
        String id = linkedId();
        return new Link(id != null, id == null ? null : settings.get(LINK_EMAIL).orElse(null),
                id == null ? null : settings.instant(LINK_AT).orElse(null));
    }

    public void link(Pending p) {
        settings.set(LINK_ID, p.id());
        settings.set(LINK_EMAIL, p.email() == null ? "" : p.email());
        settings.set(LINK_AT, Instant.now().toString());
        log.info("{} account {} linked", props.oidc().name(), p.email() == null ? p.id() : p.email());
    }

    public void unlink() {
        settings.set(LINK_ID, "");
        settings.set(LINK_EMAIL, "");
        settings.set(LINK_AT, "");
    }

    /**
     * On start, before the web server takes any request: create the account from APP_USERNAME/APP_PASSWORD if
     * there's none yet, and apply RESET_PASSWORD. (Doing it later would leave a moment where the onboarding page is
     * open and someone else could create the account first.) Both accept a plain password or a pre-encoded one like
     * {bcrypt}$2a$...
     */
    @Override
    public void afterSingletonsInstantiated() {
        fromEnvironment();
    }

    void fromEnvironment() {
        var auth = props.auth();
        // the settings first: with neither set this doesn't touch the database (so the image's AOT training run needs none)
        if (notBlank(auth.password()) && !exists()) {
            create(notBlank(auth.username()) ? auth.username() : "admin", auth.password());
            log.info("Account created from APP_USERNAME/APP_PASSWORD; those can now be removed from .env");
        }
        if (notBlank(auth.resetPassword())) {
            if (exists()) {
                setPassword(auth.resetPassword());
                log.warn("Password for \"{}\" replaced from RESET_PASSWORD. Remove RESET_PASSWORD from .env now.", username().orElseThrow());
            } else {
                log.warn("RESET_PASSWORD is set but there's no account yet; open the app to create one.");
            }
        }
    }

    private String encode(String raw) {
        return raw.startsWith("{") ? raw : encoder.encode(raw);
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
