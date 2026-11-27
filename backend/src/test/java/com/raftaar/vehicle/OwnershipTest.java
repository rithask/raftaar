package com.raftaar.vehicle;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class OwnershipTest {
    static BigDecimal d(String s) { return new BigDecimal(s); }
    static final LocalDate TODAY = LocalDate.of(2026, 11, 27);

    static Vehicle bought() {
        Vehicle v = new Vehicle();
        v.purchasePrice = d("150000");
        v.purchaseDate = LocalDate.of(2023, 11, 27);
        v.purchaseOdometer = d("0");
        return v;
    }

    @Test
    void aSoldVehicle() {
        Vehicle v = bought();
        v.archived = true;
        v.soldOn = LocalDate.of(2025, 11, 27);
        v.salePrice = d("90000");
        v.saleOdometer = d("20000");
        // 150,000 + 60,000 running − 90,000 sale = 120,000 over 20,000 km and 24 months
        var o = Ownership.of(v, d("60000"), d("0"), d("21000"), TODAY);
        assertTrue(o.sold());
        assertEquals(d("120000"), o.total());
        assertEquals(d("20000"), o.distance(), "to the reading at the sale, not the last one on record");
        assertEquals(d("6.00"), o.perKm());
        assertEquals(24L, o.months(), "to the day it was sold, not today");
        assertEquals(d("5000"), o.perMonth());
        assertEquals(List.of(), o.missing());
    }

    @Test
    void oneYouStillHaveIsSoFar() {
        var o = Ownership.of(bought(), d("30000"), d("0"), d("9000"), TODAY);
        assertFalse(o.sold());
        assertNull(o.sale());
        assertEquals(d("180000"), o.total());
        assertEquals(d("20.00"), o.perKm());
        assertEquals(36L, o.months());
    }

    @Test
    void whatIsMissingIsSaid() {
        Vehicle v = new Vehicle();
        v.archived = true;
        var o = Ownership.of(v, d("30000"), d("1000"), d("4000"), TODAY);
        assertEquals(List.of("purchase price", "purchase date", "sale price", "date it was sold"), o.missing());
        assertEquals(d("30000"), o.total(), "missing prices count as nothing");
        assertEquals(d("3000"), o.distance(), "from the first reading when the purchase reading isn't known");
        assertNull(o.months());
        assertNull(o.perMonth());
    }

    @Test
    void aSoldOneWithoutItsDateHasNoMonths() {
        Vehicle v = bought();
        v.archived = true;
        v.salePrice = d("90000");
        var o = Ownership.of(v, d("60000"), d("0"), d("20000"), TODAY);
        assertNull(o.months(), "not counted up to today");
        assertEquals(List.of("date it was sold"), o.missing());
    }

    @Test
    void tooShortADistanceGivesNoPerKm() {
        assertNull(Ownership.of(bought(), d("500"), d("0"), d("30"), TODAY).perKm());
    }
}
