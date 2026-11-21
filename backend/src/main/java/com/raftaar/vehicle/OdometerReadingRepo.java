package com.raftaar.vehicle;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OdometerReadingRepo extends JpaRepository<OdometerReading, Long> {
    List<OdometerReading> findByVehicleIdOrderByReadAtDesc(Long vehicleId);
}
