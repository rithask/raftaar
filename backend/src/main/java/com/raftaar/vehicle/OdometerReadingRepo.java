package com.raftaar.vehicle;


import java.util.List;
import com.raftaar.common.EntityRepo;

public interface OdometerReadingRepo extends EntityRepo<OdometerReading> {
    List<OdometerReading> findByVehicleIdOrderByReadAtDesc(Long vehicleId);
}
