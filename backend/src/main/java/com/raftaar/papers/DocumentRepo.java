package com.raftaar.papers;


import java.util.List;
import com.raftaar.common.EntityRepo;
import java.util.Collection;

public interface DocumentRepo extends EntityRepo<Document> {
    List<Document> findByVehicleIdOrderByExpiresOnAscIdAsc(Long vehicleId);
    List<Document> findByVehicleIdInOrderByExpiresOnAscIdAsc(Collection<Long> vehicleIds);
    List<Document> findByVehicleIdIsNullOrderByExpiresOnAscIdAsc();
    List<Document> findByExpiresOnNotNull();
}
