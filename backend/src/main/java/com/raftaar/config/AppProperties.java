package com.raftaar.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;

@ConfigurationProperties("app")
public record AppProperties(Auth auth, Storage storage, GeoPulse geopulse, Hisaab hisaab, Osm osm,
                            FuelPriceSource fuelPrice, Apprise apprise, Alerts alerts) {

    public record Auth(String username, String password) {}

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

    public record Osm(boolean enabled, String overpassUrl, String nominatimUrl) {}

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

    static boolean notBlank(String s) { return s != null && !s.isBlank(); }

    static List<String> list(String s) {
        if (s == null || s.isBlank()) return List.of();
        return Arrays.stream(s.split(",")).map(String::trim).filter(x -> !x.isEmpty()).toList();
    }
}
