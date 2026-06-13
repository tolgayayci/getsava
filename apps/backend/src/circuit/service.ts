import {
  blendConfig,
  type CircuitState,
  evaluateCircuitBreaker,
  type PoolHealthSample,
  readPoolHealthSample,
  type TripReason,
  toCircuitInputs,
} from '@getsava/sdk-blend';
import { neon } from '@neondatabase/serverless';
import { type Env, resolveNetwork } from '../config';
import type { SqlExecutor } from '../orders/pg-store';
import { type AlertDeps, type FetchLike, fireAlerts, isFreshTrip, type LogFn } from './alerts';
import { D1CircuitStore } from './d1-store';
import { applyOverride, parseForcedReasons } from './override';
import { PgCircuitStore } from './pg-store';
import { type CircuitSample, type CircuitStore, InMemoryCircuitStore } from './store';

const FIVE_MIN_MS = 5 * 60_000;
/** A status older than this is "stale" — the monitor likely missed ticks. */
const STALE_MS = 3 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

/** Public shape the /circuit/status route returns and the app polls to halt supply. */
export interface CircuitStatus {
  readonly tripped: boolean;
  readonly reasons: readonly TripReason[];
  /** True when the trip is driven by the CIRCUIT_FORCE_TRIP staging override. */
  readonly forced: boolean;
  /** ts of the latest real sample, or null before the first one. */
  readonly sampledAt: number | null;
  /** No fresh sample within STALE_MS (monitor may be down). */
  readonly stale: boolean;
  readonly backstopCoverageRatio: number | null;
  readonly bRateDriftPct: number | null;
  readonly oracleDivergencePct: number | null;
  readonly poolStatus: number | null;
  readonly supplyApy: number | null;
}

export interface CircuitMetrics {
  readonly windowDays: number;
  readonly count: number;
  readonly trips: number;
  readonly currentlyTripped: boolean;
  readonly samples: readonly CircuitSample[];
}

export interface CircuitServiceDeps {
  readonly store: CircuitStore;
  /** Live read of the on-chain pool/backstop/oracle signals. */
  readonly readSample: () => Promise<PoolHealthSample>;
  /** Secondary USDC reference price (the off-chain source the oracle is checked against). */
  readonly readReference: () => Promise<number>;
  readonly forcedReasons: readonly TripReason[];
  readonly alertChannels: { webhookUrl?: string; fetch: FetchLike; log: LogFn };
  readonly now: () => number;
}

function recordToState(s: CircuitSample): CircuitState {
  return {
    tripped: s.tripped,
    reasons: [...s.reasons],
    backstopCoverageRatio: s.backstopCoverageRatio,
    bRateDriftPct: s.bRateDriftPct,
    oracleDivergencePct: s.oracleDivergencePct,
  };
}

export class CircuitService {
  constructor(private readonly d: CircuitServiceDeps) {}

  /** Sample the 3 sources, evaluate, persist, and alert on a fresh trip. Cron + manual trigger. */
  async sampleAndStore(): Promise<CircuitSample> {
    const now = this.d.now();
    const sample = await this.d.readSample();
    const bRate5minAgo = await this.d.store.bRateBefore(now - FIVE_MIN_MS);
    const referencePriceUsd = await this.d.readReference();
    const real = evaluateCircuitBreaker(
      toCircuitInputs(sample, { bRate5minAgo, referencePriceUsd }),
    );
    const { state, forced } = applyOverride(real, this.d.forcedReasons);
    const prev = await this.d.store.latest();
    const record: CircuitSample = {
      ts: now,
      tripped: state.tripped,
      reasons: state.reasons,
      backstopCoverageUsd: sample.backstopCoverageUsd,
      poolTvlUsd: sample.poolTvlUsd,
      bRate: sample.bRateNow.toString(),
      oraclePriceUsd: sample.oraclePriceUsd,
      referencePriceUsd,
      poolStatus: sample.poolStatus,
      backstopCoverageRatio: state.backstopCoverageRatio,
      bRateDriftPct: state.bRateDriftPct,
      oracleDivergencePct: state.oracleDivergencePct,
      supplyApy: sample.supplyApy,
      forced,
    };
    await this.d.store.insert(record);
    if (isFreshTrip(prev, record)) {
      const alert: AlertDeps = {
        ...(this.d.alertChannels.webhookUrl ? { webhookUrl: this.d.alertChannels.webhookUrl } : {}),
        pushTokens: await this.d.store.listPushTokens(),
        fetch: this.d.alertChannels.fetch,
        log: this.d.alertChannels.log,
      };
      await fireAlerts(record, alert);
    }
    return record;
  }

