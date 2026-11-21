package com.raftaar.places;

import com.raftaar.common.http.RequestLimiter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;
import com.raftaar.common.Failures;

/**
 * Fuel pumps near a point, and the state and district a point is in, cached so OpenStreetMap is asked about each
 * ~5 km square (pumps) or ~2 km square (place names) only once in a while. When several callers need the same square
 * at once (a sync with many stops nearby), they share one lookup instead of each asking.
 */
@Service
public class Places {
    private static final Logger log = LoggerFactory.getLogger(Places.class);
    private static final double TILE = 0.05, PAD = 0.01, CELL = 0.02;
    private static final Duration TILE_TTL = Duration.ofDays(90), GEOCODE_TTL = Duration.ofDays(365);

    private final OsmClient osm;
    private final FuelStationRepo stations;
    private final MapTileRepo tiles;
    private final GeocodeRepo geocodes;
    private final ConcurrentHashMap<String, CompletableFuture<Object>> inFlight = new ConcurrentHashMap<>();

    public Places(OsmClient osm, FuelStationRepo stations, MapTileRepo tiles, GeocodeRepo geocodes) {
        this.osm = osm;
        this.stations = stations;
        this.tiles = tiles;
        this.geocodes = geocodes;
    }

    public record Nearby(FuelStation station, double meters) {}

    public record Region(String state, String district) {}

    public Optional<Nearby> nearestStation(double lat, double lon, double maxMeters) {
        ensureTile(lat, lon);
        double dLat = maxMeters / 111_000.0, dLon = maxMeters / (111_000.0 * Math.cos(Math.toRadians(lat)));
        return stations.findByLatitudeBetweenAndLongitudeBetween(lat - dLat, lat + dLat, lon - dLon, lon + dLon).stream()
                .map(s -> new Nearby(s, Geo.meters(lat, lon, s.latitude, s.longitude)))
                .filter(n -> n.meters() <= maxMeters)
                .min(Comparator.comparingDouble(Nearby::meters));
    }

    private void ensureTile(double lat, double lon) {
        if (!osm.pumps()) return;
        long ty = (long) Math.floor(lat / TILE), tx = (long) Math.floor(lon / TILE);
        String key = ty + ":" + tx;
        if (fresh(tiles.findById(key).orElse(null))) return;
        try {
            once("tile:" + key, () -> fetchTile(key, ty, tx));
        } catch (Exception ex) {
            skipped("Fuel pumps near " + lat + "," + lon, ex);
        }
    }

    private Void fetchTile(String key, long ty, long tx) {
        var tile = tiles.findById(key);
        if (fresh(tile.orElse(null))) return null; // fetched by someone else a moment ago
        double south = ty * TILE - PAD, west = tx * TILE - PAD, north = (ty + 1) * TILE + PAD, east = (tx + 1) * TILE + PAD;
        for (var e : osm.fuelStations(south, west, north, east)) {
            FuelStation s = new FuelStation();
            s.osmId = e.type() + "/" + e.id();
            var tags = e.tags() == null ? java.util.Map.<String, String>of() : e.tags();
            s.name = firstNonBlank(tags.get("name"), tags.get("brand"), tags.get("operator"));
            s.brand = firstNonBlank(tags.get("brand"), tags.get("operator"));
            s.latitude = e.latitude();
            s.longitude = e.longitude();
            stations.save(s);
        }
        MapTile t = tile.orElseGet(MapTile::new);
        t.tileKey = key;
        t.fetchedAt = Instant.now();
        tiles.save(t);
        return null;
    }

    private static boolean fresh(MapTile t) {
        return t != null && t.fetchedAt.isAfter(Instant.now().minus(TILE_TTL));
    }

    public Optional<Region> region(double lat, double lon) {
        String key = String.format(Locale.ROOT, "%d:%d", (long) Math.floor(lat / CELL), (long) Math.floor(lon / CELL));
        var cached = geocodes.findById(key);
        if (fresh(cached.orElse(null))) return toRegion(cached.get());
        if (!osm.places()) return Optional.empty();
        try {
            return once("cell:" + key, () -> lookUp(key, lat, lon));
        } catch (Exception ex) {
            skipped("Place lookup at " + lat + "," + lon, ex);
            return Optional.empty();
        }
    }

    private Optional<Region> lookUp(String key, double lat, double lon) {
        var cached = geocodes.findById(key);
        if (fresh(cached.orElse(null))) return toRegion(cached.get()); // looked up by someone else a moment ago
        var a = osm.reverse(lat, lon);
        Geocode g = cached.orElseGet(Geocode::new);
        g.cellKey = key;
        g.region = a == null ? null : a.state();
        g.district = a == null ? null : firstNonBlank(a.stateDistrict(), a.county(), a.city());
        g.fetchedAt = Instant.now();
        geocodes.save(g);
        return toRegion(g);
    }

    private static boolean fresh(Geocode g) {
        return g != null && g.fetchedAt.isAfter(Instant.now().minus(GEOCODE_TTL));
    }

    private static Optional<Region> toRegion(Geocode g) {
        return Optional.ofNullable(g.region).map(r -> new Region(r, g.district));
    }

    /**
     * Runs {@code work} for {@code key}, unless it's already running for that key: then waits for that run and
     * shares its result (or its failure), so one square is never looked up twice at the same time.
     */
    @SuppressWarnings("unchecked")
    <T> T once(String key, Supplier<T> work) {
        var mine = new CompletableFuture<Object>();
        var running = inFlight.putIfAbsent(key, mine);
        if (running != null) {
            try {
                return (T) running.join();
            } catch (CompletionException e) {
                throw e.getCause() instanceof RuntimeException r ? r : e;
            }
        }
        try {
            T result = work.get();
            mine.complete(result);
            return result;
        } catch (RuntimeException e) {
            mine.completeExceptionally(e);
            throw e;
        } finally {
            inFlight.remove(key, mine);
        }
    }

    /**
     * A lookup that didn't happen. While a service is busy or paused (RequestLimiter already said so once) it's only
     * worth a debug line; other failures are logged as usual.
     */
    private static void skipped(String what, Exception e) {
        if (e instanceof RequestLimiter.Busy) log.debug("{} skipped: {}", what, e.getMessage());
        else Failures.log(log, what, e);
    }

    static String firstNonBlank(String... values) {
        for (String v : values) if (v != null && !v.isBlank()) return v.trim();
        return null;
    }
}
