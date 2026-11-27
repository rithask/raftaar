package com.raftaar.data;

import com.raftaar.common.EntityRepo;

import java.util.List;

public interface ImportBatchRepo extends EntityRepo<ImportBatch> {
    List<ImportBatch> findAllByOrderByCreatedAtDescIdDesc();
}
