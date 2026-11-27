package com.raftaar.vehicle;


import java.util.List;
import com.raftaar.common.EntityRepo;
import org.springframework.transaction.annotation.Transactional;
import java.util.Collection;

public interface OdometerReadingRepo extends EntityRepo<OdometerReading> {
    List<OdometerReading> findByVehicleIdOrderByReadAtDesc(Long vehicleId);
    List<OdometerReading> findByVehicleIdInOrderByReadAtDesc(Collection<Long> vehicleIds);
    /** Removes what an import added (DataImport.remove). */
    @Transactional
    long deleteByImportBatchId(Long importBatchId);
    boolean existsByVehicleId(Long vehicleId);
}
