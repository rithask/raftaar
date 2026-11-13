package com.raftaar.integration;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.raftaar.config.AppProperties;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** GeoPulse's REST API with an API token (the "read" scope is enough). */
@Component
public class GeoPulseClient {
    private final RestClient http;
    private final AppProperties.GeoPulse cfg;

    public GeoPulseClient(RestClient outboundClient, AppProperties props) {
        this.cfg = props.geopulse();
        this.http = outboundClient.mutate()
                .baseUrl(cfg.url() == null ? "" : cfg.url().replaceAll("/+$", ""))
                .defaultHeader("X-API-Key", cfg.token() == null ? "" : cfg.token())
                .build();
    }

    public boolean configured() { return cfg.configured(); }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Stay(Long id, Instant timestamp, String locationName, Long stayDuration, Double latitude, Double longitude) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Trip(Long id, Instant timestamp, Double latitude, Double longitude, Double endLatitude, Double endLongitude,
                       Long tripDuration, Double distanceMeters, String movementType) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Timeline(List<Stay> stays, List<Trip> trips) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Coordinates(double lat, double lng) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Point(Instant timestamp, Coordinates coordinates, Double accuracy, Double velocity) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record PointPage(List<Point> items, int page, int totalPages) {}

    public Timeline timeline(Instant from, Instant to) {
        Timeline t = http.get().uri(u -> u.path("/api/v1/timeline").queryParam("from", from.toString()).queryParam("to", to.toString()).build())
                .retrieve().body(Timeline.class);
        if (t == null) return new Timeline(List.of(), List.of());
        return new Timeline(t.stays() == null ? List.of() : t.stays(), t.trips() == null ? List.of() : t.trips());
    }

    /** Raw GPS points, oldest first, at most {@code maxPoints}. */
    public List<Point> points(Instant from, Instant to, int maxPoints) {
        List<Point> out = new ArrayList<>();
        for (int page = 1; out.size() < maxPoints; page++) {
            int p = page;
            PointPage body = http.get().uri(u -> u.path("/api/v1/gps/points")
                            .queryParam("from", from.toString()).queryParam("to", to.toString())
                            .queryParam("page", p).queryParam("size", 1000).queryParam("sortDirection", "asc").build())
                    .retrieve().body(PointPage.class);
            if (body == null || body.items() == null || body.items().isEmpty()) break;
            out.addAll(body.items());
            if (page >= body.totalPages()) break;
        }
        return out;
    }
}
