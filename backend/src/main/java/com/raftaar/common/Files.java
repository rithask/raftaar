package com.raftaar.common;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Set;
import java.util.UUID;

/** Vehicle photos and document scans, kept on disk under STORAGE_DIR (not in the database). */
@Service
public class Files {
    private static final Set<String> IMAGE = Set.of("image/jpeg", "image/png", "image/webp", "image/heic", "image/avif");
    private static final Set<String> DOC = Set.of("image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf");

    private final Path root;

    public Files(AppProperties props) throws IOException {
        this.root = Path.of(props.storage().dir()).toAbsolutePath().normalize();
        java.nio.file.Files.createDirectories(root.resolve("vehicles"));
        java.nio.file.Files.createDirectories(root.resolve("documents"));
    }

    public String saveImage(MultipartFile f) throws IOException {
        return save("vehicles", f, IMAGE);
    }

    public String saveDocument(MultipartFile f) throws IOException {
        return save("documents", f, DOC);
    }

    private String save(String folder, MultipartFile f, Set<String> allowed) throws IOException {
        String type = f.getContentType();
        if (type == null || !allowed.contains(type)) throw new IllegalArgumentException("That kind of file isn't supported (" + type + ")");
        String ext = switch (type) {
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            case "image/heic" -> ".heic";
            case "image/avif" -> ".avif";
            default -> ".pdf";
        };
        String name = folder + "/" + UUID.randomUUID() + ext;
        try (var in = f.getInputStream()) {
            java.nio.file.Files.copy(in, resolve(name), StandardCopyOption.REPLACE_EXISTING);
        }
        return name;
    }

    public Path resolve(String name) {
        Path p = root.resolve(name).normalize();
        if (!p.startsWith(root)) throw new IllegalArgumentException("Bad file name");
        return p;
    }

    public void delete(String name) {
        if (name == null) return;
        try {
            java.nio.file.Files.deleteIfExists(resolve(name));
        } catch (IOException e) {
            // a leftover file is harmless, but worth knowing about if the folder isn't writable
            org.slf4j.LoggerFactory.getLogger(Files.class).warn("Couldn't delete {}: {}", name, Failures.reason(e));
        }
    }
}
