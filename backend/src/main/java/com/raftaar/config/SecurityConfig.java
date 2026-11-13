package com.raftaar.config;

import com.raftaar.service.Account;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;

/**
 * One account, session cookie, signed in with a password or an OIDC provider. CSRF protection relies on the
 * cookie being SameSite=Lax (application.yml): browsers don't send it on cross-site POST/PUT/DELETE, and every
 * change here is one of those. Same approach as Hisaab.
 */
@Configuration
public class SecurityConfig {
    private static final Logger log = LoggerFactory.getLogger("com.raftaar.security");

    @Bean
    SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    /** Present only when OIDC is configured. */
    @Bean
    @ConditionalOnExpression("'${app.oidc.issuer-uri:}' != '' and '${app.oidc.client-id:}' != ''")
    OidcSupport.LazyRegistrations oidcRegistrations(AppProperties props) {
        return new OidcSupport.LazyRegistrations(props.oidc());
    }

    /** Password sign-in can only be turned off when OIDC is configured, so there's always a way in. */
    public static boolean passwordLoginEnabled(AppProperties props) {
        return props.auth().passwordLoginRequested() || props.oidc() == null || !props.oidc().configured();
    }

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http, SecurityContextRepository repo, AppProperties props, Account account,
                                    ObjectProvider<OidcSupport.LazyRegistrations> oidc) throws Exception {
        OidcSupport.LazyRegistrations registrations = oidc.getIfAvailable();
        if (registrations != null) {
            String provider = props.oidc().name();
            http.oauth2Login(o -> o
                    .clientRegistrationRepository(registrations)
                    .loginPage("/")
                    .successHandler((req, res, auth) -> {
                        // The provider said who this is; whether they get in is decided here.
                        var user = (OidcUser) auth.getPrincipal();
                        var who = new Account.Pending(user.getIssuer() + "|" + user.getSubject(), user.getEmail(), user.getFullName());
                        String linked = account.linkedId();
                        Sessions.drop(req);
                        if (!account.exists()) {
                            // First visit, set up by signing in with the provider: that account becomes the owner.
                            if (account.createFromProvider(who, usernameFor(user))) {
                                Sessions.signIn(req, res, repo, account.username().orElseThrow());
                                res.sendRedirect("/");
                                return;
                            }
                            linked = account.linkedId(); // someone else finished setting up a moment ago
                        }
                        if (who.id().equals(linked)) {
                            Sessions.signIn(req, res, repo, account.username().orElseThrow());
                            log.info("Signed in with {} as {}", provider, who.email() == null ? who.id() : who.email());
                            res.sendRedirect("/");
                        } else if (linked != null) {
                            log.warn("{} sign-in refused for {}: a different account is linked", provider, who.email());
                            res.sendRedirect(Sessions.loginError("A different " + provider + " account is linked to Raftaar. Unlink it in Settings first."));
                        } else {
                            // An account exists but no provider account is linked yet: ask before linking this one.
                            req.getSession(true).setAttribute(Account.PENDING, who);
                            res.sendRedirect("/?link");
                        }
                    })
                    .failureHandler((req, res, ex) -> {
                        String why = ex instanceof OAuth2AuthenticationException oe && oe.getError().getDescription() != null
                                ? oe.getError().getDescription() : ex.getMessage();
                        log.warn("{} sign-in failed: {}", provider, why);
                        res.sendRedirect(Sessions.loginError(provider + ": " + why));
                    }));
        }
        http.csrf(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .securityContext(s -> s.securityContextRepository(repo))
                .authorizeHttpRequests(a -> a
                        .requestMatchers("/api/auth/**", "/api/health").permitAll()
                        .requestMatchers("/api/**").hasRole("OWNER")
                        .anyRequest().permitAll())
                .exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .logout(l -> l.logoutUrl("/api/auth/logout").logoutSuccessHandler((req, res, auth) -> res.setStatus(200)));
        return http.build();
    }

    /** The username for an account set up by signing in with the provider. */
    private static String usernameFor(OidcUser user) {
        for (String s : new String[]{user.getPreferredUsername(), user.getEmail(), user.getGivenName()}) {
            if (s != null && !s.isBlank()) return s.trim();
        }
        return "owner";
    }
}
