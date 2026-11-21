package com.raftaar.expense;

import com.raftaar.common.Text;
import com.raftaar.vehicle.VehicleRepo;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Money spent on a vehicle besides fuel and services: upgrades, accessories, gear, tolls, parking. */
@Service
public class Expenses {
    private final ExpenseRepo expenses;
    private final VehicleRepo vehicles;

    public Expenses(ExpenseRepo expenses, VehicleRepo vehicles) {
        this.expenses = expenses;
        this.vehicles = vehicles;
    }

    public record Input(LocalDate spentOn, Expense.Category category, String title, BigDecimal amount, BigDecimal odometer,
                        String vendor, String notes) {}

    public List<Expense> list(Long vehicleId) {
        vehicles.require(vehicleId, "Vehicle");
        return expenses.findByVehicleIdOrderBySpentOnDescIdDesc(vehicleId);
    }

    public Expense add(Long vehicleId, Input input) {
        vehicles.require(vehicleId, "Vehicle");
        Expense expense = new Expense();
        expense.vehicleId = vehicleId;
        return save(expense, input);
    }

    public Expense update(Long id, Input input) {
        return save(expenses.require(id, "Expense"), input);
    }

    public void delete(Long id) {
        expenses.deleteById(id);
    }

    private Expense save(Expense expense, Input input) {
        if (input.title() == null || input.title().isBlank()) throw new IllegalArgumentException("What was it for?");
        if (input.amount() == null || input.amount().signum() < 0) throw new IllegalArgumentException("How much was it?");
        expense.spentOn = input.spentOn() != null ? input.spentOn() : LocalDate.now();
        expense.category = input.category() != null ? input.category() : Expense.Category.OTHER;
        expense.title = input.title().trim();
        expense.amount = input.amount();
        expense.odometer = input.odometer();
        expense.vendor = Text.trimToNull(input.vendor());
        expense.notes = Text.trimToNull(input.notes());
        return expenses.save(expense);
    }
}
