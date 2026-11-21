package com.raftaar.upkeep;


import java.util.List;
import com.raftaar.common.EntityRepo;
import java.util.Collection;

public interface ReminderRepo extends EntityRepo<Reminder> {
    List<Reminder> findByVehicleIdOrderByIdAsc(Long vehicleId);
    List<Reminder> findByVehicleIdInOrderByIdAsc(Collection<Long> vehicleIds);
    List<Reminder> findByActiveTrue();
}
