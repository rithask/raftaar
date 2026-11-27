package com.raftaar.expense;


import java.util.List;
import java.util.Optional;
import com.raftaar.common.EntityRepo;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.Query;
import java.util.Collection;

public interface ExpenseRepo extends EntityRepo<Expense> {
    List<Expense> findByVehicleIdOrderBySpentOnDescIdDesc(Long vehicleId);
    List<Expense> findByVehicleIdInOrderBySpentOnDescIdDesc(Collection<Long> vehicleIds);
    Optional<Expense> findByHisaabTxnId(String id);
    List<Expense> findByHisaabTxnIdIn(Collection<String> ids);
    /** Expenses whose title, vendor or notes contain {@code text} (a lowercase LIKE pattern), newest first. */
    @Query("select e from Expense e where lower(e.title) like :text escape '\\' or lower(e.vendor) like :text escape '\\' or lower(e.notes) like :text escape '\\' order by e.spentOn desc, e.id desc")
    List<Expense> search(String text, Limit limit);
}
