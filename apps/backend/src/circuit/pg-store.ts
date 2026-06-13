import type { TripReason } from '@getsava/sdk-blend';
import type { SqlExecutor } from '../orders/pg-store';
import type { CircuitSample, CircuitStore } from './store';

/** Postgres-backed {@link CircuitStore} (Neon via Hyperdrive). See schema.sql. */

interface SampleRow {
  readonly ts: string | number;
  readonly tripped: boolean;
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
  readonly forced: boolean;
}

function toSample(row: SampleRow): CircuitSample {
  return {
    ts: Number(row.ts),
    tripped: row.tripped,
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
    forced: row.forced,
  };
}

export class PgCircuitStore implements CircuitStore {
  constructor(private readonly sql: SqlExecutor) {}

  async insert(s: CircuitSample): Promise<void> {
    await this.sql`
      insert into circuit_samples
        (ts, tripped, reasons, backstop_coverage_usd, pool_tvl_usd, brate, oracle_price_usd,
         reference_price_usd, pool_status, backstop_coverage_ratio, brate_drift_pct,
         oracle_divergence_pct, supply_apy, forced)
      values
        (${s.ts}, ${s.tripped}, ${s.reasons.join(',')}, ${s.backstopCoverageUsd}, ${s.poolTvlUsd},
         ${s.bRate}, ${s.oraclePriceUsd}, ${s.referencePriceUsd}, ${s.poolStatus},
         ${s.backstopCoverageRatio}, ${s.bRateDriftPct}, ${s.oracleDivergencePct}, ${s.supplyApy},
         ${s.forced})
      on conflict (ts) do nothing
    `;
  }

  async latest(): Promise<CircuitSample | null> {
    const rows = await this.sql<SampleRow>`
      select * from circuit_samples order by ts desc limit 1
    `;
    const row = rows[0];
    return row ? toSample(row) : null;
  }

  async bRateBefore(beforeTs: number): Promise<bigint | null> {
    const rows = await this.sql<{ brate: string }>`
      select brate from circuit_samples where ts <= ${beforeTs} order by ts desc limit 1
    `;
    const row = rows[0];
    return row ? BigInt(row.brate) : null;
  }

  async range(sinceTs: number): Promise<readonly CircuitSample[]> {
    const rows = await this.sql<SampleRow>`
      select * from circuit_samples where ts >= ${sinceTs} order by ts asc
    `;
    return rows.map(toSample);
  }

  async addPushToken(token: string): Promise<void> {
    await this.sql`
      insert into circuit_push_tokens (token, created_at)
      values (${token}, ${Date.now()})
      on conflict (token) do nothing
    `;
  }

  async listPushTokens(): Promise<readonly string[]> {
    const rows = await this.sql<{ token: string }>`select token from circuit_push_tokens`;
    return rows.map((r) => r.token);
  }
}
