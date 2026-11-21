package com.raftaar.papers;

import com.raftaar.vehicle.VehicleRepo;
import com.raftaar.common.Files;
import com.raftaar.vehicle.VehicleStats;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import com.raftaar.common.ApiErrors;
import com.raftaar.vehicle.VehicleController;

/** Certificates and papers: insurance, PUC, RC, road tax… and your own, like a driving licence (no vehicle). */
@RestController
@RequestMapping("/api")
public class DocumentController {
    private final DocumentRepo documents;
    private final VehicleRepo vehicles;
    private final Files files;

    public DocumentController(DocumentRepo documents, VehicleRepo vehicles, Files files) {
        this.documents = documents;
        this.vehicles = vehicles;
        this.files = files;
    }

    @GetMapping("/documents")
    public List<VehicleStats.DocumentView> all() {
        return documents.findAll().stream().map(VehicleStats::documentView)
                .sorted(java.util.Comparator.comparing((VehicleStats.DocumentView d) -> d.document().expiresOn, java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder())))
                .toList();
    }

    @GetMapping("/vehicles/{id}/documents")
    public List<VehicleStats.DocumentView> forVehicle(@PathVariable Long id) {
        return documents.findByVehicleIdOrderByExpiresOnAsc(id).stream().map(VehicleStats::documentView).toList();
    }

    public record Input(Long vehicleId, Document.Type type, String title, String number, String provider, LocalDate issuedOn,
                        LocalDate expiresOn, Integer remindDaysBefore, BigDecimal cost, String notes) {}

    @PostMapping("/documents")
    public Document create(@RequestBody Input in) {
        return save(new Document(), in);
    }

    @PutMapping("/documents/{id}")
    public Document update(@PathVariable Long id, @RequestBody Input in) {
        return save(find(id), in);
    }

    private Document save(Document d, Input in) {
        if (in.vehicleId() != null && vehicles.findById(in.vehicleId()).isEmpty()) throw ApiErrors.notFound("Vehicle");
        d.vehicleId = in.vehicleId();
        d.type = in.type() != null ? in.type() : Document.Type.OTHER;
        d.title = in.title() != null && !in.title().isBlank() ? in.title().trim() : defaultTitle(d.type);
        d.number = VehicleController.trim(in.number());
        d.provider = VehicleController.trim(in.provider());
        d.issuedOn = in.issuedOn();
        boolean renewed = d.expiresOn != null && in.expiresOn() != null && in.expiresOn().isAfter(d.expiresOn);
        d.expiresOn = in.expiresOn();
        if (renewed) {
            d.lastNotifiedDays = null;
            d.lastNotifiedExpiry = null;
        }
        if (in.remindDaysBefore() != null) d.remindDaysBefore = Math.max(0, in.remindDaysBefore());
        d.cost = in.cost();
        d.notes = VehicleController.trim(in.notes());
        return documents.save(d);
    }

    static String defaultTitle(Document.Type t) {
        return switch (t) {
            case INSURANCE -> "Insurance";
            case PUC -> "PUC certificate";
            case RC -> "Registration certificate";
            case ROAD_TAX -> "Road tax";
            case FITNESS -> "Fitness certificate";
            case PERMIT -> "Permit";
            case LICENCE -> "Driving licence";
            case OTHER -> "Document";
        };
    }

    @DeleteMapping("/documents/{id}")
    public void delete(@PathVariable Long id) {
        Document d = find(id);
        files.delete(d.fileName);
        documents.delete(d);
    }

    @PutMapping(value = "/documents/{id}/file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Document upload(@PathVariable Long id, @RequestParam("file") MultipartFile file) throws IOException {
        Document d = find(id);
        String old = d.fileName;
        d.fileName = files.saveDocument(file);
        d.fileType = file.getContentType();
        d.fileOriginalName = file.getOriginalFilename();
        documents.save(d);
        files.delete(old);
        return d;
    }

    @DeleteMapping("/documents/{id}/file")
    public Document removeFile(@PathVariable Long id) {
        Document d = find(id);
        files.delete(d.fileName);
        d.fileName = null;
        d.fileType = null;
        d.fileOriginalName = null;
        return documents.save(d);
    }

    @GetMapping("/documents/{id}/file")
    public ResponseEntity<FileSystemResource> file(@PathVariable Long id) {
        Document d = find(id);
        if (d.fileName == null) return ResponseEntity.notFound().build();
        var res = new FileSystemResource(files.resolve(d.fileName));
        if (!res.exists()) return ResponseEntity.notFound().build();
        String name = d.fileOriginalName != null ? d.fileOriginalName : "document";
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(d.fileType != null ? d.fileType : "application/octet-stream"))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline().filename(name, StandardCharsets.UTF_8).build().toString())
                .header("X-Content-Type-Options", "nosniff")
                .body(res);
    }

    private Document find(Long id) {
        return documents.findById(id).orElseThrow(() -> ApiErrors.notFound("Document"));
    }
}
