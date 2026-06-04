-- Sava backend — Postgres schema (Neon). Apply with:
--   psql "$DATABASE_URL" -f apps/backend/src/orders/schema.sql
-- Idempotent: safe to re-run.

-- Deposit orders. `id` is the Mercuryo merchant_transaction_id (UUID).
create table if not exists orders (
  id              text   primary key,
  user_address    text   not null,
  amount_try      text   not null,
  expected_usdc   text   not null,
  state           text   not null,
  widget_url      text   not null,
  created_at      bigint not null,
  updated_at      bigint not null,
  bridge_tx_hash  text,
  stellar_tx_hash text,
  settled_at      bigint
);

create index if not exists orders_settleable_idx
  on orders (settled_at)
  where settled_at is null;

-- Webhook idempotency ledger. The PRIMARY KEY on event_key, combined with
-- INSERT ... ON CONFLICT DO NOTHING, guarantees a replayed Mercuryo callback
-- (merchant_transaction_id + event_type) is processed at most once.
create table if not exists webhook_events (
  event_key   text   primary key,
  received_at bigint not null default 0
);
