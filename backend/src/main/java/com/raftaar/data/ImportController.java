package com.raftaar.data;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.List;
import java.util.Map;

/**
 * Importing a file: POST /api/import/preview with the file, then POST /api/import with the same file and, as
 * {@code vehicles}, a JSON object of each vehicle name in it to the vehicle id to use (null for a new one).
 * Past imports: GET /api/imports, and DELETE /api/imports/{id} to remove one.
 */
@RestController
@RequestMapping("/api")
public class ImportController {
    private final DataImport imports;
    private final ObjectMapper json;

    public ImportController(DataImport imports, ObjectMapper json) {
        this.imports = imports;
        this.json = json;
    }

    @PostMapping("/import/preview")
    public DataImport.Preview preview(@RequestParam MultipartFile file) throws IOException {
        return imports.preview(file.getOriginalFilename(), file.getBytes());
    }

    @PostMapping("/import")
    public DataImport.Result run(@RequestParam MultipartFile file, @RequestParam(defaultValue = "{}") String vehicles) throws IOException {
        Map<String, Long> choices = json.readValue(vehicles, new TypeReference<>() {});
        return imports.run(file.getOriginalFilename(), file.getBytes(), choices);
    }

    @GetMapping("/imports")
    public List<ImportBatch> list() {
        return imports.list();
    }

    @DeleteMapping("/imports/{id}")
    public void remove(@PathVariable Long id) {
        imports.remove(id);
    }
}
