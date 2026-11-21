package com.raftaar.papers;

import com.raftaar.common.Files;
import com.raftaar.common.Text;
import com.raftaar.vehicle.VehicleRepo;
import com.raftaar.vehicle.VehicleStats;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import org.springframework.transaction.annotation.Transactional;

/** Certificates and papers: insurance, PUC, RC, road tax… and your own, like a driving licence (no vehicle). */
@Service
public class Papers {
    private final DocumentRepo papers;
    private final VehicleRepo vehicles;
    private final Files files;

    public Papers(DocumentRepo papers, VehicleRepo vehicles, Files files) {
        this.papers = papers;
        this.vehicles = vehicles;
        this.files = files;
    }

    public record Input(Long vehicleId, Document.Type type, String title, String number, String provider, LocalDate issuedOn,
                        LocalDate expiresOn, Integer remindDaysBefore, BigDecimal cost, String notes) {}

    /** Every paper, soonest to expire first (no expiry last). */
    @Transactional(readOnly = true)
    public List<VehicleStats.DocumentView> all() {
        return papers.findAll().stream().map(VehicleStats::documentView)
                .sorted(Comparator.comparing((VehicleStats.DocumentView view) -> view.document().expiresOn, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<VehicleStats.DocumentView> forVehicle(Long vehicleId) {
        return papers.findByVehicleIdOrderByExpiresOnAscIdAsc(vehicleId).stream().map(VehicleStats::documentView).toList();
    }

    @Transactional(readOnly = true)
    public Document get(Long id) {
        return papers.require(id, "Document");
    }

    public Document create(Input input) {
        return save(new Document(), input);
    }

    public Document update(Long id, Input input) {
        return save(get(id), input);
    }

    public void delete(Long id) {
        Document paper = get(id);
        files.delete(paper.fileName);
        papers.delete(paper);
    }

    /** Attaches the scan or photo, replacing any earlier one. */
    public Document attachFile(Long id, MultipartFile file) throws IOException {
        Document paper = get(id);
        String previous = paper.fileName;
        paper.fileName = files.saveDocument(file);
        paper.fileType = file.getContentType();
        paper.fileOriginalName = file.getOriginalFilename();
        papers.save(paper);
        files.delete(previous);
        return paper;
    }

    public Document removeFile(Long id) {
        Document paper = get(id);
        files.delete(paper.fileName);
        paper.fileName = null;
        paper.fileType = null;
        paper.fileOriginalName = null;
        return papers.save(paper);
    }

    private Document save(Document paper, Input input) {
        if (input.vehicleId() != null) vehicles.require(input.vehicleId(), "Vehicle");
        paper.vehicleId = input.vehicleId();
        paper.type = input.type() != null ? input.type() : Document.Type.OTHER;
        paper.title = input.title() != null && !input.title().isBlank() ? input.title().trim() : defaultTitle(paper.type);
        paper.number = Text.trimToNull(input.number());
        paper.provider = Text.trimToNull(input.provider());
        paper.issuedOn = input.issuedOn();
        // a later expiry is a renewal: the expiry warnings start over
        boolean renewed = paper.expiresOn != null && input.expiresOn() != null && input.expiresOn().isAfter(paper.expiresOn);
        paper.expiresOn = input.expiresOn();
        if (renewed) {
            paper.lastNotifiedDays = null;
            paper.lastNotifiedExpiry = null;
        }
        if (input.remindDaysBefore() != null) paper.remindDaysBefore = Math.max(0, input.remindDaysBefore());
        paper.cost = input.cost();
        paper.notes = Text.trimToNull(input.notes());
        return papers.save(paper);
    }

    static String defaultTitle(Document.Type type) {
        return switch (type) {
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
}
