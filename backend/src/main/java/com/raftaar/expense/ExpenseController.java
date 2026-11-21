package com.raftaar.expense;

import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class ExpenseController {
    private final Expenses expenses;

    public ExpenseController(Expenses expenses) {
        this.expenses = expenses;
    }

    @GetMapping("/vehicles/{vehicleId}/expenses")
    public List<Expense> list(@PathVariable Long vehicleId) {
        return expenses.list(vehicleId);
    }

    @PostMapping("/vehicles/{vehicleId}/expenses")
    public Expense add(@PathVariable Long vehicleId, @RequestBody Expenses.Input input) {
        return expenses.add(vehicleId, input);
    }

    @PutMapping("/expenses/{id}")
    public Expense update(@PathVariable Long id, @RequestBody Expenses.Input input) {
        return expenses.update(id, input);
    }

    @DeleteMapping("/expenses/{id}")
    public void delete(@PathVariable Long id) {
        expenses.delete(id);
    }
}
