package com.raftaar.settings;

import com.raftaar.common.AppProperties;
import com.raftaar.fuel.FuelPrice;
import com.raftaar.fuel.FuelType;
import com.raftaar.fuel.FuelPriceRepo;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import com.raftaar.notifications.Alerts;
import com.raftaar.common.ApiErrors;
import com.raftaar.fuel.FuelPrices;
import com.raftaar.geopulse.GeoPulseSync;
import com.raftaar.hisaab.HisaabSync;
import com.raftaar.notifications.Notifications;
import com.raftaar.places.Places;
import com.raftaar.common.SyncLog;

/** Integration status and "run now", notification test, and fuel prices by state. */
@RestController
@RequestMapping("/api")
public class SettingsController {
    private final AppProperties props;
    private final SyncLog syncLog;
    private final GeoPulseSync geopulse;
    private final HisaabSync hisaab;
    private final Alerts alerts;
    private final Notifications notifications;
    private final FuelPrices prices;
    private final FuelPriceRepo priceRepo;
    private final Places places;

    public SettingsController(AppProperties props, SyncLog syncLog, GeoPulseSync geopulse, HisaabSync hisaab, Alerts alerts,
                              Notifications notifications, FuelPrices prices, FuelPriceRepo priceRepo, Places places) {
        this.props = props;
        this.syncLog = syncLog;
        this.geopulse = geopulse;
        this.hisaab = hisaab;
        this.alerts = alerts;
        this.notifications = notifications;
        this.prices = prices;
        this.priceRepo = priceRepo;
        this.places = places;
    }

    public record Integration(String name, boolean configured, String target, SyncLog.Status status, Map<String, Object> options) {}

    @GetMapping("/integrations")
    public List<Integration> integrations() {
        var g = props.geopulse();
        var h = props.hisaab();
        return List.of(
                new Integration(GeoPulseSync.NAME, g.configured(), host(g.url()), syncLog.status(GeoPulseSync.NAME),
                        Map.of("pollInterval", g.pollInterval().toString(), "movementTypes", g.movementTypeList(), "autoAssign", g.autoAssign())),
                new Integration(HisaabSync.NAME, h.configured(), host(h.url()), syncLog.status(HisaabSync.NAME),
                        Map.of("pollInterval", h.pollInterval().toString(), "fuelCategories", h.fuelCategoryList(),
                                "expenseCategories", h.expenseCategoryList())),
                new Integration(Alerts.NAME, notifications.configured(), null, syncLog.status(Alerts.NAME), Map.of("cron", props.alerts().cron())),
                new Integration("osm", props.osm().enabled(), osmTarget(), new SyncLog.Status(null, null, null, null, false),
                        Map.of("pumps", props.osm().pumps(), "places", props.osm().places(), "priceSource", props.fuelPrice().configured())));
    }

    /** Which OpenStreetMap services are used, e.g. "pumps: overpass-api.de · state: nominatim.openstreetmap.org". */
    private String osmTarget() {
        var o = props.osm();
        var parts = new java.util.ArrayList<String>();
        if (o.pumps()) parts.add("pumps: " + host(o.overpassUrl()));
        if (o.places()) parts.add("state: " + host(o.nominatimUrl()));
        return parts.isEmpty() ? null : String.join(" · ", parts);
    }

    @PostMapping("/integrations/{name}/run")
    public Map<String, String> run(@PathVariable String name) {
        String result = switch (name) {
            case GeoPulseSync.NAME -> geopulse.run();
            case HisaabSync.NAME -> hisaab.run();
            case Alerts.NAME -> alerts.run();
            default -> throw ApiErrors.notFound("Integration");
        };
        return Map.of("result", result);
    }

    // ---- notification channels (Apprise URLs) ------------------------------------------------------------------

    public record ChannelList(String apprise, List<Notifications.Channel> channels) {}

    @GetMapping("/notifications/channels")
    public ChannelList channels() {
        return new ChannelList(notifications.appriseVersion(), notifications.channels());
    }

    public record ChannelInput(String label, String url, Boolean enabled) {}

    @PostMapping("/notifications/channels")
    public Notifications.Channel addChannel(@RequestBody ChannelInput in) {
        return notifications.add(in.label(), in.url());
    }

    @PutMapping("/notifications/channels/{id}")
    public Notifications.Channel updateChannel(@PathVariable Long id, @RequestBody ChannelInput in) {
        return notifications.update(id, in.label(), in.enabled());
    }

    @DeleteMapping("/notifications/channels/{id}")
    public void deleteChannel(@PathVariable Long id) {
        notifications.delete(id);
    }

    @PostMapping("/notifications/channels/{id}/test")
    public Notifications.Channel testChannel(@PathVariable Long id) {
        return notifications.test(id);
    }

    // ---- fuel prices ------------------------------------------------------------------------------------------

    @GetMapping("/fuel-prices")
    public List<FuelPrice> latestPrices() {
        return priceRepo.latest();
    }

    /** For the fill-up form: the price where you are (pass lat/lon) or in a state. */
    @GetMapping("/fuel-prices/quote")
    public Map<String, Object> quote(@RequestParam(required = false) String region, @RequestParam(required = false) String district,
                                     @RequestParam(required = false) Double lat, @RequestParam(required = false) Double lon,
                                     @RequestParam(required = false) FuelType fuelType, @RequestParam(required = false) Long vehicleId) {
        if (region == null && lat != null && lon != null) {
            var r = places.region(lat, lon);
            if (r.isPresent()) {
                region = r.get().state();
                district = r.get().district();
            }
        }
        var q = prices.current(region, district, fuelType, vehicleId);
        var out = new java.util.HashMap<String, Object>();
        out.put("region", region);
        out.put("district", district);
        out.put("quote", q.orElse(null));
        return out;
    }

    public record PriceInput(String region, String district, FuelType fuelType, BigDecimal price, Instant effectiveAt) {}

    @PostMapping("/fuel-prices")
    public FuelPrice setPrice(@RequestBody PriceInput in) {
        if (in.region() == null || in.region().isBlank()) throw new IllegalArgumentException("Which state?");
        if (in.price() == null || in.price().signum() <= 0) throw new IllegalArgumentException("Enter the price");
        return prices.record(in.region(), in.district(), in.fuelType() != null ? in.fuelType() : FuelType.PETROL, in.price(),
                in.effectiveAt() != null ? in.effectiveAt() : Instant.now(), FuelPrice.Source.MANUAL);
    }

    @DeleteMapping("/fuel-prices/{id}")
    public void deletePrice(@PathVariable Long id) {
        priceRepo.deleteById(id);
    }

    private static String host(String url) {
        if (url == null || url.isBlank()) return null;
        try {
            return java.net.URI.create(url).getHost();
        } catch (Exception e) {
            return null;
        }
    }
}
