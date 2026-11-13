package com.raftaar.service;

import com.raftaar.domain.FuelStation;
import com.raftaar.domain.Geocode;
import com.raftaar.domain.MapTile;
import com.raftaar.integration.OsmClient;
import com.raftaar.repo.FuelStationRepo;
import com.raftaar.repo.GeocodeRepo;
import com.raftaar.repo.MapTileRepo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.Locale;
import java.util.Optional;

/**
 * Fuel pumps near a point, and the state and district a point is in, cached so OpenStreetMap is asked about each
 * ~5 km square (pumps) or ~2 km square (place names) only once in a while.
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
        var tile = tiles.findById(key);
        if (tile.isPresent() && tile.get().fetchedAt.isAfter(Instant.now().minus(TILE_TTL))) return;
        try {
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
        } catch (Exception ex) {
            log.warn("Couldn't fetch fuel pumps near {},{}: {}", lat, lon, ex.getMessage());
        }
    }

    public Optional<Region> region(double lat, double lon) {
        String key = String.format(Locale.ROOT, "%d:%d", (long) Math.floor(lat / CELL), (long) Math.floor(lon / CELL));
        var cached = geocodes.findById(key);
        if (cached.isPresent() && cached.get().fetchedAt.isAfter(Instant.now().minus(GEOCODE_TTL))) {
            return Optional.ofNullable(cached.get().region).map(r -> new Region(r, cached.get().district));
        }
        if (!osm.places()) return Optional.empty();
        try {
            var a = osm.reverse(lat, lon);
            Geocode g = cached.orElseGet(Geocode::new);
            g.cellKey = key;
            g.region = a == null ? null : a.state();
            g.district = a == null ? null : firstNonBlank(a.stateDistrict(), a.county(), a.city());
            g.fetchedAt = Instant.now();
            geocodes.save(g);
            return Optional.ofNullable(g.region).map(r -> new Region(r, g.district));
        } catch (Exception ex) {
            log.warn("Couldn't look up the place at {},{}: {}", lat, lon, ex.getMessage());
            return Optional.empty();
        }
    }

    static String firstNonBlank(String... values) {
        for (String v : values) if (v != null && !v.isBlank()) return v.trim();
        return null;
    }
}
