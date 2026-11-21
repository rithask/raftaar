package com.raftaar.expense;


import java.util.List;
import java.util.Optional;
import com.raftaar.common.EntityRepo;

public interface ExpenseRepo extends EntityRepo<Expense> {
    List<Expense> findByVehicleIdOrderBySpentOnDescIdDesc(Long vehicleId);
    Optional<Expense> findByHisaabTxnId(String id);
}
