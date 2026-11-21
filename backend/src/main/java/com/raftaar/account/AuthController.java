package com.raftaar.account;

import com.raftaar.common.AppProperties;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/** Signing in: onboarding (creating the account), password, the OIDC provider, and linking a provider account. */
@RestController
@RequestMapping("/api")
public class AuthController {
    private static final Logger log = LoggerFactory.getLogger("com.raftaar.security");

    private final Account account;
    private final SecurityContextRepository contexts;
    private final AppProperties props;
    private final ObjectProvider<OidcSupport.LazyRegistrations> oidc;
    private final String version;

    public AuthController(Account account, SecurityContextRepository contexts, AppProperties props,
                          ObjectProvider<OidcSupport.LazyRegistrations> oidc, @Value("${app.version:dev}") String version) {
        this.account = account;
        this.contexts = contexts;
        this.props = props;
        this.oidc = oidc;
        this.version = version;
    }

    public record OidcOption(String name, String startUrl) {}

    /**
     * What the sign-in screen should offer. {@code setup}: there's no account yet, so show onboarding.
     * {@code passwordLogin}: offer the password form (or, during setup, creating the account with a password).
     */
    public record Options(boolean setup, boolean passwordLogin, OidcOption oidc, boolean autoRedirect) {}

    @GetMapping("/auth/options")
    public Options options() {
        boolean on = oidc.getIfAvailable() != null;
        boolean setup = !account.exists();
        boolean password = SecurityConfig.passwordLoginEnabled(props) && (setup || account.hasPassword() || !on);
        return new Options(setup, password, on ? new OidcOption(props.oidc().name(), "/api/auth/oidc") : null,
                on && !setup && !Boolean.FALSE.equals(props.oidc().autoRedirect()));
    }

    public record Setup(String username, String password) {}

    /** Onboarding: creates the account and signs in. Only works while there's no account. */
    @PostMapping("/auth/setup")
    public ResponseEntity<?> setup(@RequestBody Setup in, HttpServletRequest req, HttpServletResponse res) {
        if (account.exists()) return error(409, "Raftaar is already set up. Sign in instead.");
        if (!SecurityConfig.passwordLoginEnabled(props)) return error(403, "Password sign-in is turned off. Set up with " + props.oidc().name() + ".");
        String problem = Validation.username(in.username());
        if (problem == null) problem = Validation.password(in.password());
        if (problem != null) return error(400, problem);
        if (!account.create(in.username(), in.password())) return error(409, "Raftaar is already set up. Sign in instead.");
        Sessions.signIn(req, res, contexts, account.username().orElseThrow());
        return ResponseEntity.ok(Map.of("username", account.username().orElseThrow()));
    }

    public record Login(String username, String password) {}

    @PostMapping("/auth/login")
    public ResponseEntity<?> login(@RequestBody Login body, HttpServletRequest req, HttpServletResponse res) {
        if (!SecurityConfig.passwordLoginEnabled(props)) return error(403, "Password sign-in is turned off. Use " + props.oidc().name() + ".");
        if (!account.passwordMatches(body.username(), body.password())) {
            log.warn("Password sign-in failed for \"{}\" from {}", body.username(), req.getRemoteAddr());
            return error(401, "Wrong username or password");
        }
        String name = account.username().orElseThrow();
        Sessions.signIn(req, res, contexts, name);
        log.info("Signed in with password as \"{}\" from {}", name, req.getRemoteAddr());
        return ResponseEntity.ok(Map.of("username", name));
    }

    /** Starts OIDC sign-in, or comes back with a readable error if the provider can't be reached. */
    @GetMapping("/auth/oidc")
    public void startOidc(HttpServletResponse res) throws IOException {
        var r = oidc.getIfAvailable();
        if (r == null) res.sendRedirect(Sessions.loginError("Sign-in with an identity provider isn't set up."));
        else if (!r.reachable()) res.sendRedirect(Sessions.loginError(props.oidc().name() + " can't be reached right now."));
        else res.sendRedirect("/oauth2/authorization/" + OidcSupport.REGISTRATION_ID);
    }

    // ---- linking a first-time provider sign-in to the account ---------------------------------------------------

    public record PendingLink(String email, String name, String provider, String username, boolean passwordRequired) {}

    /** The provider account waiting to be linked, if the last OIDC sign-in stopped to ask. */
    @GetMapping("/auth/link")
    public ResponseEntity<?> pendingLink(HttpServletRequest req) {
        var p = pending(req);
        if (p == null || !account.exists()) return error(404, "Nothing is waiting to be linked");
        return ResponseEntity.ok(new PendingLink(p.email(), p.name(), props.oidc().name(), account.username().orElseThrow(), passwordRequired()));
    }

    public record LinkIn(String password) {}

    /** Links the waiting provider account and signs in. Needs the account's password while password sign-in is on. */
    @PostMapping("/auth/link")
    public ResponseEntity<?> confirmLink(@RequestBody(required = false) LinkIn in, HttpServletRequest req, HttpServletResponse res) {
        var p = pending(req);
        if (p == null || !account.exists()) return error(400, "Nothing is waiting to be linked. Sign in with " + props.oidc().name() + " again.");
        if (account.linkedId() != null) return error(409, "Another account is already linked.");
        if (passwordRequired() && !account.passwordMatches(in == null ? null : in.password())) {
            log.warn("Linking {} refused: wrong password", p.email());
            return error(401, "That's not your Raftaar password");
        }
        account.link(p);
        req.getSession().removeAttribute(Account.PENDING);
        String name = account.username().orElseThrow();
        Sessions.signIn(req, res, contexts, name);
        return ResponseEntity.ok(Map.of("username", name));
    }

    @PostMapping("/auth/link/cancel")
    public void cancelLink(HttpServletRequest req) {
        var s = req.getSession(false);
        if (s != null) s.removeAttribute(Account.PENDING);
    }

    /** Who's signed in; {@code username} is null when nobody is (a plain answer, not a 401, for the sign-in screen). */
    @GetMapping("/auth/me")
    public Map<String, Object> me(Authentication a) {
        boolean in = a != null && a.getAuthorities().stream().anyMatch(g -> "ROLE_OWNER".equals(g.getAuthority()));
        var out = new HashMap<String, Object>();
        out.put("username", in ? account.username().orElse(a.getName()) : null);
        return out;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok", "version", version);
    }

    private boolean passwordRequired() {
        return SecurityConfig.passwordLoginEnabled(props) && account.hasPassword();
    }

    private static Account.Pending pending(HttpServletRequest req) {
        var s = req.getSession(false);
        return s == null ? null : (Account.Pending) s.getAttribute(Account.PENDING);
    }

    static ResponseEntity<Map<String, String>> error(int status, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message));
    }
}
