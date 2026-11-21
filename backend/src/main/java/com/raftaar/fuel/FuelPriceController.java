package com.raftaar.fuel;

import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/fuel-prices")
public class FuelPriceController {
    private final FuelPrices prices;

    public FuelPriceController(FuelPrices prices) {
        this.prices = prices;
    }

    @GetMapping
    public List<FuelPrice> latest() {
        return prices.latest();
    }

    @GetMapping("/quote")
    public FuelPrices.PlaceQuote quote(@RequestParam(required = false) String region, @RequestParam(required = false) String district,
                                       @RequestParam(required = false) Double lat, @RequestParam(required = false) Double lon,
                                       @RequestParam(required = false) FuelType fuelType, @RequestParam(required = false) Long vehicleId) {
        return prices.quote(region, district, lat, lon, fuelType, vehicleId);
    }

    @PostMapping
    public FuelPrice setManually(@RequestBody FuelPrices.ManualPrice input) {
        return prices.setManually(input);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        prices.delete(id);
    }
}
