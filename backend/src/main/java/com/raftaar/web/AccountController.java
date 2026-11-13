package com.raftaar.web;

import com.raftaar.config.AppProperties;
import com.raftaar.config.OidcSupport;
import com.raftaar.config.SecurityConfig;
import com.raftaar.service.Account;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Settings → Account: the username and password, and which provider account is linked. */
@RestController
@RequestMapping("/api/account")
public class AccountController {
    private final Account account;
    private final AppProperties props;
    private final ObjectProvider<OidcSupport.LazyRegistrations> oidc;

    public AccountController(Account account, AppProperties props, ObjectProvider<OidcSupport.LazyRegistrations> oidc) {
        this.account = account;
        this.props = props;
        this.oidc = oidc;
    }

    /** {@code provider}: the OIDC provider's name, or null when OIDC isn't set up. */
    public record View(String username, boolean hasPassword, boolean passwordLogin, String provider, Account.Link link) {}

    @GetMapping
    public View view() {
        boolean on = oidc.getIfAvailable() != null;
        return new View(account.username().orElse(null), account.hasPassword(), SecurityConfig.passwordLoginEnabled(props),
                on ? props.oidc().name() : null, account.link());
    }

    public record UsernameIn(String username) {}

    @PutMapping("/username")
    public ResponseEntity<?> rename(@RequestBody UsernameIn in) {
        String problem = Validation.username(in.username());
        if (problem != null) return AuthController.error(400, problem);
        account.rename(in.username());
        return ResponseEntity.ok(view());
    }

    /** {@code current} is needed only when the account already has a password. */
    public record PasswordIn(String current, String password) {}

    @PutMapping("/password")
    public ResponseEntity<?> password(@RequestBody PasswordIn in) {
        if (account.hasPassword() && !account.passwordMatches(in.current())) return AuthController.error(400, "Your current password isn't right");
        String problem = Validation.password(in.password());
        if (problem != null) return AuthController.error(400, problem);
        account.setPassword(in.password());
        LoggerFactory.getLogger("com.raftaar.security").info("Password changed");
        return ResponseEntity.ok(view());
    }

    @DeleteMapping("/oidc-link")
    public View unlink() {
        account.unlink();
        LoggerFactory.getLogger("com.raftaar.security").info("{} account unlinked", props.oidc().name());
        return view();
    }
}
