import type { TripReason } from '@getsava/sdk-blend';

/**
 * One persisted circuit-breaker observation. The full reading is stored (not just
 * tripped/healthy) so the read-only dashboard can chart 7+ days of every signal.
 * bRate is a bigint serialized as a decimal string (Postgres numeric / JSON-safe).
 */
export interface CircuitSample {
  readonly ts: number;
  readonly tripped: boolean;
  readonly reasons: readonly TripReason[];
  readonly backstopCoverageUsd: number;
  readonly poolTvlUsd: number;
  readonly bRate: string;
  readonly oraclePriceUsd: number;
  readonly referencePriceUsd: number;
  readonly poolStatus: number;
  readonly backstopCoverageRatio: number;
  readonly bRateDriftPct: number | null;
  readonly oracleDivergencePct: number;
  readonly supplyApy: number;
  /** True when an env override (CIRCUIT_FORCE_TRIP) produced/added a trip reason. */
  readonly forced: boolean;
}

export interface CircuitStore {
  insert(sample: CircuitSample): Promise<void>;
  /** Most recent sample, or null when none recorded yet. */
  latest(): Promise<CircuitSample | null>;
  /** bRate of the latest sample at or before `beforeTs` (the ~5-min-ago reading), or null. */
  bRateBefore(beforeTs: number): Promise<bigint | null>;
  /** All samples with ts ≥ sinceTs, oldest first (dashboard window). */
  range(sinceTs: number): Promise<readonly CircuitSample[]>;
  /** Register an Expo push token (deduped) so trip alerts can reach the device. */
  addPushToken(token: string): Promise<void>;
  listPushTokens(): Promise<readonly string[]>;
}

/** Per-isolate store for local dev / tests (no durability). */
export class InMemoryCircuitStore implements CircuitStore {
  private samples: CircuitSample[] = [];
  private tokens = new Set<string>();

  async insert(sample: CircuitSample): Promise<void> {
    this.samples.push(sample);
  }

  async latest(): Promise<CircuitSample | null> {
    return this.samples.length ? (this.samples[this.samples.length - 1] as CircuitSample) : null;
  }

  async bRateBefore(beforeTs: number): Promise<bigint | null> {
    for (let i = this.samples.length - 1; i >= 0; i--) {
      const s = this.samples[i] as CircuitSample;
      if (s.ts <= beforeTs) {
        return BigInt(s.bRate);
      }
    }
    return null;
  }

  async range(sinceTs: number): Promise<readonly CircuitSample[]> {
    return this.samples.filter((s) => s.ts >= sinceTs).sort((a, b) => a.ts - b.ts);
  }

  async addPushToken(token: string): Promise<void> {
    this.tokens.add(token);
  }

  async listPushTokens(): Promise<readonly string[]> {
    return [...this.tokens];
  }
}
