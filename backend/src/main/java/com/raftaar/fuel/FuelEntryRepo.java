package com.raftaar.fuel;


import java.time.Instant;
import java.util.List;
import java.util.Optional;
import com.raftaar.common.EntityRepo;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.Query;
import java.util.Collection;

public interface FuelEntryRepo extends EntityRepo<FuelEntry> {
    List<FuelEntry> findByVehicleIdOrderByFilledAtAscIdAsc(Long vehicleId);
    List<FuelEntry> findByVehicleIdInOrderByFilledAtAscIdAsc(Collection<Long> vehicleIds);
    Optional<FuelEntry> findByHisaabTxnId(String id);
    List<FuelEntry> findByHisaabTxnIdIn(Collection<String> ids);
    /** Fill-ups whose Hisaab payment changed or disappeared since. */
    List<FuelEntry> findBySourceIssueIsNotNullOrderByIdAsc();
    List<FuelEntry> findByHisaabTxnIdNotNullAndFilledAtAfter(Instant after);
    /** Every vehicle's fill-ups in a time window (a payment or a stop is matched against these). */
    List<FuelEntry> findByFilledAtBetweenOrderByVehicleIdAscFilledAtAscIdAsc(Instant from, Instant to);
    Optional<FuelEntry> findFirstByVehicleIdOrderByFilledAtDescIdDesc(Long vehicleId);
    Optional<FuelEntry> findFirstByVehicleIdAndFilledAtAndOdometer(Long vehicleId, java.time.Instant filledAt, java.math.BigDecimal odometer);
    /** Fill-ups whose pump, place or notes contain {@code text} (a lowercase LIKE pattern), newest first. */
    @Query("select f from FuelEntry f where lower(f.stationName) like :text escape '\\' or lower(f.stationBrand) like :text escape '\\' or lower(f.district) like :text escape '\\' or lower(f.region) like :text escape '\\' or lower(f.notes) like :text escape '\\' order by f.filledAt desc, f.id desc")
    List<FuelEntry> search(String text, Limit limit);
    /** Removes what an import added (DataImport.remove). */
    @Transactional
    long deleteByImportBatchId(Long importBatchId);
    boolean existsByVehicleId(Long vehicleId);
}
