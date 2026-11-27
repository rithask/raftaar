package com.raftaar.data;

import java.io.IOException;
import java.io.Writer;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAccessor;
import java.util.ArrayList;
import java.util.List;

/**
 * Comma-separated values as spreadsheets read and write them (RFC 4180): a field with a comma, a quote or a line
 * break is quoted, and quotes inside it doubled. Values are written plainly so a spreadsheet can calculate with
 * them: numbers unformatted, dates ISO (times with their offset), true/false, empty for nothing.
 */
public final class Csv {
    private Csv() {}

    /** Before the header, so a spreadsheet opens the file as UTF-8 (₹, names in other scripts). */
    public static final String BYTE_ORDER_MARK = "﻿";

    public static void writeRow(Writer out, List<?> values, ZoneId zone) throws IOException {
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) out.write(',');
            out.write(field(text(values.get(i), zone)));
        }
        out.write("\r\n");
    }

    static String text(Object value, ZoneId zone) {
        return switch (value) {
            case null -> "";
            case BigDecimal number -> number.stripTrailingZeros().toPlainString();
            case Instant instant -> DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(instant.atZone(zone).withNano(0));
            case TemporalAccessor date -> date.toString();
            case Enum<?> constant -> constant.name();
            default -> value.toString();
        };
    }

    static String field(String text) {
        if (text.indexOf(',') < 0 && text.indexOf('"') < 0 && text.indexOf('\n') < 0 && text.indexOf('\r') < 0) return text;
        return '"' + text.replace("\"", "\"\"") + '"';
    }

    /**
     * Every row of {@code text}, each a list of its fields: quoted fields may hold commas, quotes ("") and line
     * breaks. A leading byte order mark is skipped, and blank lines are left out.
     */
    public static List<List<String>> parse(String text) {
        var rows = new ArrayList<List<String>>();
        var row = new ArrayList<String>();
        var field = new StringBuilder();
        boolean quoted = false;
        int i = text.startsWith(BYTE_ORDER_MARK) ? 1 : 0;
        for (; i < text.length(); i++) {
            char c = text.charAt(i);
            if (quoted) {
                if (c == '"' && i + 1 < text.length() && text.charAt(i + 1) == '"') { field.append('"'); i++; }
                else if (c == '"') quoted = false;
                else field.append(c);
            } else if (c == '"') quoted = true;
            else if (c == ',') { row.add(field.toString()); field.setLength(0); }
            else if (c == '\n' || c == '\r') {
                if (c == '\r' && i + 1 < text.length() && text.charAt(i + 1) == '\n') i++;
                row.add(field.toString()); field.setLength(0);
                if (!(row.size() == 1 && row.getFirst().isEmpty())) rows.add(row);
                row = new ArrayList<>();
            } else field.append(c);
        }
        if (!field.isEmpty() || !row.isEmpty()) { row.add(field.toString()); rows.add(row); }
        return rows;
    }
}
