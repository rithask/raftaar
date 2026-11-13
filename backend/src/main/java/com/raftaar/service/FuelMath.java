package com.raftaar.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Price per unit, volume and total: any two give the third. When all three are given they're kept as they are,
 * because a pump's receipt is rounded and recomputing one would make it disagree with the receipt.
 */
public final class FuelMath {
    private FuelMath() {}

    public record Fill(BigDecimal volume, BigDecimal pricePerUnit, BigDecimal totalCost) {}

    public static Fill complete(BigDecimal volume, BigDecimal price, BigDecimal total) {
        volume = positive(volume);
        price = positive(price);
        total = positive(total);
        if (volume != null && price != null && total != null) return new Fill(volume, price, total);
        if (volume != null && price != null) return new Fill(volume, price, volume.multiply(price).setScale(2, RoundingMode.HALF_UP));
        if (total != null && price != null) return new Fill(total.divide(price, 3, RoundingMode.HALF_UP), price, total);
        if (total != null && volume != null) return new Fill(volume, total.divide(volume, 2, RoundingMode.HALF_UP), total);
        throw new IllegalArgumentException("Give two of: volume, price per unit, total paid");
    }

    private static BigDecimal positive(BigDecimal v) {
        return v == null || v.signum() <= 0 ? null : v;
    }
}
