package com.raftaar.settings;

import com.raftaar.common.AppProperties;
import com.raftaar.common.SyncLog;
import com.raftaar.geopulse.GeoPulseSync;
import com.raftaar.hisaab.HisaabSync;
import com.raftaar.notifications.Alerts;
import com.raftaar.notifications.Notifications;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

/** The outside services Raftaar talks to: whether each is set up, how it last went, and running one now. */
@Service
public class Integrations {
    private final AppProperties props;
    private final SyncLog syncLog;
    private final GeoPulseSync geopulse;
    private final HisaabSync hisaab;
    private final Alerts alerts;
    private final Notifications notifications;

    public Integrations(AppProperties props, SyncLog syncLog, GeoPulseSync geopulse, HisaabSync hisaab, Alerts alerts, Notifications notifications) {
        this.props = props;
        this.syncLog = syncLog;
        this.geopulse = geopulse;
        this.hisaab = hisaab;
        this.alerts = alerts;
        this.notifications = notifications;
    }

    /** {@code target}: the host it talks to (never the full URL, which may hold a token). */
    public record Integration(String name, boolean configured, String target, SyncLog.Status status, Map<String, Object> options) {}

    public List<Integration> all() {
        var geo = props.geopulse();
        var money = props.hisaab();
        var osm = props.osm();
        return List.of(
                new Integration(GeoPulseSync.NAME, geo.configured(), host(geo.url()), syncLog.status(GeoPulseSync.NAME),
                        Map.of("pollInterval", geo.pollInterval().toString(), "movementTypes", geo.movementTypeList(), "autoAssign", geo.autoAssign())),
                new Integration(HisaabSync.NAME, money.configured(), host(money.url()), syncLog.status(HisaabSync.NAME),
                        Map.of("pollInterval", money.pollInterval().toString(), "fuelCategories", money.fuelCategoryList(),
                                "expenseCategories", money.expenseCategoryList())),
                new Integration(Alerts.NAME, notifications.configured(), null, syncLog.status(Alerts.NAME), Map.of("cron", props.alerts().cron())),
                new Integration("osm", osm.enabled(), osmTarget(), new SyncLog.Status(null, null, null, null, false),
                        Map.of("pumps", osm.pumps(), "places", osm.places(), "priceSource", props.fuelPrice().configured())));
    }

    /** Runs a sync or the reminder check now; what it did, in a line. */
    public String run(String name) {
        return switch (name) {
            case GeoPulseSync.NAME -> geopulse.run();
            case HisaabSync.NAME -> hisaab.run();
            case Alerts.NAME -> alerts.run();
            default -> throw new NoSuchElementException("Integration not found");
        };
    }

    /** Which OpenStreetMap services are used, e.g. "pumps: overpass-api.de · state: nominatim.openstreetmap.org". */
    private String osmTarget() {
        var osm = props.osm();
        var parts = new ArrayList<String>();
        if (osm.pumps()) parts.add("pumps: " + host(osm.overpassUrl()));
        if (osm.places()) parts.add("state: " + host(osm.nominatimUrl()));
        return parts.isEmpty() ? null : String.join(" · ", parts);
    }

    private static String host(String url) {
        if (url == null || url.isBlank()) return null;
        try {
            return URI.create(url).getHost();
        } catch (IllegalArgumentException malformed) {
            return null;
        }
    }
}
