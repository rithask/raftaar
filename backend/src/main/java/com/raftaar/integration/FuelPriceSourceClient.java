package com.raftaar.integration;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.raftaar.config.AppProperties;
import com.raftaar.domain.FuelType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

/**
 * An optional price source you point Raftaar at, because there's no free official API for Indian fuel prices.
 * FUEL_PRICE_URL is a template with {state}, {district} and {fuel}; it must answer {"price": 102.5}.
 */
@Component
public class FuelPriceSourceClient {
    private final RestClient http;
    private final AppProperties.FuelPriceSource cfg;

    public FuelPriceSourceClient(RestClient outboundClient, AppProperties props) {
        this.http = outboundClient;
        this.cfg = props.fuelPrice();
    }

    public boolean configured() { return cfg.configured(); }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Answer(BigDecimal price) {}

    public Optional<BigDecimal> price(String state, String district, FuelType fuel) {
        if (!configured() || state == null) return Optional.empty();
        String url = cfg.url().replace("{state}", enc(state)).replace("{district}", enc(district == null ? "" : district))
                .replace("{fuel}", fuel.name().toLowerCase());
        Answer a = http.get().uri(java.net.URI.create(url)).retrieve().body(Answer.class);
        return Optional.ofNullable(a).map(Answer::price).filter(p -> p.signum() > 0);
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }
}
