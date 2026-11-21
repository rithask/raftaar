package com.raftaar.vehicle;


import java.util.List;
import com.raftaar.common.EntityRepo;

public interface VehicleRepo extends EntityRepo<Vehicle> {
    List<Vehicle> findAllByOrderByArchivedAscSortOrderAscIdAsc();
    List<Vehicle> findByArchivedFalse();
}
