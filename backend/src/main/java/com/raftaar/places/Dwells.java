package com.raftaar.places;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Finds the short stops inside a drive, the kind GeoPulse doesn't count as a stay: a couple of minutes at a fuel
 * pump. A stop is a run of points that all stay within {@code radiusM} of where it began, lasting at least
 * {@code minSeconds}. Phones send fewer points while standing still, so the time between two nearby points counts.
 */
public final class Dwells {
    private Dwells() {}

    public record Point(Instant at, double lat, double lon) {}

    public record Dwell(Instant start, Instant end, double lat, double lon) {
        public long seconds() { return Duration.between(start, end).toSeconds(); }
        public Instant middle() { return start.plus(Duration.between(start, end).dividedBy(2)); }
    }

    public static List<Dwell> find(List<Point> points, double radiusM, long minSeconds, long maxSeconds) {
        List<Dwell> out = new ArrayList<>();
        int i = 0;
        while (i < points.size()) {
            Point first = points.get(i);
            int j = i;
            double sumLat = first.lat(), sumLon = first.lon();
            while (j + 1 < points.size()) {
                Point next = points.get(j + 1);
                if (Geo.meters(first.lat(), first.lon(), next.lat(), next.lon()) > radiusM) break;
                j++;
                sumLat += next.lat();
                sumLon += next.lon();
            }
            long seconds = Duration.between(first.at(), points.get(j).at()).toSeconds();
            if (j > i && seconds >= minSeconds && seconds <= maxSeconds) {
                int n = j - i + 1;
                out.add(new Dwell(first.at(), points.get(j).at(), sumLat / n, sumLon / n));
            }
            i = j + 1;
        }
        return out;
    }
}
