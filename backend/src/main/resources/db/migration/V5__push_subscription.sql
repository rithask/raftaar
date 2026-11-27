-- Phones and browsers that get notifications by Web Push: each one's push address and the keys to encrypt for it.
create table push_subscription (
    id           bigserial primary key,
    endpoint     text        not null unique,
    p256dh       text        not null,
    auth         text        not null,
    label        text,
    last_sent_at timestamptz,
    last_ok      boolean,
    last_error   text,
    created_at   timestamptz not null default now()
);
