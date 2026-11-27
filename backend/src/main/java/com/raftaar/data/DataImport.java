package com.raftaar.data;

import com.raftaar.common.Text;
import com.raftaar.data.Imported.Named;
import com.raftaar.expense.Expense;
import com.raftaar.expense.ExpenseRepo;
import com.raftaar.fuel.FuelEntry;
import com.raftaar.fuel.FuelEntryRepo;
import com.raftaar.papers.Document;
import com.raftaar.papers.DocumentRepo;
import com.raftaar.upkeep.Reminder;
import com.raftaar.upkeep.ReminderRepo;
import com.raftaar.upkeep.ServiceRecord;
import com.raftaar.upkeep.ServiceRecordRepo;
import com.raftaar.vehicle.OdometerReading;
import com.raftaar.vehicle.OdometerReadingRepo;
import com.raftaar.vehicle.Vehicle;
import com.raftaar.vehicle.VehicleRepo;
import com.raftaar.vehicle.Vehicles;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;

/**
 * Bringing records in from a file (see ImportFormats for which): first a preview of what's in it, which vehicle
 * each of its vehicles matches, and what's already here; then the import, into the vehicles you chose (or new ones).
 *
 * A record already here (or twice in the file) is skipped: a fill-up or reading on the same day at the same odometer,
 * a service or expense on the same day with the same title (and amount), a paper with the same type, title and
 * expiry, a reminder with the same title. Each import is a batch that can be removed whole.
 */
@Service
public class DataImport {
    private static final Logger log = LoggerFactory.getLogger(DataImport.class);

    /** A vehicle the file names: how many records it has, whether the file describes it, and the vehicle here it matches. */
    public record FileVehicle(String name, long records, boolean described, Long match) {}

    /** Per kind of record ("fuel", "services", …, as the export's files are named), how many. */
    public record Counts(int fuel, int services, int expenses, int odometer, int papers, int reminders, int vehicles) {
        int total() {
            return fuel + services + expenses + odometer + papers + reminders;
        }
    }

    /** What importing the file would do: {@code adding} new records, {@code duplicates} already here and left out. */
    public record Preview(ImportSource source, List<FileVehicle> vehicles, Counts adding, Counts duplicates, LocalDate from, LocalDate to,
                          List<String> skipped) {}

    public record Result(Long batchId, Counts added, Counts duplicates, List<String> skipped) {}

    private final VehicleRepo vehicleRepo;
    private final Vehicles vehicles;
    private final FuelEntryRepo fills;
    private final ServiceRecordRepo services;
    private final ExpenseRepo expenses;
    private final OdometerReadingRepo readings;
    private final DocumentRepo papers;
    private final ReminderRepo reminders;
    private final ImportBatchRepo batches;

    public DataImport(VehicleRepo vehicleRepo, Vehicles vehicles, FuelEntryRepo fills, ServiceRecordRepo services, ExpenseRepo expenses,
                      OdometerReadingRepo readings, DocumentRepo papers, ReminderRepo reminders, ImportBatchRepo batches) {
        this.vehicleRepo = vehicleRepo;
        this.vehicles = vehicles;
        this.fills = fills;
        this.services = services;
        this.expenses = expenses;
        this.readings = readings;
        this.papers = papers;
        this.reminders = reminders;
        this.batches = batches;
    }

    @Transactional(readOnly = true)
    public Preview preview(String fileName, byte[] bytes) throws IOException {
        Imported file = read(fileName, bytes);
        Map<String, Long> matches = suggestedMatches(file);
        Plan plan = plan(file, matches);
        List<FileVehicle> named = file.vehicleNames().stream()
                .map(name -> new FileVehicle(name, file.recordsFor(name), file.vehicles.containsKey(name), matches.get(name))).toList();
        List<Instant> span = file.span();
        ZoneId zone = ZoneId.systemDefault();
        return new Preview(file.source, named, plan.adding(), plan.duplicates(),
                span.isEmpty() ? null : span.get(0).atZone(zone).toLocalDate(), span.isEmpty() ? null : span.get(1).atZone(zone).toLocalDate(),
                file.skipped);
    }

