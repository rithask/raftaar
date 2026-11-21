package com.raftaar.papers;

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
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api")
public class DocumentController {
    private final Papers papers;
    private final Files files;

    public DocumentController(Papers papers, Files files) {
        this.papers = papers;
        this.files = files;
    }

    @GetMapping("/documents")
    public List<VehicleStats.DocumentView> all() {
        return papers.all();
    }

    @GetMapping("/vehicles/{vehicleId}/documents")
    public List<VehicleStats.DocumentView> forVehicle(@PathVariable Long vehicleId) {
        return papers.forVehicle(vehicleId);
    }

    @PostMapping("/documents")
    public Document create(@RequestBody Papers.Input input) {
        return papers.create(input);
    }

    @PutMapping("/documents/{id}")
    public Document update(@PathVariable Long id, @RequestBody Papers.Input input) {
        return papers.update(id, input);
    }

    @DeleteMapping("/documents/{id}")
    public void delete(@PathVariable Long id) {
        papers.delete(id);
    }

    @PutMapping(value = "/documents/{id}/file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Document attachFile(@PathVariable Long id, @RequestParam("file") MultipartFile file) throws IOException {
        return papers.attachFile(id, file);
    }

    @DeleteMapping("/documents/{id}/file")
    public Document removeFile(@PathVariable Long id) {
        return papers.removeFile(id);
    }

    /** The attached scan, shown in the browser (never run as a page: nosniff), under its original name. */
    @GetMapping("/documents/{id}/file")
    public ResponseEntity<FileSystemResource> file(@PathVariable Long id) {
        Document paper = papers.get(id);
        if (paper.fileName == null) return ResponseEntity.notFound().build();
        var file = new FileSystemResource(files.resolve(paper.fileName));
        if (!file.exists()) return ResponseEntity.notFound().build();
        String name = paper.fileOriginalName != null ? paper.fileOriginalName : "document";
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(paper.fileType != null ? paper.fileType : "application/octet-stream"))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline().filename(name, StandardCharsets.UTF_8).build().toString())
                .header("X-Content-Type-Options", "nosniff")
                .body(file);
    }
}
