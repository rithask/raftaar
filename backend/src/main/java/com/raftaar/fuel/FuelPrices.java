package com.raftaar.fuel;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import com.raftaar.common.Failures;
import com.raftaar.places.Places;
import org.springframework.transaction.annotation.Transactional;

/**
 * The current fuel price for a state (and district, when known). Where it comes from, best first: a lookup from
 * FUEL_PRICE_URL if set and the stored one is over a day old; a price you entered; the price on your last fill-up
 * in that state. Without a state, the vehicle's last fill-up price.
 */
@Service
public class FuelPrices {
    private static final Logger log = LoggerFactory.getLogger(FuelPrices.class);

    private final FuelPriceRepo prices;
    private final FuelEntryRepo fuel;
    private final FuelPriceSourceClient source;
    private final Places places;

    public FuelPrices(FuelPriceRepo prices, FuelEntryRepo fuel, FuelPriceSourceClient source, Places places) {
        this.prices = prices;
        this.fuel = fuel;
        this.source = source;
        this.places = places;
    }

    public record Quote(BigDecimal price, String source, Instant asOf, String region, String district) {}

    /** The place a quote is for, and the quote (null when no price is known there). */
    public record PlaceQuote(String region, String district, Quote quote) {}

    /** Latest price per state, district and fuel. */
    @Transactional(readOnly = true)
    public List<FuelPrice> latest() {
        return prices.latest();
    }

    /** For the fill-up form: the price where you are (a point: its state is looked up) or in a state. */
    public PlaceQuote quote(String region, String district, Double latitude, Double longitude, FuelType fuelType, Long vehicleId) {
        if (region == null && latitude != null && longitude != null) {
            var place = places.region(latitude, longitude);
            if (place.isPresent()) {
                region = place.get().state();
                district = place.get().district();
            }
        }
        return new PlaceQuote(region, district, current(region, district, fuelType, vehicleId).orElse(null));
    }

    public record ManualPrice(String region, String district, FuelType fuelType, BigDecimal price, Instant effectiveAt) {}

    /** A price you entered yourself, e.g. when prices changed. */
    public FuelPrice setManually(ManualPrice input) {
        if (input.region() == null || input.region().isBlank()) throw new IllegalArgumentException("Which state?");
        if (input.price() == null || input.price().signum() <= 0) throw new IllegalArgumentException("Enter the price");
        FuelPrice saved = record(input.region(), input.district(), input.fuelType() != null ? input.fuelType() : FuelType.PETROL, input.price(),
                input.effectiveAt() != null ? input.effectiveAt() : Instant.now(), FuelPrice.Source.MANUAL);
        log.info("Fuel price for {} set to {} by hand", saved.district == null ? saved.region : saved.district + ", " + saved.region, saved.price);
        return saved;
    }

    public void delete(Long id) {
        prices.deleteById(id);
        log.info("Fuel price {} deleted", id);
    }

    public Optional<Quote> current(String region, String district, FuelType type, Long vehicleId) {
        if (type == null) type = FuelType.PETROL;
        if (region != null) {
            Optional<FuelPrice> stored = Optional.empty();
            if (district != null) stored = prices.findFirstByRegionIgnoreCaseAndDistrictIgnoreCaseAndFuelTypeOrderByEffectiveAtDesc(region, district, type);
            if (stored.isEmpty()) stored = prices.findFirstByRegionIgnoreCaseAndFuelTypeOrderByEffectiveAtDesc(region, type);
            boolean stale = stored.isEmpty() || stored.get().effectiveAt.isBefore(Instant.now().minus(Duration.ofDays(1)));
            if (stale && source.configured()) {
                try {
                    var looked = source.price(region, district, type);
                    if (looked.isPresent()) {
                        FuelPrice price = record(region, district, type, looked.get(), Instant.now(), FuelPrice.Source.LOOKUP);
                        log.debug("Looked up {} price for {}: {}", type, district == null ? region : district + ", " + region, price.price);
                        return Optional.of(quote(price));
                    }
                } catch (Exception e) {
                    Failures.log(log, "Fuel price lookup for " + region, e);
                }
            }
            if (stored.isPresent()) return Optional.of(quote(stored.get()));
        }
        if (vehicleId != null) {
            return fuel.findFirstByVehicleIdOrderByFilledAtDescIdDesc(vehicleId)
                    .map(f -> new Quote(f.pricePerUnit, "LAST_FILL_UP", f.filledAt, f.region, f.district));
        }
        return Optional.empty();
    }

    public FuelPrice record(String region, String district, FuelType type, BigDecimal price, Instant at, FuelPrice.Source origin) {
        FuelPrice entry = new FuelPrice();
        entry.region = region.trim();
        entry.district = district == null || district.isBlank() ? null : district.trim();
        entry.fuelType = type;
        entry.price = price;
        entry.effectiveAt = at;
        entry.source = origin;
        return prices.save(entry);
    }

    /** A confirmed fill-up teaches the price for its place, unless a newer price is already known there. */
    public void learn(FuelEntry fill, FuelType type) {
        if (fill.region == null || fill.pricePerUnit == null) return;
        var latest = prices.findFirstByRegionIgnoreCaseAndFuelTypeOrderByEffectiveAtDesc(fill.region, type);
        if (latest.isPresent() && latest.get().effectiveAt.isAfter(fill.filledAt)) return;
        record(fill.region, fill.district, type, fill.pricePerUnit, fill.filledAt, FuelPrice.Source.FILL_UP);
    }

    /**
     * The published price (looked up or entered, not learned from a fill-up) where and when each fill-up happened:
     * the newest one from up to a week before it, matching the district if it can, else the state. Null when there's none.
     */
    public Map<Long, BigDecimal> publishedAt(List<FuelEntry> fills, FuelType type) {
        if (type == null) type = FuelType.PETROL;
        List<FuelPrice> known = prices.findByFuelTypeAndSourceNotOrderByEffectiveAtAsc(type, FuelPrice.Source.FILL_UP);
        Map<Long, BigDecimal> out = new HashMap<>();
        if (known.isEmpty()) return out;
        for (FuelEntry fill : fills) {
            if (fill.region == null) continue;
            Instant from = fill.filledAt.minus(Duration.ofDays(7));
            FuelPrice inDistrict = null, inRegion = null, anyInRegion = null;
            for (FuelPrice price : known) {
                if (price.effectiveAt.isAfter(fill.filledAt)) break;
                if (price.effectiveAt.isBefore(from) || !price.region.equalsIgnoreCase(fill.region)) continue;
                anyInRegion = price;
                if (price.district == null) inRegion = price;
                else if (fill.district != null && price.district.equalsIgnoreCase(fill.district)) inDistrict = price;
            }
            FuelPrice best = inDistrict != null ? inDistrict : inRegion != null ? inRegion : anyInRegion;
            if (best != null) out.put(fill.id, best.price);
        }
        return out;
    }

    private static Quote quote(FuelPrice price) {
        return new Quote(price.price, price.source.name(), price.effectiveAt, price.region, price.district);
    }
}
