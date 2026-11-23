package com.raftaar.expense;


import java.util.List;
import java.util.Optional;
import com.raftaar.common.EntityRepo;
import java.util.Collection;

public interface ExpenseRepo extends EntityRepo<Expense> {
    List<Expense> findByVehicleIdOrderBySpentOnDescIdDesc(Long vehicleId);
    List<Expense> findByVehicleIdInOrderBySpentOnDescIdDesc(Collection<Long> vehicleIds);
    Optional<Expense> findByHisaabTxnId(String id);
    List<Expense> findByHisaabTxnIdIn(Collection<String> ids);
}