    /**
     * Imports the file. {@code choices}: for each vehicle name in it, the vehicle here to put its records on, or null
     * for a new one; a name left out goes to the vehicle the preview suggested (or a new one).
     */
    @Transactional
    public Result run(String fileName, byte[] bytes, Map<String, Long> choices) throws IOException {
        Imported file = read(fileName, bytes);
        var batch = new ImportBatch();
        batch.source = file.source;
        batch.fileName = fileName;
        batches.save(batch);

        Map<String, Long> suggested = suggestedMatches(file);
        Map<String, Long> target = new LinkedHashMap<>();
        int created = 0;
        for (String name : file.vehicleNames()) {
            Long chosen = choices.containsKey(name) ? choices.get(name) : suggested.get(name);
            if (chosen != null) {
                vehicleRepo.require(chosen, "Vehicle");
            } else {
                Vehicle vehicle = vehicles.create(file.vehicles.getOrDefault(name, minimalVehicle(name)));
                vehicle.importBatchId = batch.id;
                vehicleRepo.save(vehicle);
                chosen = vehicle.id;
                created++;
            }
            target.put(name, chosen);
        }

        Plan plan = plan(file, target);
        plan.fills().forEach(fill -> fill.importBatchId = batch.id);
        plan.services().forEach(service -> service.importBatchId = batch.id);
        plan.expenses().forEach(expense -> expense.importBatchId = batch.id);
        plan.readings().forEach(reading -> reading.importBatchId = batch.id);
        plan.papers().forEach(paper -> paper.importBatchId = batch.id);
        plan.reminders().forEach(reminder -> reminder.importBatchId = batch.id);
        fills.saveAll(plan.fills());
        services.saveAll(plan.services());
        expenses.saveAll(plan.expenses());
        readings.saveAll(plan.readings());
        papers.saveAll(plan.papers());
        reminders.saveAll(plan.reminders());

        Counts added = new Counts(plan.fills().size(), plan.services().size(), plan.expenses().size(), plan.readings().size(),
                plan.papers().size(), plan.reminders().size(), created);
        batch.summary = summary(added);
        batches.save(batch);
        log.info("Imported {} from {} ({}): {}; {} already here", fileName, file.source, "batch " + batch.id, batch.summary, plan.duplicates().total());
        return new Result(batch.id, added, plan.duplicates(), file.skipped);
    }

    @Transactional(readOnly = true)
    public List<ImportBatch> list() {
        return batches.findAllByOrderByCreatedAtDescIdDesc();
    }

    /**
     * Removes an import: everything it added, then the vehicles it created that have nothing else on them now (one
     * you've since added to stays, with what you added).
     */
    @Transactional
    public void remove(Long batchId) {
        ImportBatch batch = batches.require(batchId, "Import");
        long removed = fills.deleteByImportBatchId(batchId) + services.deleteByImportBatchId(batchId) + expenses.deleteByImportBatchId(batchId)
                + readings.deleteByImportBatchId(batchId) + papers.deleteByImportBatchId(batchId) + reminders.deleteByImportBatchId(batchId);
        int vehiclesRemoved = 0;
        for (Vehicle vehicle : vehicleRepo.findByImportBatchId(batchId)) {
            if (hasRecords(vehicle.id)) continue;
            vehicles.delete(vehicle.id);
            vehiclesRemoved++;
        }
        batches.delete(batch);
        log.info("Import {} ({}) removed: {} records, {} vehicles", batchId, batch.fileName, removed, vehiclesRemoved);
    }

    // ---- planning ----------------------------------------------------------------------------------------------

