package com.raftaar.integration;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.raftaar.config.AppProperties;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * OpenStreetMap: fuel pumps from Overpass, and the state a point is in from Nominatim, each used only when its URL
 * is set. Both public services have usage policies (Nominatim: at most one request a second), so callers cache
 * everything (see Places).
 */
@Component
public class OsmClient {
    private final RestClient http;
    private final AppProperties.Osm cfg;
    private long lastNominatim;

    public OsmClient(RestClient outboundClient, AppProperties props) {
        this.http = outboundClient;
        this.cfg = props.osm();
    }

    /** Whether fuel pumps can be looked up (OVERPASS_URL is set). */
    public boolean pumps() { return cfg.pumps(); }

    /** Whether the state of a point can be looked up (NOMINATIM_URL is set). */
    public boolean places() { return cfg.places(); }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Center(double lat, double lon) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Element(String type, long id, Double lat, Double lon, Center center, Map<String, String> tags) {
        public double latitude() { return lat != null ? lat : center.lat(); }
        public double longitude() { return lon != null ? lon : center.lon(); }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Overpass(List<Element> elements) {}

    public List<Element> fuelStations(double south, double west, double north, double east) {
        String box = String.format(Locale.ROOT, "(%.5f,%.5f,%.5f,%.5f)", south, west, north, east);
        String query = "[out:json][timeout:25];(node[\"amenity\"=\"fuel\"]" + box + ";way[\"amenity\"=\"fuel\"]" + box + ";);out center tags;";
        var form = new LinkedMultiValueMap<String, String>();
        form.add("data", query);
        Overpass body = http.post().uri(cfg.overpassUrl()).contentType(MediaType.APPLICATION_FORM_URLENCODED).body(form)
                .retrieve().body(Overpass.class);
        if (body == null || body.elements() == null) return List.of();
        return body.elements().stream().filter(e -> e.lat() != null || e.center() != null).toList();
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Address(String state, @JsonProperty("state_district") String stateDistrict, String county, String city) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Reverse(Address address) {}

    public synchronized Address reverse(double lat, double lon) {
        long wait = 1100 - (System.currentTimeMillis() - lastNominatim);
        if (wait > 0) {
            try {
                Thread.sleep(wait);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        lastNominatim = System.currentTimeMillis();
        String base = cfg.nominatimUrl().replaceAll("/+$", "");
        Reverse r = http.get().uri(base + "/reverse?format=jsonv2&zoom=10&addressdetails=1&accept-language=en&lat={lat}&lon={lon}", lat, lon)
                .retrieve().body(Reverse.class);
        return r == null ? null : r.address();
    }
}
