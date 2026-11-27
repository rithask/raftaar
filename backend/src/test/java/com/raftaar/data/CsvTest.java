package com.raftaar.data;

import org.junit.jupiter.api.Test;

import java.io.StringWriter;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class CsvTest {
    static final ZoneId INDIA = ZoneId.of("Asia/Kolkata");

    @Test
    void valuesAreWrittenPlainly() {
        assertEquals("1500", Csv.text(new BigDecimal("1500.00"), INDIA));
        assertEquals("102.5", Csv.text(new BigDecimal("102.50"), INDIA));
        assertEquals("2026-11-21T14:14:30+05:30", Csv.text(Instant.parse("2026-11-21T08:44:30.277Z"), INDIA));
        assertEquals("2026-11-21", Csv.text(LocalDate.of(2026, 11, 21), INDIA));
        assertEquals("", Csv.text(null, INDIA));
        assertEquals("true", Csv.text(true, INDIA));
    }

    @Test
    void awkwardFieldsAreQuoted() {
        assertEquals("plain", Csv.field("plain"));
        assertEquals("\"HP, Edappally\"", Csv.field("HP, Edappally"));
        assertEquals("\"said \"\"full\"\"\"", Csv.field("said \"full\""));
        assertEquals("\"two\nlines\"", Csv.field("two\nlines"));
    }

    @Test
    void whatIsWrittenReadsBack() throws Exception {
        var out = new StringWriter();
        out.write(Csv.BYTE_ORDER_MARK);
        Csv.writeRow(out, List.of("vehicle", "notes", "cost"), INDIA);
        Csv.writeRow(out, Arrays.asList("Activa", "chain, sprocket\n\"new\"", new BigDecimal("1600")), INDIA);
        Csv.writeRow(out, Arrays.asList("Activa", null, new BigDecimal("0")), INDIA);

        var rows = Csv.parse(out.toString());
        assertEquals(List.of("vehicle", "notes", "cost"), rows.get(0), "the byte order mark is skipped");
        assertEquals(List.of("Activa", "chain, sprocket\n\"new\"", "1600"), rows.get(1));
        assertEquals(List.of("Activa", "", "0"), rows.get(2));
        assertEquals(3, rows.size());
    }

    @Test
    void blankLinesAndAMissingLastNewlineAreFine() {
        assertEquals(List.of(List.of("a", "b"), List.of("1", "2")), Csv.parse("a,b\n\n1,2"));
    }
}
