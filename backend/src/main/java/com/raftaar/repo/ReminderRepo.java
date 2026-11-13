package com.raftaar.repo;

import com.raftaar.domain.Reminder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReminderRepo extends JpaRepository<Reminder, Long> {
    List<Reminder> findByVehicleIdOrderByIdAsc(Long vehicleId);
    List<Reminder> findByActiveTrue();
}
