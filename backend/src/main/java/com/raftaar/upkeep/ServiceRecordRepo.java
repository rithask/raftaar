package com.raftaar.upkeep;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import com.raftaar.common.EntityRepo;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Limit;
import java.util.Collection;

public interface ServiceRecordRepo extends EntityRepo<ServiceRecord> {
    List<ServiceRecord> findByVehicleIdOrderByServicedOnDescIdDesc(Long vehicleId);
    List<ServiceRecord> findByVehicleIdInOrderByServicedOnDescIdDesc(Collection<Long> vehicleIds);
    /** Which reminders each of these services completed: rows of (service id, reminder id). */
    @Query(value = "select service_record_id, reminder_id from service_record_reminder where service_record_id in ?1", nativeQuery = true)
    List<Object[]> reminderLinks(Collection<Long> serviceRecordIds);

    @Query(value = "select reminder_id from service_record_reminder where service_record_id = ?1", nativeQuery = true)
    List<Long> reminderIds(Long serviceRecordId);

    @Modifying
    @Query(value = "delete from service_record_reminder where service_record_id = ?1", nativeQuery = true)
    void clearReminders(Long serviceRecordId);

    @Modifying
    @Query(value = "insert into service_record_reminder (service_record_id, reminder_id) values (?1, ?2) on conflict do nothing", nativeQuery = true)
    void linkReminder(Long serviceRecordId, Long reminderId);
    /** Services whose title, workshop or notes contain {@code text} (a lowercase LIKE pattern), newest first. */
    @Query("select s from ServiceRecord s where lower(s.title) like :text escape '\\' or lower(s.workshop) like :text escape '\\' or lower(s.notes) like :text escape '\\' order by s.servicedOn desc, s.id desc")
    List<ServiceRecord> search(String text, Limit limit);
    /** Removes what an import added (DataImport.remove). */
    @Transactional
    long deleteByImportBatchId(Long importBatchId);
    boolean existsByVehicleId(Long vehicleId);
}
