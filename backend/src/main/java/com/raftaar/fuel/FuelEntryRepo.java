package com.raftaar.fuel;


import java.time.Instant;
import java.util.List;
import java.util.Optional;
import com.raftaar.common.EntityRepo;

public interface FuelEntryRepo extends EntityRepo<FuelEntry> {
    List<FuelEntry> findByVehicleIdOrderByFilledAtAscIdAsc(Long vehicleId);
    Optional<FuelEntry> findByHisaabTxnId(String id);
    List<FuelEntry> findByHisaabTxnIdNotNullAndFilledAtAfter(Instant after);
    Optional<FuelEntry> findFirstByVehicleIdOrderByFilledAtDescIdDesc(Long vehicleId);
    Optional<FuelEntry> findFirstByVehicleIdAndFilledAtAndOdometer(Long vehicleId, java.time.Instant filledAt, java.math.BigDecimal odometer);
}
