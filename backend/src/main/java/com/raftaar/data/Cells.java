package com.raftaar.data;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * One row of an imported file, read by column name. A value can be asked for under several names (other apps call
 * the same thing differently, "Odometer", "Odo (km)", "Odômetro"): names are compared lowercase, without accents,
 * and with anything after a bracket dropped, so "Price (optional)" is "price".
 *
 * Values are read the way apps write them: numbers with ₹ or thousands separators or a decimal comma, dates as ISO,
 * "2026-11-21 14:30", "21/11/2026" (day first) and the like, and yes/no as true/false, 1/0, yes/no or sim/não.
 */
final class Cells {
    private final Map<String, String> byName;

    private Cells(Map<String, String> byName) {
        this.byName = byName;
    }

    /** Each row after the header as Cells, by the header's names. */
    static List<Cells> table(List<List<String>> rows) {
        if (rows.isEmpty()) return List.of();
        List<String> header = rows.getFirst().stream().map(Cells::key).toList();
        return rows.subList(1, rows.size()).stream().map(row -> {
            var byName = new HashMap<String, String>();
            for (int i = 0; i < header.size() && i < row.size(); i++) byName.putIfAbsent(header.get(i), row.get(i).strip());
            return new Cells(byName);
        }).toList();
    }

    /** The header's names as Cells compares them. */
    static Set<String> names(List<String> header) {
        return Set.copyOf(header.stream().map(Cells::key).toList());
    }

    /** A column name as compared: lowercase, accents and anything from a bracket on dropped, spaces single. */
    static String key(String name) {
        String plain = Normalizer.normalize(name, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
        int bracket = plain.indexOf('(');
        if (bracket > 0) plain = plain.substring(0, bracket);
        return plain.replace('_', ' ').replaceAll("\\s+", " ").strip();
    }

    /** The first of {@code names} with something in it; null if none has. */
    String text(String... names) {
        for (String name : names) {
            String value = byName.get(key(name));
            if (value != null && !value.isBlank()) return value;
        }
        return null;
    }

    BigDecimal number(String... names) {
        return parseNumber(text(names));
    }

    LocalDate date(String... names) {
        String text = text(names);
        if (text == null) return null;
        Instant instant = parseInstant(text, ZoneId.systemDefault());
        return instant == null ? null : instant.atZone(ZoneId.systemDefault()).toLocalDate();
    }

    Instant instant(String... names) {
        String text = text(names);
        return text == null ? null : parseInstant(text, ZoneId.systemDefault());
    }

    /** True for true/yes/1/y/sim; false for anything else written; {@code otherwise} when empty. */
    boolean yes(boolean otherwise, String... names) {
        String text = text(names);
        if (text == null) return otherwise;
        return Set.of("true", "yes", "y", "1", "sim", "s").contains(text.strip().toLowerCase(Locale.ROOT));
    }

    // ---- reading values ----------------------------------------------------------------------------------------

    /** "₹1,234.50", "1.234,50", "102,5", "-": a number, or null. */
    static BigDecimal parseNumber(String text) {
        if (text == null) return null;
        String digits = text.replaceAll("[^0-9.,\\-]", "");
        if (digits.isEmpty() || digits.equals("-")) return null;
        int dot = digits.lastIndexOf('.'), comma = digits.lastIndexOf(',');
        if (dot >= 0 && comma >= 0) {
            // both: whichever comes last is the decimal point
            digits = dot > comma ? digits.replace(",", "") : digits.replace(".", "").replace(',', '.');
        } else if (comma >= 0) {
            // only commas: one with one or two digits after it is a decimal comma (102,5); otherwise thousands (1,234)
            boolean decimal = digits.indexOf(',') == comma && digits.length() - comma - 1 <= 2;
            digits = decimal ? digits.replace(',', '.') : digits.replace(",", "");
        }
        try {
            return new BigDecimal(digits);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static final List<DateTimeFormatter> DATE_TIMES = List.of(
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm[:ss]"), DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm[:ss]"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm[:ss]"), DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm[:ss]"),
            DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm[:ss]"));
    private static final List<DateTimeFormatter> DATES = List.of(
            DateTimeFormatter.ISO_LOCAL_DATE, DateTimeFormatter.ofPattern("dd/MM/yyyy"), DateTimeFormatter.ofPattern("dd-MM-yyyy"),
            DateTimeFormatter.ofPattern("dd.MM.yyyy"), DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH));

    /** A moment from the ways apps write one; a day alone is taken as noon, so it stays that day in any zone. */
    static Instant parseInstant(String text, ZoneId zone) {
        String value = text.strip();
        try {
            return OffsetDateTime.parse(value).toInstant();
        } catch (DateTimeParseException ignored) {
            // not ISO with an offset: try the others
        }
        if (value.matches("\\d{12,13}")) return Instant.ofEpochMilli(Long.parseLong(value)); // milliseconds, as Fuelio keeps ids
        for (DateTimeFormatter format : DATE_TIMES) {
            try {
                return LocalDateTime.parse(value, format).atZone(zone).toInstant();
            } catch (DateTimeParseException ignored) {
                // next format
            }
        }
        for (DateTimeFormatter format : DATES) {
            try {
                return LocalDate.parse(value, format).atTime(12, 0).atZone(zone).toInstant();
            } catch (DateTimeParseException ignored) {
                // next format
            }
        }
        return null;
    }
}
