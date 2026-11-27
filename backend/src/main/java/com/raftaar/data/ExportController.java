package com.raftaar.data;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Locale;

/** Downloads: /api/export/fuel.csv, /api/export/all.zip, each optionally for one vehicle (?vehicleId=). */
@RestController
@RequestMapping("/api/export")
public class ExportController {
    private final DataExport export;

    public ExportController(DataExport export) {
        this.export = export;
    }

    @GetMapping("/{table}.csv")
    public ResponseEntity<StreamingResponseBody> csv(@PathVariable String table, @RequestParam(required = false) Long vehicleId) {
        DataExport.Table chosen = DataExport.Table.named(table);
        return download(fileName(chosen.file, vehicleId) + ".csv", new MediaType("text", "csv", StandardCharsets.UTF_8),
                out -> export.write(chosen, vehicleId, out));
    }

    @GetMapping("/all.zip")
    public ResponseEntity<StreamingResponseBody> all(@RequestParam(required = false) Long vehicleId) {
        return download(fileName("export", vehicleId) + ".zip", MediaType.parseMediaType("application/zip"), out -> export.writeAll(vehicleId, out));
    }

    /** "raftaar-fuel-2026-11-27", or "raftaar-activa-fuel-2026-11-27" for one vehicle. */
    private String fileName(String what, Long vehicleId) {
        String vehicle = export.vehicleName(vehicleId);
        String slug = vehicle == null ? "" : vehicle.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "") + "-";
        return "raftaar-" + slug + what + "-" + LocalDate.now();
    }

    private static ResponseEntity<StreamingResponseBody> download(String name, MediaType type, StreamingResponseBody body) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(name, StandardCharsets.UTF_8).build().toString())
                .contentType(type)
                .body(body);
    }
}
