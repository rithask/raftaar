package com.raftaar.upkeep;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import com.raftaar.common.EntityRepo;
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
}
