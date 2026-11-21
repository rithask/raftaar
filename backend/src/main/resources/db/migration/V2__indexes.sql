-- Indexes for the lookups every page makes. Only adds indexes: nothing about the data changes.

-- a vehicle's fill-ups, in the order they're listed and worked through
create index fuel_entry_vehicle_filled on fuel_entry (vehicle_id, filled_at, id);
-- every vehicle's fill-ups around a moment (matching a Hisaab payment or a GeoPulse stop to a fill-up)
create index fuel_entry_filled on fuel_entry (filled_at);
-- the inbox: the few fill-ups whose Hisaab payment changed or disappeared
create index fuel_entry_issue on fuel_entry (id) where source_issue is not null;
-- a vehicle's reminders
create index reminder_vehicle on reminder (vehicle_id);
-- which services completed a reminder (the primary key only covers the other way round)
create index service_record_reminder_reminder on service_record_reminder (reminder_id);
-- a vehicle's papers, soonest to expire first
create index document_vehicle on document (vehicle_id, expires_on, id);