  /**
   * Current breaker state for the app to poll. Reads the latest stored sample but
   * applies the env override LIVE, so the moment a reviewer sets CIRCUIT_FORCE_TRIP
   * the next poll returns tripped — no wait for the next cron tick (<30s halt).
   */
  async getStatus(): Promise<CircuitStatus> {
    const now = this.d.now();
    const latest = await this.d.store.latest();
    const base: CircuitState = latest
      ? recordToState(latest)
      : {
          tripped: false,
          reasons: [],
          backstopCoverageRatio: 0,
          bRateDriftPct: null,
          oracleDivergencePct: 0,
        };
    const { state, forced } = applyOverride(base, this.d.forcedReasons);
    return {
      tripped: state.tripped,
      reasons: state.reasons,
      forced,
      sampledAt: latest ? latest.ts : null,
      stale: latest ? now - latest.ts > STALE_MS : false,
      backstopCoverageRatio: latest ? latest.backstopCoverageRatio : null,
      bRateDriftPct: latest ? latest.bRateDriftPct : null,
      oracleDivergencePct: latest ? latest.oracleDivergencePct : null,
      poolStatus: latest ? latest.poolStatus : null,
      supplyApy: latest ? latest.supplyApy : null,
    };
  }

  async getMetrics(days = 7): Promise<CircuitMetrics> {
    const since = this.d.now() - days * DAY_MS;
    const samples = await this.d.store.range(since);
    const latest = samples.length ? (samples[samples.length - 1] as CircuitSample) : null;
    return {
      windowDays: days,
      count: samples.length,
      trips: samples.filter((s) => s.tripped).length,
      currentlyTripped: latest ? latest.tripped : false,
      samples,
    };
  }

  registerPushToken(token: string): Promise<void> {
    return this.d.store.addPushToken(token);
  }
}

let memoryStore: InMemoryCircuitStore | null = null;

/** Reset the dev in-memory store (test isolation only). */
export function resetCircuitStoreForTests(): void {
  memoryStore = null;
}

function storeFor(env: Env): CircuitStore {
  // Prefer Cloudflare D1 (durable, free), then Neon Postgres, then per-isolate memory.
  if (env.DB) {
    return new D1CircuitStore(env.DB);
  }
  if (env.DATABASE_URL) {
    return new PgCircuitStore(neon(env.DATABASE_URL) as unknown as SqlExecutor);
  }
  memoryStore ??= new InMemoryCircuitStore();
  return memoryStore;
}

/** Secondary USDC reference price. Defaults to the 1.0 peg; an external feed
 * (e.g. CoinGecko USDC/USD via CIRCUIT_REFERENCE_URL) is used when configured. */
function referenceReader(env: Env): () => Promise<number> {
  const url = env.CIRCUIT_REFERENCE_URL;
  if (!url) {
    return async () => 1.0;
  }
  return async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        return 1.0;
      }
      const data = (await res.json()) as Record<string, unknown>;
      const cg = (data['usd-coin'] as { usd?: number } | undefined)?.usd;
      const flat = data.price;
      const price = typeof cg === 'number' ? cg : typeof flat === 'number' ? flat : 1.0;
      return price > 0 ? price : 1.0;
    } catch {
      return 1.0;
    }
  };
}

const realFetch: FetchLike = (input, init) => fetch(input, init);
const realLog: LogFn = (event, data) => {
  console.log(JSON.stringify({ event, ...data }));
};

/** Build the {@link CircuitService} from the request/cron env. */
export function circuitService(env: Env): CircuitService {
  const network = resolveNetwork(env);
  return new CircuitService({
    store: storeFor(env),
    readSample: () => readPoolHealthSample(blendConfig(network)),
    readReference: referenceReader(env),
    forcedReasons: parseForcedReasons(env.CIRCUIT_FORCE_TRIP),
    alertChannels: {
      ...(env.CIRCUIT_ALERT_WEBHOOK ? { webhookUrl: env.CIRCUIT_ALERT_WEBHOOK } : {}),
      fetch: realFetch,
      log: realLog,
    },
    now: () => Date.now(),
  });
}
