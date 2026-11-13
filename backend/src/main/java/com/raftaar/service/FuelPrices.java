package com.raftaar.service;

import com.raftaar.domain.FuelEntry;
import com.raftaar.domain.FuelPrice;
import com.raftaar.domain.FuelType;
import com.raftaar.integration.FuelPriceSourceClient;
import com.raftaar.repo.FuelEntryRepo;
import com.raftaar.repo.FuelPriceRepo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

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

    public FuelPrices(FuelPriceRepo prices, FuelEntryRepo fuel, FuelPriceSourceClient source) {
        this.prices = prices;
        this.fuel = fuel;
        this.source = source;
    }

    public record Quote(BigDecimal price, String source, Instant asOf, String region, String district) {}

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
                        FuelPrice p = record(region, district, type, looked.get(), Instant.now(), FuelPrice.Source.LOOKUP);
                        return Optional.of(quote(p));
                    }
                } catch (Exception e) {
                    log.warn("Fuel price lookup for {} failed: {}", region, e.getMessage());
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

    public FuelPrice record(String region, String district, FuelType type, BigDecimal price, Instant at, FuelPrice.Source src) {
        FuelPrice p = new FuelPrice();
        p.region = region.trim();
        p.district = district == null || district.isBlank() ? null : district.trim();
        p.fuelType = type;
        p.price = price;
        p.effectiveAt = at;
        p.source = src;
        return prices.save(p);
    }

    /** A confirmed fill-up teaches the price for its place, unless a newer price is already known there. */
    public void learn(FuelEntry e, FuelType type) {
        if (e.region == null || e.pricePerUnit == null) return;
        var latest = prices.findFirstByRegionIgnoreCaseAndFuelTypeOrderByEffectiveAtDesc(e.region, type);
        if (latest.isPresent() && latest.get().effectiveAt.isAfter(e.filledAt)) return;
        record(e.region, e.district, type, e.pricePerUnit, e.filledAt, FuelPrice.Source.FILL_UP);
    }

    private static Quote quote(FuelPrice p) {
        return new Quote(p.price, p.source.name(), p.effectiveAt, p.region, p.district);
    }
}
