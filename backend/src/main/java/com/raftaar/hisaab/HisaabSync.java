package com.raftaar.hisaab;

import com.raftaar.common.AppProperties;
import com.raftaar.fuel.FuelEntry;
import com.raftaar.inbox.Suggestion;
import com.raftaar.fuel.FuelEntryRepo;
import com.raftaar.inbox.SuggestionRepo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import com.raftaar.geopulse.GeoPulseSync;
import com.raftaar.common.Settings;
import com.raftaar.inbox.Suggestions;
import com.raftaar.common.SyncJob;
import com.raftaar.common.SyncLog;
import com.raftaar.common.Text;

/**
 * Polls Hisaab for payments created or changed since the last poll ({@code updated_since}). Fuel payments become
 * fill-up suggestions; payments in the expense categories become expense suggestions. A payment that's deleted or
 * moved out of the token's categories just stops appearing, so pending suggestions are checked one by one too.
 */
@Service
public class HisaabSync extends SyncJob {
    private static final Logger log = LoggerFactory.getLogger(HisaabSync.class);
    public static final String NAME = "hisaab";

    private final HisaabClient client;
    private final AppProperties.Hisaab cfg;
    private final Suggestions suggestions;
    private final SuggestionRepo suggestionRepo;
    private final FuelEntryRepo fuel;
    private final GeoPulseSync geopulse;
    private final Settings settings;

    public HisaabSync(HisaabClient client, AppProperties props, Suggestions suggestions, SuggestionRepo suggestionRepo, FuelEntryRepo fuel,
                      GeoPulseSync geopulse, Settings settings, SyncLog syncLog) {
        super(syncLog);
        this.client = client;
        this.cfg = props.hisaab();
        this.suggestions = suggestions;
        this.suggestionRepo = suggestionRepo;
        this.fuel = fuel;
        this.geopulse = geopulse;
        this.settings = settings;
    }

    @Scheduled(initialDelayString = "PT2M", fixedDelayString = "${app.hisaab.poll-interval:PT15M}")
    void scheduled() {
        runOnSchedule();
    }

    @Override
    public String name() {
        return NAME;
    }

    @Override
    protected String title() {
        return "Hisaab sync";
    }

    @Override
    protected boolean configured() {
        return client.configured();
    }

    @Override
    protected String notConfiguredMessage() {
        return "Hisaab isn't set up (HISAAB_URL, HISAAB_TOKEN)";
    }

    @Override
    protected String work() {
        return sync();
    }

    private String sync() {
        Instant cursorTime = settings.instant("hisaab.updatedSince").orElse(null);
        LocalDate since = cursorTime == null ? LocalDate.now().minusDays(cfg.importDays()) : null;
        Instant newest = cursorTime;
        int fuelNew = 0, expenseNew = 0, flagged = 0;
        String cursor = null;
        do {
            var page = client.changes(cursorTime, since, cursor);
            if (page == null || page.data() == null) break;
            log.debug("Hisaab changes page: {} payments{}", page.data().size(), page.hasMore() ? ", more to come" : "");
            for (var t : page.data()) {
                if (t.updatedAt() != null && (newest == null || t.updatedAt().toInstant().isAfter(newest))) newest = t.updatedAt().toInstant();
                switch (classify(t)) {
                    case FUEL -> {
                        var outcome = suggestions.fromHisaabFuel(t);
                        if (outcome == Suggestions.Outcome.NEW) {
                            fuelNew++;
                            suggestionRepo.findByHisaabTxnId(t.id()).filter(s -> s.stopAt == null)
                                    .ifPresent(s -> geopulse.findStopFor(s.id, s.occurredAt));
                        }
                        if (outcome == Suggestions.Outcome.FLAGGED) flagged++;
                    }
                    case EXPENSE -> {
                        if (suggestions.fromHisaabExpense(t) == Suggestions.Outcome.NEW) expenseNew++;
                    }
                    case NONE -> leftCategories(t.id());
                }
            }
            cursor = page.hasMore() ? page.nextCursor() : null;
        } while (cursor != null);
        if (newest != null) settings.set("hisaab.updatedSince", newest);

        int gone = checkPending();
        if (lastDailyCheckOlderThan(Duration.ofHours(20))) flagged += checkConfirmed();

        return Text.plural(fuelNew, "fuel payment") + ", " + Text.plural(expenseNew, "expense") + (gone > 0 ? ", " + gone + " removed" : "") + (flagged > 0 ? ", " + flagged + " to check" : "");
    }


    enum Kind { FUEL, EXPENSE, NONE }

    Kind classify(HisaabClient.Txn t) {
        if (!"debit".equalsIgnoreCase(t.direction()) || t.category() == null || t.amount() == null) return Kind.NONE;
        if (matches(t.category(), cfg.fuelCategoryList())) return Kind.FUEL;
        if (matches(t.category(), cfg.expenseCategoryList())) return Kind.EXPENSE;
        return Kind.NONE;
    }

    private static boolean matches(HisaabClient.Ref c, List<String> wanted) {
        for (String w : wanted) {
            if (w.equals(c.id()) || (c.name() != null && w.toLowerCase(Locale.ROOT).equals(c.name().toLowerCase(Locale.ROOT)))) return true;
        }
        return false;
    }

    /** A payment we know about now shows up outside fuel and the expense categories. */
    private void leftCategories(String txnId) {
        suggestionRepo.findByHisaabTxnId(txnId).ifPresent(s -> suggestions.hisaabGone(s, "Moved to another category in Hisaab"));
        fuel.findByHisaabTxnId(txnId).ifPresent(f -> {
            f.sourceIssue = "Moved to another category in Hisaab";
            fuel.save(f);
        });
    }

    /** Pending suggestions whose payment no longer comes back from Hisaab. At most 30 a run (rate limit: 60/min). */
    private int checkPending() {
        int gone = 0;
        List<Suggestion> pending = suggestionRepo.findByStatusAndHisaabTxnIdNotNull(Suggestion.Status.PENDING);
        for (Suggestion s : pending.stream().limit(30).toList()) {
            if (client.transaction(s.hisaabTxnId).isEmpty()) {
                suggestions.hisaabGone(s, "No longer in Hisaab (deleted or moved out of fuel)");
                gone++;
            }
        }
        return gone;
    }

    /** Once a day: confirmed fill-ups from the last 60 days whose payment disappeared from Hisaab. */
    private int checkConfirmed() {
        settings.set("hisaab.confirmedCheckedAt", Instant.now());
        int flagged = 0;
        for (FuelEntry f : fuel.findByHisaabTxnIdNotNullAndFilledAtAfter(Instant.now().minus(Duration.ofDays(60))).stream().limit(25).toList()) {
            if (client.transaction(f.hisaabTxnId).isEmpty() && f.sourceIssue == null) {
                f.sourceIssue = "This payment is no longer in Hisaab";
                fuel.save(f);
                flagged++;
            }
        }
        return flagged;
    }

    private boolean lastDailyCheckOlderThan(Duration d) {
        return settings.instant("hisaab.confirmedCheckedAt").map(t -> t.isBefore(Instant.now().minus(d))).orElse(true);
    }
}
