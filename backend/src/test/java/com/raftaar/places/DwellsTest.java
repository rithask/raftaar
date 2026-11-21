package com.raftaar.places;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class DwellsTest {
    @Test
    void findsAShortStopInsideADrive() {
        Instant t = Instant.parse("2026-11-12T08:00:00Z");
        double lat = 12.9716, lon = 77.5946;
        List<Dwells.Point> pts = List.of(
                new Dwells.Point(t, lat - 0.01, lon),
                new Dwells.Point(t.plusSeconds(30), lat - 0.005, lon),
                new Dwells.Point(t.plusSeconds(60), lat, lon),               // arrives at the pump
                new Dwells.Point(t.plusSeconds(120), lat + 0.0001, lon),
                new Dwells.Point(t.plusSeconds(240), lat, lon + 0.0001),     // leaves 3 min later
                new Dwells.Point(t.plusSeconds(270), lat + 0.005, lon),
                new Dwells.Point(t.plusSeconds(300), lat + 0.01, lon));
        var dwells = Dwells.find(pts, 40, 60, 1800);
        assertEquals(1, dwells.size());
        assertEquals(180, dwells.getFirst().seconds());
        assertTrue(Geo.meters(lat, lon, dwells.getFirst().lat(), dwells.getFirst().lon()) < 15);
    }
}
