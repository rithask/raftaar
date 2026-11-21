package com.raftaar.fuel;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Mileage, measured only between two full tanks. The fuel of any partial fills in between is added to the full tank
 * that closes the stretch. A fill marked "missed previous" breaks the chain: the distance since the last full tank
 * can't be trusted because some fuel is unaccounted for.
 */
public final class Economy {
    private Economy() {}

    public record Fill(long id, BigDecimal odometer, BigDecimal volume, BigDecimal cost, boolean fullTank, boolean missedPrevious) {}

    /** A measured stretch, ending at the full tank {@code endId}. */
    public record Stretch(long endId, BigDecimal distance, BigDecimal volume, BigDecimal cost, BigDecimal kmPerUnit) {}

    public record Result(Map<Long, Stretch> byEndId, BigDecimal distance, BigDecimal volume, BigDecimal cost, BigDecimal average) {
        public List<Stretch> stretches() { return new ArrayList<>(byEndId.values()); }
    }

    /** {@code fills} in the order they happened. */
    /** Mileage of a vehicle's fill-ups, in odometer order (a fill-up entered late still lands in the right place). */
    public static Result of(List<FuelEntry> fills) {
        List<FuelEntry> byOdometer = new ArrayList<>(fills);
        byOdometer.sort(Comparator.comparing((FuelEntry fill) -> fill.odometer).thenComparing(fill -> fill.filledAt));
        return compute(byOdometer.stream()
                .map(fill -> new Fill(fill.id, fill.odometer, fill.volume, fill.totalCost, fill.fullTank, fill.missedPrevious)).toList());
    }

    public static Result compute(List<Fill> fills) {
        Map<Long, Stretch> out = new LinkedHashMap<>();
        Fill anchor = null;
        BigDecimal volume = BigDecimal.ZERO, cost = BigDecimal.ZERO;
        BigDecimal totalDistance = BigDecimal.ZERO, totalVolume = BigDecimal.ZERO, totalCost = BigDecimal.ZERO;
        for (Fill fill : fills) {
            if (anchor == null || fill.missedPrevious()) {
                anchor = fill.fullTank() ? fill : null;
                volume = BigDecimal.ZERO;
                cost = BigDecimal.ZERO;
                continue;
            }
            volume = volume.add(fill.volume());
            cost = cost.add(fill.cost());
            if (!fill.fullTank()) continue;
            BigDecimal distance = fill.odometer().subtract(anchor.odometer());
            if (distance.signum() > 0 && volume.signum() > 0) {
                out.put(fill.id(), new Stretch(fill.id(), distance, volume, cost, distance.divide(volume, 2, RoundingMode.HALF_UP)));
                totalDistance = totalDistance.add(distance);
                totalVolume = totalVolume.add(volume);
                totalCost = totalCost.add(cost);
            }
            anchor = fill;
            volume = BigDecimal.ZERO;
            cost = BigDecimal.ZERO;
        }
        BigDecimal avg = totalVolume.signum() > 0 ? totalDistance.divide(totalVolume, 2, RoundingMode.HALF_UP) : null;
        return new Result(out, totalDistance, totalVolume, totalCost, avg);
    }
}
