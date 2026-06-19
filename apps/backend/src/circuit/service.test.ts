import type { PoolHealthSample } from '@getsava/sdk-blend';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FetchLike } from './alerts';
import { CircuitService, type CircuitServiceDeps } from './service';
import { InMemoryCircuitStore } from './store';

const HEALTHY: PoolHealthSample = {
  backstopCoverageUsd: 147_260,
  poolTvlUsd: 65_915,
  totalSupplyUsdc: 65_915,
  bRateNow: 1_000_000_000_000n,
  oraclePriceUsd: 1.0,
  poolStatus: 0,
  supplyApy: 0.005,
  q4wPercentage: 0.0001,
};

interface Harness {
  service: CircuitService;
  store: InMemoryCircuitStore;
  fetchCalls: { url: string; body: unknown }[];
  setSample: (s: PoolHealthSample) => void;
  setForced: (r: CircuitServiceDeps['forcedReasons']) => void;
  setNow: (n: number) => void;
}

function harness(opts: { webhook?: boolean } = {}): Harness {
  const store = new InMemoryCircuitStore();
  let sample = HEALTHY;
  let forced: CircuitServiceDeps['forcedReasons'] = [];
  let now = 1_000_000;
  const fetchCalls: { url: string; body: unknown }[] = [];
  const fakeFetch: FetchLike = async (url, init) => {
    fetchCalls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return { ok: true, status: 200 };
  };
  // rebuild deps lazily so setForced/setSample/setNow take effect
  const service = new CircuitService({
    store,
    readSample: () => Promise.resolve(sample),
    readReference: () => Promise.resolve(1.0),
    get forcedReasons() {
      return forced;
    },
    alertChannels: {
      ...(opts.webhook ? { webhookUrl: 'https://hooks.example/oncall' } : {}),
      fetch: fakeFetch,
      log: vi.fn(),
    },
    now: () => now,
  } as CircuitServiceDeps);
  return {
    service,
    store,
    fetchCalls,
    setSample: (s) => {
      sample = s;
    },
    setForced: (r) => {
      forced = r;
    },
    setNow: (n) => {
      now = n;
    },
  };
}

describe('CircuitService', () => {
  let h: Harness;
  beforeEach(() => {
    h = harness({ webhook: true });
  });

  it('healthy sample: stores a not-tripped sample and fires NO alert', async () => {
    const rec = await h.service.sampleAndStore();
    expect(rec.tripped).toBe(false);
    expect(h.fetchCalls).toHaveLength(0);
    const status = await h.service.getStatus();
    expect(status.tripped).toBe(false);
    expect(status.backstopCoverageRatio).toBeGreaterThan(2);
  });

  it('env override trips the breaker, marks it forced, and fires the on-call webhook', async () => {
    h.setForced(['backstop_coverage']);
    const rec = await h.service.sampleAndStore();
    expect(rec.tripped).toBe(true);
    expect(rec.forced).toBe(true);
    expect(rec.reasons).toContain('backstop_coverage');
    // webhook alert fired (Slack-shaped payload)
    expect(h.fetchCalls).toHaveLength(1);
    expect(h.fetchCalls[0]?.url).toBe('https://hooks.example/oncall');
    expect(String((h.fetchCalls[0]?.body as { text: string }).text)).toContain('TRIPPED');
  });

  it('getStatus reflects a just-set override LIVE, before the next sample is stored', async () => {
    await h.service.sampleAndStore(); // healthy sample stored
    h.setForced(['oracle_divergence']); // reviewer flips the env var
    const status = await h.service.getStatus();
    expect(status.tripped).toBe(true);
    expect(status.forced).toBe(true);
    expect(status.reasons).toContain('oracle_divergence');
  });

  it('alerts only on a FRESH trip, not on every sample of a sustained trip', async () => {
    h.setForced(['pool_status']);
    await h.service.sampleAndStore();
    await h.service.sampleAndStore();
    await h.service.sampleAndStore();
    expect(h.fetchCalls).toHaveLength(1); // one alert, not three
  });

  it('detects real bRate drift > ±2% over the 5-minute window', async () => {
    h.setNow(1_000_000);
    await h.service.sampleAndStore(); // first sample: bRate 1e12, no prior → no drift
    h.setNow(1_000_000 + 6 * 60_000); // +6 min
    h.setSample({ ...HEALTHY, bRateNow: 1_030_000_000_000n }); // +3%
    const rec = await h.service.sampleAndStore();
    expect(rec.reasons).toContain('brate_drift');
    expect(rec.bRateDriftPct).toBeCloseTo(0.03, 4);
  });

  it('real backstop-coverage trip below 8% fires once and is reflected in metrics', async () => {
    h.setSample({ ...HEALTHY, poolTvlUsd: HEALTHY.backstopCoverageUsd / 0.05 }); // 5% coverage
    await h.service.sampleAndStore();
    const metrics = await h.service.getMetrics(7);
    expect(metrics.currentlyTripped).toBe(true);
    expect(metrics.trips).toBe(1);
    expect(metrics.count).toBe(1);
    expect(h.fetchCalls).toHaveLength(1);
  });

  it('push tokens registered are notified on a trip', async () => {
    await h.service.registerPushToken('ExponentPushToken[abc]');
    h.setForced(['backstop_coverage']);
    await h.service.sampleAndStore();
    const pushCall = h.fetchCalls.find((c) => c.url.includes('exp.host'));
    expect(pushCall).toBeDefined();
    expect(JSON.stringify(pushCall?.body)).toContain('ExponentPushToken[abc]');
  });

  it('getStatus is healthy/fail-open before any sample exists', async () => {
    const status = await h.service.getStatus();
    expect(status.tripped).toBe(false);
    expect(status.sampledAt).toBeNull();
  });
});
