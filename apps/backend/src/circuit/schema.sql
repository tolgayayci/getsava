-- Sava backend — circuit-breaker metrics schema (Neon). Apply with:
--   psql "$DATABASE_URL" -f apps/backend/src/circuit/schema.sql
-- Idempotent: safe to re-run. This table is the 7-day metrics store the
-- read-only /circuit/dashboard charts (D1).

create table if not exists circuit_samples (
  ts                      bigint  not null,
  tripped                 boolean not null,
  reasons                 text    not null default '',  -- comma-separated TripReason list
  backstop_coverage_usd   double precision not null,
  pool_tvl_usd            double precision not null,
  brate                   text    not null,             -- bigint as decimal string
  oracle_price_usd        double precision not null,
  reference_price_usd     double precision not null,
  pool_status             integer not null,
  backstop_coverage_ratio double precision not null,
  brate_drift_pct         double precision,             -- null on the first sample
  oracle_divergence_pct   double precision not null,
  supply_apy              double precision not null,
  forced                  boolean not null default false,
  primary key (ts)
);

create index if not exists circuit_samples_ts_idx on circuit_samples (ts);

-- Expo push tokens that should receive circuit-trip alerts. PRIMARY KEY +
-- ON CONFLICT DO NOTHING makes re-registration idempotent.
create table if not exists circuit_push_tokens (
  token       text   primary key,
  created_at  bigint not null default 0
);