    private static Imported read(String fileName, byte[] bytes) throws IOException {
        Imported file = ImportFormats.read(fileName, bytes);
        if (file.isEmpty()) throw new IllegalArgumentException(file.skipped.isEmpty() ? "Nothing in that file could be read"
                : "Nothing in that file could be read: " + file.skipped.getFirst());
        return file;
    }

    /** Each vehicle name in the file to a vehicle here with that name or registration (null: none). */
    private Map<String, Long> suggestedMatches(Imported file) {
        List<Vehicle> mine = vehicleRepo.findAll();
        var matches = new HashMap<String, Long>();
        for (String name : file.vehicleNames()) {
            Vehicles.Input described = file.vehicles.get(name);
            String registration = described == null ? null : plate(described.registration());
            mine.stream().filter(vehicle -> vehicle.name.equalsIgnoreCase(name.strip())
                            || (registration != null && registration.equals(plate(vehicle.registration))))
                    .findFirst().ifPresent(vehicle -> matches.put(name, vehicle.id));
        }
        return matches;
    }

    /** What would be saved, with vehicle ids set, and what was left out as already here. */
    private record Plan(List<FuelEntry> fills, List<ServiceRecord> services, List<Expense> expenses, List<OdometerReading> readings,
                        List<Document> papers, List<Reminder> reminders, Counts duplicates) {
        Counts adding() {
            return new Counts(fills.size(), services.size(), expenses.size(), readings.size(), papers.size(), reminders.size(), 0);
        }
    }

    /** {@code target}: each vehicle name to its vehicle here (absent: a new one, which has nothing to repeat yet). */
    private Plan plan(Imported file, Map<String, Long> target) {
        Collection<Long> ids = new HashSet<>(target.values());
        ZoneId zone = ZoneId.systemDefault();
        Function<Instant, LocalDate> day = at -> at.atZone(zone).toLocalDate();

        var fillsHere = keys(fills.findByVehicleIdInOrderByFilledAtAscIdAsc(ids), fill -> key(fill.vehicleId, day.apply(fill.filledAt), fill.odometer));
        var fillsOut = kept(file.fills, target, (fill, id) -> { fill.vehicleId = id; return key(id, day.apply(fill.filledAt), fill.odometer); }, fillsHere);

        var servicesHere = keys(services.findByVehicleIdInOrderByServicedOnDescIdDesc(ids), service -> key(service.vehicleId, service.servicedOn, lower(service.title)));
        var servicesOut = kept(file.services, target, (service, id) -> { service.vehicleId = id; return key(id, service.servicedOn, lower(service.title)); }, servicesHere);

        var expensesHere = keys(expenses.findByVehicleIdInOrderBySpentOnDescIdDesc(ids),
                expense -> key(expense.vehicleId, expense.spentOn, lower(expense.title), plain(expense.amount)));
        var expensesOut = kept(file.expenses, target, (expense, id) -> { expense.vehicleId = id;
            return key(id, expense.spentOn, lower(expense.title), plain(expense.amount)); }, expensesHere);

        var readingsHere = keys(readings.findByVehicleIdInOrderByReadAtDesc(ids), reading -> key(reading.vehicleId, day.apply(reading.readAt), reading.odometer));
        var readingsOut = kept(file.readings, target, (reading, id) -> { reading.vehicleId = id; return key(id, day.apply(reading.readAt), reading.odometer); }, readingsHere);

        // a paper of your own (a licence) has no vehicle: those are compared too
        var papersAround = new ArrayList<>(papers.findByVehicleIdInOrderByExpiresOnAscIdAsc(ids));
        papersAround.addAll(papers.findByVehicleIdIsNullOrderByExpiresOnAscIdAsc());
        var papersHere = keys(papersAround, paper -> key(paper.vehicleId, paper.type, lower(paper.title), paper.expiresOn));
        var papersOut = kept(file.papers, target, (paper, id) -> { paper.vehicleId = id; return key(id, paper.type, lower(paper.title), paper.expiresOn); }, papersHere);

        var remindersHere = keys(reminders.findByVehicleIdInOrderByIdAsc(ids), reminder -> key(reminder.vehicleId, lower(reminder.title)));
        var remindersOut = kept(file.reminders, target, (reminder, id) -> { reminder.vehicleId = id; return key(id, lower(reminder.title)); }, remindersHere);

        Counts duplicates = new Counts(file.fills.size() - fillsOut.size(), file.services.size() - servicesOut.size(),
                file.expenses.size() - expensesOut.size(), file.readings.size() - readingsOut.size(), file.papers.size() - papersOut.size(),
                file.reminders.size() - remindersOut.size(), 0);
        return new Plan(fillsOut, servicesOut, expensesOut, readingsOut, papersOut, remindersOut, duplicates);
    }

