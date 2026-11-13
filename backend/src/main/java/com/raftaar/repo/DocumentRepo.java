package com.raftaar.repo;

import com.raftaar.domain.Document;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DocumentRepo extends JpaRepository<Document, Long> {
    List<Document> findByVehicleIdOrderByExpiresOnAsc(Long vehicleId);
    List<Document> findByVehicleIdIsNullOrderByExpiresOnAsc();
    List<Document> findByExpiresOnNotNull();
}
