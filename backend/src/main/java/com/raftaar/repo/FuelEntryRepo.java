package com.raftaar.repo;

import com.raftaar.domain.FuelEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface FuelEntryRepo extends JpaRepository<FuelEntry, Long> {
    List<FuelEntry> findByVehicleIdOrderByFilledAtAscIdAsc(Long vehicleId);
    Optional<FuelEntry> findByHisaabTxnId(String id);
    List<FuelEntry> findByHisaabTxnIdNotNullAndFilledAtAfter(Instant after);
    Optional<FuelEntry> findFirstByVehicleIdOrderByFilledAtDescIdDesc(Long vehicleId);
}
