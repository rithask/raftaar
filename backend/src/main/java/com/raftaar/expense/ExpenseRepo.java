package com.raftaar.expense;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExpenseRepo extends JpaRepository<Expense, Long> {
    List<Expense> findByVehicleIdOrderBySpentOnDescIdDesc(Long vehicleId);
    Optional<Expense> findByHisaabTxnId(String id);
}
