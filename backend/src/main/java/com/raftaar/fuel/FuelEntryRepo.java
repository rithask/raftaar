package com.raftaar.fuel;


import java.time.Instant;
import java.util.List;
import java.util.Optional;
import com.raftaar.common.EntityRepo;
import java.util.Collection;

public interface FuelEntryRepo extends EntityRepo<FuelEntry> {
    List<FuelEntry> findByVehicleIdOrderByFilledAtAscIdAsc(Long vehicleId);
    List<FuelEntry> findByVehicleIdInOrderByFilledAtAscIdAsc(Collection<Long> vehicleIds);
    Optional<FuelEntry> findByHisaabTxnId(String id);
    /** Fill-ups whose Hisaab payment changed or disappeared since. */
    List<FuelEntry> findBySourceIssueIsNotNullOrderByIdAsc();
    List<FuelEntry> findByHisaabTxnIdNotNullAndFilledAtAfter(Instant after);
    /** Every vehicle's fill-ups in a time window (a payment or a stop is matched against these). */
    List<FuelEntry> findByFilledAtBetweenOrderByVehicleIdAscFilledAtAscIdAsc(Instant from, Instant to);
    Optional<FuelEntry> findFirstByVehicleIdOrderByFilledAtDescIdDesc(Long vehicleId);
    Optional<FuelEntry> findFirstByVehicleIdAndFilledAtAndOdometer(Long vehicleId, java.time.Instant filledAt, java.math.BigDecimal odometer);
}
