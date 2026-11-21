package com.raftaar.fuel;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class FuelLogicTest {
    static BigDecimal d(String s) { return new BigDecimal(s); }

    @Test
    void fuelMathFillsInTheMissingValue() {
        assertEquals(d("1025.00"), FuelMath.complete(d("10"), d("102.5"), null).totalCost());
        assertEquals(d("4.878"), FuelMath.complete(null, d("102.50"), d("500")).volume());
        assertEquals(d("102.50"), FuelMath.complete(d("4.878"), null, d("500")).pricePerUnit());
        // all three given: the receipt wins
        assertEquals(d("499.99"), FuelMath.complete(d("4.878"), d("102.5"), d("499.99")).totalCost());
        assertThrows(IllegalArgumentException.class, () -> FuelMath.complete(d("5"), null, null));
    }

    @Test
    void mileageOnlyBetweenFullTanks() {
        var r = Economy.compute(List.of(
                new Economy.Fill(1, d("1000"), d("10"), d("1000"), true, false),
                new Economy.Fill(2, d("1200"), d("4"), d("400"), false, false), // partial
                new Economy.Fill(3, d("1450"), d("6"), d("600"), true, false),  // 450 km on 10 L
                new Economy.Fill(4, d("1800"), d("5"), d("500"), true, true),   // missed one: no figure, new anchor
                new Economy.Fill(5, d("2100"), d("7.5"), d("750"), true, false) // 300 km on 7.5 L
        ));
        assertEquals(d("45.00"), r.byEndId().get(3L).kmPerUnit());
        assertNull(r.byEndId().get(4L));
        assertEquals(d("40.00"), r.byEndId().get(5L).kmPerUnit());
        assertEquals(d("750"), r.distance());
        assertEquals(d("42.86"), r.average()); // 750 / 17.5
    }

    @Test
    void firstFillIsPartialSoNothingIsMeasuredUntilAFullTank() {
        var r = Economy.compute(List.of(
                new Economy.Fill(1, d("100"), d("3"), d("300"), false, false),
                new Economy.Fill(2, d("200"), d("3"), d("300"), true, false),
                new Economy.Fill(3, d("350"), d("3"), d("300"), true, false)));
        assertEquals(1, r.byEndId().size());
        assertEquals(d("50.00"), r.byEndId().get(3L).kmPerUnit());
    }
}
