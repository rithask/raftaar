-- Raftaar: vehicles and everything that happens to them.
-- Distances are kilometres, volumes litres (kWh for electric), money is in the app's currency (INR).

create table vehicle (
    id                bigserial primary key,
    name              text        not null,
    kind              text        not null,              -- MOTORCYCLE, SCOOTER, CAR, OTHER
    fuel_type         text        not null,              -- PETROL, DIESEL, CNG, ELECTRIC
    make              text,
    model             text,
    year              integer,
    registration      text,
    color             text,
    tank_capacity     numeric(8, 2),
    purchase_date     date,
    purchase_odometer numeric(10, 1),
    purchase_price    numeric(12, 2),
    image_file        text,
    image_version     integer     not null default 0,
    is_default        boolean     not null default false,
    archived          boolean     not null default false,
    sort_order        integer     not null default 0,
    notes             text,
    created_at        timestamptz not null default now()
);

create table fuel_entry (
    id              bigserial primary key,
    vehicle_id      bigint        not null references vehicle (id) on delete cascade,
    filled_at       timestamptz   not null,
    odometer        numeric(10, 1) not null,
    volume          numeric(10, 3) not null,
    price_per_unit  numeric(10, 3) not null,
    total_cost      numeric(12, 2) not null,
    -- Mileage is only measured between two full tanks; partial fills are added to the next full one.
    full_tank       boolean       not null default true,
    -- A fill-up before this one was never logged, so the distance since the last full tank can't be used.
    missed_previous boolean       not null default false,
    station_name    text,
    station_brand   text,
    latitude        double precision,
    longitude       double precision,
    region          text,                               -- state, used for fuel prices
    district        text,
    source          text          not null default 'MANUAL', -- MANUAL, HISAAB, GEOPULSE, HISAAB_GEOPULSE
    hisaab_txn_id   text unique,
    source_issue    text,                               -- e.g. the Hisaab payment changed or disappeared
    notes           text,
    created_at      timestamptz   not null default now()
);
create index fuel_entry_vehicle on fuel_entry (vehicle_id, odometer);

create table reminder (
    id                  bigserial primary key,
    vehicle_id          bigint      not null references vehicle (id) on delete cascade,
    title               text        not null,
    interval_km         numeric(10, 1),
    interval_months     integer,
    last_done_on        date,
    last_done_odometer  numeric(10, 1),
    -- one-off reminders set these directly instead of an interval
    due_on              date,
    due_odometer        numeric(10, 1),
    notify_days_before  integer     not null default 14,
    notify_km_before    integer     not null default 300,
    active              boolean     not null default true,
    last_notified_state text,
    last_notified_at    timestamptz,
    notes               text,
    created_at          timestamptz not null default now()
);

create table service_record (
    id          bigserial primary key,
    vehicle_id  bigint        not null references vehicle (id) on delete cascade,
    serviced_on date          not null,
    odometer    numeric(10, 1),
    title       text          not null,
    workshop    text,
    cost        numeric(12, 2) not null default 0,
    notes       text,
    created_at  timestamptz   not null default now()
);
create index service_record_vehicle on service_record (vehicle_id, serviced_on);

create table service_record_reminder (
    service_record_id bigint not null references service_record (id) on delete cascade,
    reminder_id       bigint not null references reminder (id) on delete cascade,
    primary key (service_record_id, reminder_id)
);

create table expense (
    id            bigserial primary key,
    vehicle_id    bigint        not null references vehicle (id) on delete cascade,
    spent_on      date          not null,
    category      text          not null,               -- UPGRADE, ACCESSORY, GEAR, INSURANCE, TAX, PARKING, TOLL, CLEANING, OTHER
    title         text          not null,
    amount        numeric(12, 2) not null,
    odometer      numeric(10, 1),
    vendor        text,
    hisaab_txn_id text unique,
    notes         text,
    created_at    timestamptz   not null default now()
);
create index expense_vehicle on expense (vehicle_id, spent_on);

