package com.raftaar.repo;

import com.raftaar.domain.OdometerReading;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OdometerReadingRepo extends JpaRepository<OdometerReading, Long> {
    List<OdometerReading> findByVehicleIdOrderByReadAtDesc(Long vehicleId);
}
