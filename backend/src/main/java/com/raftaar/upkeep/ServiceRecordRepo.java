package com.raftaar.upkeep;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ServiceRecordRepo extends JpaRepository<ServiceRecord, Long> {
    List<ServiceRecord> findByVehicleIdOrderByServicedOnDescIdDesc(Long vehicleId);

    @Query(value = "select reminder_id from service_record_reminder where service_record_id = ?1", nativeQuery = true)
    List<Long> reminderIds(Long serviceRecordId);

    @Modifying
    @Query(value = "delete from service_record_reminder where service_record_id = ?1", nativeQuery = true)
    void clearReminders(Long serviceRecordId);

    @Modifying
    @Query(value = "insert into service_record_reminder (service_record_id, reminder_id) values (?1, ?2) on conflict do nothing", nativeQuery = true)
    void linkReminder(Long serviceRecordId, Long reminderId);
}
