package com.raftaar.vehicle;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * What a vehicle has cost to own: what it was bought for, plus everything spent running it, less what it was sold
 * for; per km over the distance you had it, and per month. "So far" for one you still have.
 *
 * {@code missing} names what isn't known (the purchase price, the date it was bought, the sale price) rather than
 * the figure quietly being wrong: a missing price counts as nothing, and a figure that needs a missing piece is null.
 */
public record Ownership(boolean sold, BigDecimal purchase, BigDecimal running, BigDecimal sale, BigDecimal total,
                        BigDecimal distance, BigDecimal perKm, Long months, BigDecimal perMonth, List<String> missing) {

    /** Under this distance a cost per km says more about the start than the vehicle. */
    static final BigDecimal MIN_DISTANCE = BigDecimal.valueOf(50);

    /**
     * {@code running}: fuel, services and expenses together. {@code firstOdometer}, {@code lastOdometer}: the lowest
     * and highest readings on record (the purchase and sale readings take their place when they're known).
     */
    public static Ownership of(Vehicle vehicle, BigDecimal running, BigDecimal firstOdometer, BigDecimal lastOdometer, LocalDate today) {
        boolean sold = vehicle.archived;
        var missing = new ArrayList<String>();
        if (vehicle.purchasePrice == null) missing.add("purchase price");
        if (vehicle.purchaseDate == null) missing.add("purchase date");
        if (sold && vehicle.salePrice == null) missing.add("sale price");
        if (sold && vehicle.soldOn == null) missing.add("date it was sold");

        BigDecimal purchase = vehicle.purchasePrice;
        BigDecimal sale = sold ? vehicle.salePrice : null;
        BigDecimal total = orZero(purchase).add(running).subtract(orZero(sale));

        BigDecimal start = vehicle.purchaseOdometer != null ? vehicle.purchaseOdometer : firstOdometer;
        BigDecimal end = sold && vehicle.saleOdometer != null ? vehicle.saleOdometer : lastOdometer;
        BigDecimal distance = start == null || end == null || end.compareTo(start) <= 0 ? null : end.subtract(start);
        BigDecimal perKm = distance == null || distance.compareTo(MIN_DISTANCE) < 0 ? null : total.divide(distance, 2, RoundingMode.HALF_UP);

        // a sold one's months end on the day it went; without that day they'd keep counting
        LocalDate until = sold ? vehicle.soldOn : today;
        Long months = vehicle.purchaseDate == null || until == null || until.isBefore(vehicle.purchaseDate) ? null
                : Math.max(1, ChronoUnit.MONTHS.between(vehicle.purchaseDate, until));
        BigDecimal perMonth = months == null ? null : total.divide(BigDecimal.valueOf(months), 0, RoundingMode.HALF_UP);
        return new Ownership(sold, purchase, running, sale, total, distance, perKm, months, perMonth, List.copyOf(missing));
    }

    private static BigDecimal orZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}
