/**
 * Supply circuit breaker (Deliverable 1). Pure evaluator over already-read pool
 * signals — the sampling loop / alerting is wired by the app + backend. Trips
 * HALT NEW SUPPLY only; withdrawals are ALWAYS allowed (enforce that at the call
 * site: supply checks `tripped`, withdraw never does).
 */
export const CIRCUIT_THRESHOLDS = {
  /** Backstop coverage (backstop USD / pool TVL USD) should stay ≥ 8%… */
  minBackstopCoverage: 0.08,
  /** …UNLESS the backstop is large in absolute terms (≥ $1M first-loss capital).
   * Large, deep pools naturally run a lower coverage RATIO but carry far more
   * absolute protection, so a low ratio alone shouldn't halt them. Coverage only
   * trips when the ratio is low AND the absolute backstop is small. */
  minBackstopUsd: 1_000_000,
  /** bRate must not move more than ±2% between 5-minute samples (it should only creep up). */
  maxBRateDrift: 0.02,
  /** Pool oracle USDC price must stay within ±0.5% of an external reference. */
  maxOracleDivergence: 0.005,
  /** Pool status ≥ 4 (Frozen/Setup) blocks new supply on-chain anyway. */
  haltAtStatus: 4,
} as const;

export type TripReason = 'backstop_coverage' | 'brate_drift' | 'oracle_divergence' | 'pool_status';

export interface CircuitInputs {
  readonly backstopCoverageUsd: number;
  readonly poolTvlUsd: number;
  readonly bRateNow: bigint;
  /** Prior 5-minute bRate sample, or null when none exists yet (first sample). */
  readonly bRate5minAgo: bigint | null;
  /** Pool oracle USDC price. */
  readonly oraclePriceUsd: number;
  /** External USDC reference price (≈ 1). */
  readonly referencePriceUsd: number;
  readonly poolStatus: number;
}

export interface CircuitState {
  /** True → new supply is halted. Withdrawals stay open regardless. */
  readonly tripped: boolean;
  readonly reasons: TripReason[];
  readonly backstopCoverageRatio: number;
  /** |bRateNow/bRate5minAgo − 1|, or null when there is no prior sample. */
  readonly bRateDriftPct: number | null;
  readonly oracleDivergencePct: number;
}

export function evaluateCircuitBreaker(i: CircuitInputs): CircuitState {
  const reasons: TripReason[] = [];

  // Size-aware: a thin RATIO only trips when the backstop is also small in
  // absolute terms — a large pool with ≥ $1M first-loss capital is not halted
  // just for a low ratio (see minBackstopUsd).
  const backstopCoverageRatio = i.poolTvlUsd > 0 ? i.backstopCoverageUsd / i.poolTvlUsd : 0;
  if (
    backstopCoverageRatio < CIRCUIT_THRESHOLDS.minBackstopCoverage &&
    i.backstopCoverageUsd < CIRCUIT_THRESHOLDS.minBackstopUsd
  ) {
    reasons.push('backstop_coverage');
  }

  let bRateDriftPct: number | null = null;
  if (i.bRate5minAgo !== null && i.bRate5minAgo > 0n) {
    bRateDriftPct = Math.abs(Number(i.bRateNow) / Number(i.bRate5minAgo) - 1);
    if (bRateDriftPct > CIRCUIT_THRESHOLDS.maxBRateDrift) {
      reasons.push('brate_drift');
    }
  }

  const oracleDivergencePct =
    i.referencePriceUsd > 0 ? Math.abs(i.oraclePriceUsd / i.referencePriceUsd - 1) : 1;
  if (oracleDivergencePct > CIRCUIT_THRESHOLDS.maxOracleDivergence) {
    reasons.push('oracle_divergence');
  }

  if (i.poolStatus >= CIRCUIT_THRESHOLDS.haltAtStatus) {
    reasons.push('pool_status');
  }

  return {
    tripped: reasons.length > 0,
    reasons,
    backstopCoverageRatio,
    bRateDriftPct,
    oracleDivergencePct,
  };
}
