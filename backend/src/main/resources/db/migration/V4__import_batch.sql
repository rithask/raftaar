-- Imports from files (Raftaar's own export, Fuelio, Drivvo and the like): each import is a batch, and everything
-- it added carries the batch's id, so "Remove this import" takes out exactly that. Only adds a table and empty columns.
create table import_batch (
    id         bigserial primary key,
    source     text        not null,
    file_name  text,
    summary    text,
    created_at timestamptz not null default now()
);

alter table vehicle          add column import_batch_id bigint references import_batch (id) on delete set null;
alter table fuel_entry       add column import_batch_id bigint references import_batch (id) on delete set null;
alter table service_record   add column import_batch_id bigint references import_batch (id) on delete set null;
alter table expense          add column import_batch_id bigint references import_batch (id) on delete set null;
alter table odometer_reading add column import_batch_id bigint references import_batch (id) on delete set null;
alter table document         add column import_batch_id bigint references import_batch (id) on delete set null;
alter table reminder         add column import_batch_id bigint references import_batch (id) on delete set null;

-- finding an import's records to remove them; most records have none, so only those that do are indexed
create index fuel_entry_import       on fuel_entry (import_batch_id)       where import_batch_id is not null;
create index service_record_import   on service_record (import_batch_id)   where import_batch_id is not null;
create index expense_import          on expense (import_batch_id)          where import_batch_id is not null;
create index odometer_reading_import on odometer_reading (import_batch_id) where import_batch_id is not null;
create index document_import         on document (import_batch_id)         where import_batch_id is not null;
create index reminder_import         on reminder (import_batch_id)         where import_batch_id is not null;
create index vehicle_import          on vehicle (import_batch_id)          where import_batch_id is not null;
