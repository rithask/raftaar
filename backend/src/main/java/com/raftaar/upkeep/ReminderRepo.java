package com.raftaar.upkeep;


import java.util.List;
import com.raftaar.common.EntityRepo;

public interface ReminderRepo extends EntityRepo<Reminder> {
    List<Reminder> findByVehicleIdOrderByIdAsc(Long vehicleId);
    List<Reminder> findByActiveTrue();
}