    /**
     * The file's records that aren't already {@code here} (nor earlier in the file), each given its vehicle's id by
     * {@code keyed}, which returns the record's key. A record of a vehicle without a target (a new one, in a preview)
     * is given none and only checked against the file.
     */
    private static <T> List<T> kept(List<Named<T>> named, Map<String, Long> target, KeyFor<T> keyed, Set<String> here) {
        var seen = new HashSet<>(here);
        var out = new ArrayList<T>();
        for (Named<T> each : named) {
            Long id = each.vehicle() == null ? null : target.get(each.vehicle());
            String key = keyed.key(each.record(), id);
            // a new vehicle in a preview has no id yet: tell its records apart by the name instead
            if (id == null && each.vehicle() != null) key = each.vehicle() + "|" + key;
            if (seen.add(key)) out.add(each.record());
        }
        return out;
    }

    @FunctionalInterface
    private interface KeyFor<T> {
        String key(T record, Long vehicleId);
    }

    private static <T> Set<String> keys(List<T> records, Function<T, String> key) {
        var keys = new HashSet<String>();
        records.forEach(record -> keys.add(key.apply(record)));
        return keys;
    }

    private static String key(Object... parts) {
        var text = new StringBuilder();
        for (Object part : parts) text.append(part instanceof BigDecimal number ? plain(number) : Objects.toString(part, "")).append('|');
        return text.toString();
    }

    private static String plain(BigDecimal number) {
        return number == null ? "" : number.stripTrailingZeros().toPlainString();
    }

    private static String lower(String text) {
        return text == null ? "" : text.strip().toLowerCase(Locale.ROOT);
    }

    private static String plate(String registration) {
        return registration == null ? null : registration.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
    }

    private boolean hasRecords(Long vehicleId) {
        return fills.existsByVehicleId(vehicleId) || services.existsByVehicleId(vehicleId) || expenses.existsByVehicleId(vehicleId)
                || readings.existsByVehicleId(vehicleId) || papers.existsByVehicleId(vehicleId) || reminders.existsByVehicleId(vehicleId);
    }

    private static Vehicles.Input minimalVehicle(String name) {
        return new Vehicles.Input(name, null, null, null, null, null, null, null, null, null, null, null, false, false, null, null, null, null);
    }

    /** "312 fill-ups, 40 services, 1 vehicle". */
    static String summary(Counts counts) {
        var parts = new ArrayList<String>();
        if (counts.fuel() > 0) parts.add(Text.plural(counts.fuel(), "fill-up"));
        if (counts.services() > 0) parts.add(Text.plural(counts.services(), "service"));
        if (counts.expenses() > 0) parts.add(Text.plural(counts.expenses(), "expense"));
        if (counts.odometer() > 0) parts.add(Text.plural(counts.odometer(), "odometer reading"));
        if (counts.papers() > 0) parts.add(Text.plural(counts.papers(), "paper"));
        if (counts.reminders() > 0) parts.add(Text.plural(counts.reminders(), "reminder"));
        if (counts.vehicles() > 0) parts.add(Text.plural(counts.vehicles(), "new vehicle"));
        return parts.isEmpty() ? "Nothing new" : String.join(", ", parts);
    }
}
