package com.raftaar.common;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import com.raftaar.notifications.Alerts;

@ConfigurationProperties("app")
public record AppProperties(Auth auth, Oidc oidc, Storage storage, GeoPulse geopulse, Hisaab hisaab, Osm osm,
                            FuelPriceSource fuelPrice, Apprise apprise, Alerts alerts, Push push) {

    /**
     * The account itself lives in the database: it's created on the onboarding page the first time the app is
     * opened. {@code username}/{@code password} only pre-create it instead (when there's no account yet).
     *
     * @param passwordLogin  false hides password sign-in; only honoured once OIDC is set up, so there's always a way in
     * @param resetPassword  a way back in: on start, sets the account's password to this (remove it afterwards)
     */
    public record Auth(String username, String password, Boolean passwordLogin, String resetPassword) {
        public boolean passwordLoginRequested() {
            return passwordLogin == null || passwordLogin;
        }
    }

    /**
     * Sign-in with an OpenID Connect provider such as Pocket ID. Who may sign in is decided at the provider; the app
     * links exactly one account by issuer + subject, the identifier OIDC guarantees is stable.
     *
     * @param providerName  shown on the sign-in button
     * @param autoRedirect  go straight to the provider from the sign-in page
     */
    public record Oidc(String issuerUri, String clientId, String clientSecret, String providerName, Boolean autoRedirect) {
        public boolean configured() {
            return notBlank(issuerUri) && notBlank(clientId);
        }

        public String name() {
            return notBlank(providerName) ? providerName.trim() : "Pocket ID";
        }
    }

    public record Storage(String dir) {}

    public record GeoPulse(String url, String token, Duration pollInterval, int importDays, String movementTypes, boolean autoAssign) {
        public boolean configured() { return notBlank(url) && notBlank(token); }
        public List<String> movementTypeList() { return list(movementTypes).stream().map(String::toUpperCase).toList(); }
    }

    public record Hisaab(String url, String token, Duration pollInterval, int importDays, String fuelCategories, String expenseCategories) {
        public boolean configured() { return notBlank(url) && notBlank(token); }
        public List<String> fuelCategoryList() { return list(fuelCategories); }
        public List<String> expenseCategoryList() { return list(expenseCategories); }
    }

    /**
     * OpenStreetMap lookups, each on only when its URL is set: Overpass names the fuel pump you stopped at,
     * Nominatim finds the state (for the fuel price). Nothing is sent anywhere unless you set one.
     */
    public record Osm(String overpassUrl, String nominatimUrl) {
        public boolean pumps() { return notBlank(overpassUrl); }
        public boolean places() { return notBlank(nominatimUrl); }
        public boolean enabled() { return pumps() || places(); }
    }

    public record FuelPriceSource(String url) {
        public boolean configured() { return notBlank(url); }
    }

    /**
     * Apprise runs inside Raftaar: the CLI is in the image. Channels (Apprise URLs) are managed in Settings;
     * APPRISE_URLS adds fixed ones from the environment.
     */
    public record Apprise(String binary, String urls) {
        public List<String> envUrls() {
            if (urls == null || urls.isBlank()) return List.of();
            return Arrays.stream(urls.split("[,\\s]+")).map(String::trim).filter(x -> !x.isEmpty()).toList();
        }
    }

    public record Alerts(String cron) {}

    /** @param contact who push services may contact about this server's pushes (a mailto: or https: address) */
    public record Push(String contact) {}

    static boolean notBlank(String text) { return text != null && !text.isBlank(); }

    static List<String> list(String text) {
        if (text == null || text.isBlank()) return List.of();
        return Arrays.stream(text.split(",")).map(String::trim).filter(x -> !x.isEmpty()).toList();
    }
}
