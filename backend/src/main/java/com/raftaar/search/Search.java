package com.raftaar.search;

import com.raftaar.expense.ExpenseRepo;
import com.raftaar.fuel.FuelEntryRepo;
import com.raftaar.papers.DocumentRepo;
import com.raftaar.upkeep.ReminderRepo;
import com.raftaar.upkeep.ServiceRecordRepo;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.stream.Stream;

/**
 * Searching your records by the words in them: fill-ups (pump, place, notes), services (title, workshop, notes),
 * expenses (title, vendor, notes), papers (title, number, provider, notes) and reminders (title, notes).
 * Case-insensitive, anywhere in the text. A personal history is small enough that this needs no index.
 */
@Service
@Transactional(readOnly = true)
public class Search {
    /** The most of each kind returned: enough to find it, few enough to read. */
    static final int PER_KIND = 20;
    /** Shorter than this matches too much to be useful. */
    static final int MIN_LENGTH = 2;

    public enum Kind { FUEL, SERVICE, EXPENSE, PAPER, REMINDER }

    /**
     * One record that matched. {@code on}: its day (a paper's expiry); {@code amount}: what it cost, if anything;
     * {@code detail}: a line saying where it was or more about it.
     */
    public record Hit(Kind kind, Long id, Long vehicleId, String title, String detail, LocalDate on, BigDecimal amount) {}

    private final FuelEntryRepo fills;
    private final ServiceRecordRepo services;
    private final ExpenseRepo expenses;
    private final DocumentRepo papers;
    private final ReminderRepo reminders;

    public Search(FuelEntryRepo fills, ServiceRecordRepo services, ExpenseRepo expenses, DocumentRepo papers, ReminderRepo reminders) {
        this.fills = fills;
        this.services = services;
        this.expenses = expenses;
        this.papers = papers;
        this.reminders = reminders;
    }

    /** What matches {@code query}, by kind (fill-ups, services, expenses, papers, reminders), each newest first. */
    public List<Hit> find(String query) {
        String words = query == null ? "" : query.strip();
        if (words.length() < MIN_LENGTH) return List.of();
        String text = likePattern(words);
        Limit limit = Limit.of(PER_KIND);
        ZoneId zone = ZoneId.systemDefault();
        var hits = new ArrayList<Hit>();
        fills.search(text, limit).forEach(fill -> hits.add(new Hit(Kind.FUEL, fill.id, fill.vehicleId,
                firstOf(fill.stationName, fill.stationBrand, "Fill-up"), joined(fill.district, fill.region, fill.notes),
                fill.filledAt.atZone(zone).toLocalDate(), fill.totalCost)));
        services.search(text, limit).forEach(service -> hits.add(new Hit(Kind.SERVICE, service.id, service.vehicleId,
                service.title, joined(service.workshop, service.notes), service.servicedOn, service.cost)));
        expenses.search(text, limit).forEach(expense -> hits.add(new Hit(Kind.EXPENSE, expense.id, expense.vehicleId,
                expense.title, joined(expense.vendor, expense.notes), expense.spentOn, expense.amount)));
        papers.search(text, limit).forEach(paper -> hits.add(new Hit(Kind.PAPER, paper.id, paper.vehicleId,
                paper.title, joined(paper.number, paper.provider, paper.notes), paper.expiresOn, paper.cost)));
        reminders.search(text, limit).forEach(reminder -> hits.add(new Hit(Kind.REMINDER, reminder.id, reminder.vehicleId,
                reminder.title, reminder.notes, null, null)));
        return hits;
    }

    /** {@code words} anywhere in the text, case-insensitive, with LIKE's own wildcards taken literally. */
    static String likePattern(String words) {
        String escaped = words.toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return "%" + escaped + "%";
    }

    private static String firstOf(String... values) {
        return Stream.of(values).filter(value -> value != null && !value.isBlank()).findFirst().orElse(null);
    }

    private static String joined(String... values) {
        String text = String.join(" · ", Stream.of(values).filter(Objects::nonNull).map(String::strip).filter(value -> !value.isEmpty()).toList());
        return text.isEmpty() ? null : text;
    }
}
