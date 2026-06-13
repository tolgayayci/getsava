import { describe, expect, it } from 'vitest';
import { D1CircuitStore } from './d1-store';
import type { CircuitSample } from './store';

// Minimal fake of the D1 prepare/bind/run/first/all chain.
class FakeStmt {
  args: unknown[] = [];
  constructor(
    private fake: FakeD1,
    private sql: string,
  ) {}
  bind(...args: unknown[]) {
    this.args = args;
    return this;
  }
  async run() {
    this.fake.runs.push({ sql: this.sql, args: this.args });
    return { success: true };
  }
  async first<T>() {
    return this.fake.firstResult as T | null;
  }
  async all<T>() {
    return { results: (this.fake.allResults ?? []) as T[] };
  }
}
class FakeD1 {
  runs: { sql: string; args: unknown[] }[] = [];
  firstResult: unknown = null;
  allResults: unknown[] = [];
  prepare(sql: string) {
    return new FakeStmt(this, sql);
  }
}

const db = () => new FakeD1();
const store = (f: FakeD1) => new D1CircuitStore(f as unknown as D1Database);

const TRIP: CircuitSample = {
  ts: 1000,
  tripped: true,
  reasons: ['backstop_coverage', 'oracle_divergence'],
  backstopCoverageUsd: 500,
  poolTvlUsd: 10000,
  bRate: '1000826178899',
  oraclePriceUsd: 1.02,
  referencePriceUsd: 1.0,
  poolStatus: 0,
  backstopCoverageRatio: 0.05,
  bRateDriftPct: null,
  oracleDivergencePct: 0.02,
  supplyApy: 0.005,
  forced: false,
};

describe('D1CircuitStore', () => {
  it('insert stores booleans as 0/1 and joins reasons', async () => {
    const f = db();
    await store(f).insert(TRIP);
    const args = f.runs[0]?.args ?? [];
    expect(args[0]).toBe(1000); // ts
    expect(args[1]).toBe(1); // tripped → 1
    expect(args[2]).toBe('backstop_coverage,oracle_divergence'); // reasons joined
    expect(args[5]).toBe('1000826178899'); // brate as string
    expect(args[args.length - 1]).toBe(0); // forced → 0
  });

  it('latest coerces SQLite 0/1 back to booleans and splits reasons', async () => {
    const f = db();
    f.firstResult = {
      ts: 1000,
      tripped: 1,
      reasons: 'backstop_coverage',
      backstop_coverage_usd: 500,
      pool_tvl_usd: 10000,
      brate: '123',
      oracle_price_usd: 1.0,
      reference_price_usd: 1.0,
      pool_status: 4,
      backstop_coverage_ratio: 0.05,
      brate_drift_pct: null,
      oracle_divergence_pct: 0,
      supply_apy: 0.004,
      forced: 1,
    };
    const s = await store(f).latest();
    expect(s?.tripped).toBe(true);
    expect(s?.forced).toBe(true);
    expect(s?.reasons).toEqual(['backstop_coverage']);
    expect(s?.poolStatus).toBe(4);
  });

  it('latest returns null when there are no rows', async () => {
    const f = db();
    f.firstResult = null;
    expect(await store(f).latest()).toBeNull();
  });

  it('bRateBefore returns a bigint or null', async () => {
    const f = db();
    f.firstResult = { brate: '999' };
    expect(await store(f).bRateBefore(2000)).toBe(999n);
    const g = db();
    g.firstResult = null;
    expect(await store(g).bRateBefore(2000)).toBeNull();
  });

  it('range maps every row and coerces booleans', async () => {
    const f = db();
    f.allResults = [
      { ...rowFrom(TRIP), tripped: 0, forced: 0 },
      { ...rowFrom(TRIP), ts: 2000, tripped: 1, forced: 1 },
    ];
    const rows = await store(f).range(0);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.tripped).toBe(false);
    expect(rows[1]?.tripped).toBe(true);
    expect(rows[1]?.forced).toBe(true);
  });

  it('push tokens round-trip', async () => {
    const f = db();
    await store(f).addPushToken('ExponentPushToken[x]');
    expect(f.runs[0]?.args[0]).toBe('ExponentPushToken[x]');
    f.allResults = [{ token: 'ExponentPushToken[x]' }, { token: 'ExponentPushToken[y]' }];
    expect(await store(f).listPushTokens()).toEqual([
      'ExponentPushToken[x]',
      'ExponentPushToken[y]',
    ]);
  });
});

function rowFrom(s: CircuitSample) {
  return {
    ts: s.ts,
    tripped: s.tripped ? 1 : 0,
    reasons: s.reasons.join(','),
    backstop_coverage_usd: s.backstopCoverageUsd,
    pool_tvl_usd: s.poolTvlUsd,
    brate: s.bRate,
    oracle_price_usd: s.oraclePriceUsd,
    reference_price_usd: s.referencePriceUsd,
    pool_status: s.poolStatus,
    backstop_coverage_ratio: s.backstopCoverageRatio,
    brate_drift_pct: s.bRateDriftPct,
    oracle_divergence_pct: s.oracleDivergencePct,
    supply_apy: s.supplyApy,
    forced: s.forced ? 1 : 0,
  };
}
