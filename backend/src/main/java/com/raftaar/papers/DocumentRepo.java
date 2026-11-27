package com.raftaar.papers;


import java.util.List;
import com.raftaar.common.EntityRepo;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.Query;
import java.util.Collection;

public interface DocumentRepo extends EntityRepo<Document> {
    List<Document> findByVehicleIdOrderByExpiresOnAscIdAsc(Long vehicleId);
    List<Document> findByVehicleIdInOrderByExpiresOnAscIdAsc(Collection<Long> vehicleIds);
    List<Document> findByVehicleIdIsNullOrderByExpiresOnAscIdAsc();
    List<Document> findByExpiresOnNotNull();
    /** Papers whose title, number, provider or notes contain {@code text} (a lowercase LIKE pattern), latest expiry first. */
    @Query("select d from Document d where lower(d.title) like :text escape '\\' or lower(d.number) like :text escape '\\' or lower(d.provider) like :text escape '\\' or lower(d.notes) like :text escape '\\' order by d.expiresOn desc nulls last, d.id desc")
    List<Document> search(String text, Limit limit);
    /** Removes what an import added (DataImport.remove). */
    @Transactional
    long deleteByImportBatchId(Long importBatchId);
    boolean existsByVehicleId(Long vehicleId);
}