create table document (
    id                    bigserial primary key,
    vehicle_id            bigint references vehicle (id) on delete cascade, -- null: yours, e.g. a driving licence
    type                  text    not null,             -- INSURANCE, PUC, RC, ROAD_TAX, FITNESS, PERMIT, LICENCE, OTHER
    title                 text    not null,
    number                text,
    provider              text,
    issued_on             date,
    expires_on            date,
    remind_days_before    integer not null default 30,
    cost                  numeric(12, 2),
    file_name             text,
    file_type             text,
    file_original_name    text,
    -- which warning was sent for which expiry date (30, 7, 1, 0 or -1 days)
    last_notified_expiry  date,
    last_notified_days    integer,
    notes                 text,
    created_at            timestamptz not null default now()
);

create table odometer_reading (
    id         bigserial primary key,
    vehicle_id bigint         not null references vehicle (id) on delete cascade,
    read_at    timestamptz    not null,
    odometer   numeric(10, 1) not null,
    notes      text,
    created_at timestamptz    not null default now()
);
create index odometer_reading_vehicle on odometer_reading (vehicle_id, read_at);

-- Trips imported from GeoPulse, waiting to be put on a vehicle (or ignored).
create table trip (
    id                   bigserial primary key,
    geopulse_id          bigint unique,
    started_at           timestamptz      not null,
    ended_at             timestamptz      not null,
    distance_m           numeric(12, 1)   not null,
    movement_type        text,
    start_lat            double precision,
    start_lon            double precision,
    end_lat              double precision,
    end_lon              double precision,
    status               text             not null default 'PENDING', -- PENDING, ASSIGNED, IGNORED
    vehicle_id           bigint references vehicle (id) on delete set null,
    suggested_vehicle_id bigint references vehicle (id) on delete set null,
    stops_checked        boolean          not null default false,
    created_at           timestamptz      not null default now()
);
create index trip_status on trip (status, started_at);
create index trip_vehicle on trip (vehicle_id, started_at);

-- Fill-ups and expenses found in Hisaab payments and GeoPulse stops, waiting for you to confirm them.
create table suggestion (
    id                   bigserial primary key,
    kind                 text        not null,          -- FUEL, EXPENSE
    status               text        not null default 'PENDING', -- PENDING, ACCEPTED, DISMISSED
    occurred_at          timestamptz not null,
    amount               numeric(12, 2),
    payee                text,
    hisaab_txn_id        text unique,
    hisaab_category      text,
    hisaab_account       text,
    stop_at              timestamptz,                   -- when GeoPulse saw you stopped at a pump
    stop_seconds         integer,
    latitude             double precision,
    longitude            double precision,
    station_name         text,
    station_brand        text,
    region               text,
    district             text,
    suggested_price      numeric(10, 3),
    suggested_vehicle_id bigint references vehicle (id) on delete set null,
    note                 text,
    dismiss_reason       text,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now()
);
create index suggestion_status on suggestion (status, occurred_at);

-- Fuel prices by state (and optionally district). The newest one for a place and fuel is the current price.
create table fuel_price (
    id           bigserial primary key,
    region       text           not null,
    district     text,
    fuel_type    text           not null,
    price        numeric(10, 3) not null,
    effective_at timestamptz    not null,
    source       text           not null,             -- MANUAL, FILL_UP, LOOKUP
    created_at   timestamptz    not null default now()
);
create index fuel_price_lookup on fuel_price (region, fuel_type, effective_at desc);

-- Fuel pumps from OpenStreetMap, fetched one ~5 km tile at a time.
create table fuel_station (
    osm_id    text primary key,
    name      text,
    brand     text,
    latitude  double precision not null,
    longitude double precision not null
);
create index fuel_station_position on fuel_station (latitude, longitude);

create table map_tile (
    tile_key   text primary key,
    fetched_at timestamptz not null
);

create table geocode (
    cell_key   text primary key,
    region     text,
    district   text,
    fetched_at timestamptz not null
);

create table app_setting (
    key   text primary key,
    value text
);

-- Where notifications go: Apprise URLs, managed in Settings. URLs hold tokens; the API only ever shows them masked.
create table notification_channel (
    id           bigserial primary key,
    label        text,
    url          text        not null,
    enabled      boolean     not null default true,
    last_sent_at timestamptz,
    last_ok      boolean,
    last_error   text,
    created_at   timestamptz not null default now()
);
