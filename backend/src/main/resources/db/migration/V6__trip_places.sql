-- Where a GeoPulse trip went from and to: the names of the stays either side of it ("Home", "Office").
-- Only adds empty columns; the next GeoPulse sync fills them in.
alter table trip
    add column start_place text,
    add column end_place   text;
