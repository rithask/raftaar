package com.raftaar.upkeep;


import java.util.List;
import com.raftaar.common.EntityRepo;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.Query;
import java.util.Collection;

public interface ReminderRepo extends EntityRepo<Reminder> {
    List<Reminder> findByVehicleIdOrderByIdAsc(Long vehicleId);
    List<Reminder> findByVehicleIdInOrderByIdAsc(Collection<Long> vehicleIds);
    List<Reminder> findByActiveTrue();
    /** Reminders whose title or notes contain {@code text} (a lowercase LIKE pattern). */
    @Query("select r from Reminder r where lower(r.title) like :text escape '\\' or lower(r.notes) like :text escape '\\' order by r.id desc")
    List<Reminder> search(String text, Limit limit);
    /** Removes what an import added (DataImport.remove). */
    @Transactional
    long deleteByImportBatchId(Long importBatchId);
    boolean existsByVehicleId(Long vehicleId);
}
