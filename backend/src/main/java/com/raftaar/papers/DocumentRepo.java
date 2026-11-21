package com.raftaar.papers;


import java.util.List;
import com.raftaar.common.EntityRepo;

public interface DocumentRepo extends EntityRepo<Document> {
    List<Document> findByVehicleIdOrderByExpiresOnAsc(Long vehicleId);
    List<Document> findByVehicleIdIsNullOrderByExpiresOnAsc();
    List<Document> findByExpiresOnNotNull();
}
