import type { TripReason } from '@getsava/sdk-blend';
import type { CircuitSample, CircuitStore } from './store';

/**
 * Cloudflare D1 (SQLite) {@link CircuitStore} — the free, built-in durable store
 * for circuit metrics. SQLite has no native boolean, so `tripped`/`forced` are
 * stored and read back as 0/1 and coerced here. Same schema.sql as Postgres
 * (apply with `wrangler d1 execute sava-circuit --file=src/circuit/schema.sql`).
 */

interface SampleRow {
  readonly ts: number;
  readonly tripped: number;
  readonly reasons: string;
  readonly backstop_coverage_usd: number;
  readonly pool_tvl_usd: number;
  readonly brate: string;
  readonly oracle_price_usd: number;
  readonly reference_price_usd: number;
  readonly pool_status: number;
  readonly backstop_coverage_ratio: number;
  readonly brate_drift_pct: number | null;
  readonly oracle_divergence_pct: number;
  readonly supply_apy: number;
  readonly forced: number;
}

function toSample(row: SampleRow): CircuitSample {
  return {
    ts: Number(row.ts),
    tripped: !!row.tripped,
    reasons: row.reasons ? (row.reasons.split(',') as TripReason[]) : [],
    backstopCoverageUsd: row.backstop_coverage_usd,
    poolTvlUsd: row.pool_tvl_usd,
    bRate: row.brate,
    oraclePriceUsd: row.oracle_price_usd,
    referencePriceUsd: row.reference_price_usd,
    poolStatus: row.pool_status,
    backstopCoverageRatio: row.backstop_coverage_ratio,
    bRateDriftPct: row.brate_drift_pct,
    oracleDivergencePct: row.oracle_divergence_pct,
    supplyApy: row.supply_apy,
    forced: !!row.forced,
  };
}

export class D1CircuitStore implements CircuitStore {
  constructor(private readonly db: D1Database) {}

  async insert(s: CircuitSample): Promise<void> {
    await this.db
      .prepare(
        `insert into circuit_samples
           (ts, tripped, reasons, backstop_coverage_usd, pool_tvl_usd, brate, oracle_price_usd,
            reference_price_usd, pool_status, backstop_coverage_ratio, brate_drift_pct,
            oracle_divergence_pct, supply_apy, forced)
         values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         on conflict (ts) do nothing`,
      )
      .bind(
        s.ts,
        s.tripped ? 1 : 0,
        s.reasons.join(','),
        s.backstopCoverageUsd,
        s.poolTvlUsd,
        s.bRate,
        s.oraclePriceUsd,
        s.referencePriceUsd,
        s.poolStatus,
        s.backstopCoverageRatio,
        s.bRateDriftPct,
        s.oracleDivergencePct,
        s.supplyApy,
        s.forced ? 1 : 0,
      )
      .run();
  }

  async latest(): Promise<CircuitSample | null> {
    const row = await this.db
      .prepare('select * from circuit_samples order by ts desc limit 1')
      .first<SampleRow>();
    return row ? toSample(row) : null;
  }

  async bRateBefore(beforeTs: number): Promise<bigint | null> {
    const row = await this.db
      .prepare('select brate from circuit_samples where ts <= ? order by ts desc limit 1')
      .bind(beforeTs)
      .first<{ brate: string }>();
    return row ? BigInt(row.brate) : null;
  }

  async range(sinceTs: number): Promise<readonly CircuitSample[]> {
    const { results } = await this.db
      .prepare('select * from circuit_samples where ts >= ? order by ts asc')
      .bind(sinceTs)
      .all<SampleRow>();
    return (results ?? []).map(toSample);
  }

  async addPushToken(token: string): Promise<void> {
    await this.db
      .prepare(
        'insert into circuit_push_tokens (token, created_at) values (?, ?) on conflict (token) do nothing',
      )
      .bind(token, Date.now())
      .run();
  }

  async listPushTokens(): Promise<readonly string[]> {
    const { results } = await this.db
      .prepare('select token from circuit_push_tokens')
      .all<{ token: string }>();
    return (results ?? []).map((r) => r.token);
  }
}
