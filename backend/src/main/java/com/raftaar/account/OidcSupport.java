package com.raftaar.account;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.ClientRegistrations;
import com.raftaar.common.AppProperties;

/**
 * OpenID Connect sign-in (e.g. Pocket ID), done the standard way: the provider is discovered from its issuer URL,
 * the authorization-code flow uses PKCE, and the user is identified by issuer + subject. Who may sign in is the
 * provider's decision; the app links one account (see SecurityConfig and Account). Same as Hisaab.
 */
public final class OidcSupport {
    public static final String REGISTRATION_ID = "oidc";
    private static final Logger log = LoggerFactory.getLogger(OidcSupport.class);

    private OidcSupport() {}

    /**
     * Looks the provider up (/.well-known/openid-configuration) on first use rather than at startup, so the app
     * still starts while the provider is down, and retries on the next sign-in if discovery failed.
     */
    public static final class LazyRegistrations implements ClientRegistrationRepository {
        private final AppProperties.Oidc cfg;
        private volatile ClientRegistration registration;

        public LazyRegistrations(AppProperties.Oidc cfg) {
            this.cfg = cfg;
        }

        @Override
        public ClientRegistration findByRegistrationId(String id) {
            if (!REGISTRATION_ID.equals(id)) return null;
            ClientRegistration current = registration;
            if (current != null) return current;
            synchronized (this) {
                if (registration == null) {
                    registration = ClientRegistrations.fromIssuerLocation(cfg.issuerUri().trim())
                            .registrationId(REGISTRATION_ID)
                            .clientId(cfg.clientId().trim())
                            .clientSecret(cfg.clientSecret() == null ? null : cfg.clientSecret().trim())
                            .clientName(cfg.name())
                            .scope("openid", "profile", "email")
                            // PKCE for the code exchange, as recommended for every client (RFC 9700), not just public ones
                            .clientSettings(ClientRegistration.ClientSettings.builder().requireProofKey(true).build())
                            .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                            .userNameAttributeName("sub")
                            .build();
                    log.info("OIDC provider {} discovered at {}", cfg.name(), cfg.issuerUri());
                }
                return registration;
            }
        }

        /** True when the provider answers discovery; used to fail gracefully before redirecting. */
        public boolean reachable() {
            try {
                return findByRegistrationId(REGISTRATION_ID) != null;
            } catch (RuntimeException e) {
                log.warn("OIDC provider {} unreachable at {}: {}", cfg.name(), cfg.issuerUri(), e.toString());
                return false;
            }
        }
    }
}
