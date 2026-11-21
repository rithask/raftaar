package com.raftaar.hisaab;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.raftaar.common.AppProperties;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/** Hisaab's Data API (docs/api.md there): a "Read transactions" token, money out only. */
@Component
public class HisaabClient {
    private final RestClient http;
    private final AppProperties.Hisaab cfg;

    public HisaabClient(RestClient outboundClient, AppProperties props) {
        this.cfg = props.hisaab();
        this.http = outboundClient.mutate()
                .baseUrl(cfg.url() == null ? "" : cfg.url().replaceAll("/+$", ""))
                .defaultHeader("Authorization", "Bearer " + (cfg.token() == null ? "" : cfg.token()))
                .build();
    }

    public boolean configured() { return cfg.configured(); }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Money(BigDecimal value, String currency) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Ref(String id, String name, String type, String last4) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Txn(String id, String direction, @JsonProperty("occurred_at") OffsetDateTime occurredAt, Money amount,
                      String payee, Ref category, Ref account, String notes, List<String> tags,
                      @JsonProperty("updated_at") OffsetDateTime updatedAt) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Page(List<Txn> data, @JsonProperty("has_more") boolean hasMore, @JsonProperty("next_cursor") String nextCursor) {}

    /** Transactions created or changed at or after {@code updatedSince}; or, the first time, everything since a day. */
    public Page changes(java.time.Instant updatedSince, LocalDate since, String cursor) {
        // An Instant prints with Z, never +05:30: a bare + in a query string would be read as a space.
        return http.get().uri(u -> {
            var b = u.path("/api/v1/transactions").queryParam("limit", 200);
            if (updatedSince != null) b.queryParam("updated_since", updatedSince.toString());
            if (since != null) b.queryParam("since", since.toString());
            if (cursor != null) b.queryParam("cursor", cursor);
            return b.build();
        }).retrieve().body(Page.class);
    }

    /** One transaction, or empty when it's deleted or no longer within the token's limits (Hisaab answers 404 for both). */
    public Optional<Txn> transaction(String id) {
        try {
            return Optional.ofNullable(http.get().uri("/api/v1/transactions/{id}", id).retrieve().body(Txn.class));
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.NOT_FOUND) return Optional.empty();
            throw e;
        }
    }
}
