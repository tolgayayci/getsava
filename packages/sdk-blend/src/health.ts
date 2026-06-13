import { readBackstopHealth } from './backstop';
import type { CircuitInputs } from './circuit';
import type { BlendNetworkConfig } from './config';
import { readOraclePrice } from './oracle';
import { loadPool, readReserveSnapshot } from './pool';

/**
 * One live read of every circuit-breaker input EXCEPT the two values the monitor
 * threads itself: the prior 5-minute bRate (from its sample history) and the
 * secondary USDC reference price (an external feed). The Cloudflare cron in
 * apps/backend calls this each tick, then {@link toCircuitInputs} +
 * {@link evaluateCircuitBreaker}.
 */
export interface PoolHealthSample {
  /** Backstop first-loss capital in USD. */
  readonly backstopCoverageUsd: number;
  /** Pool TVL in USD (supplied USDC × oracle price). */
  readonly poolTvlUsd: number;
  /** Total USDC supplied (TVL leg, pre-USD conversion). */
  readonly totalSupplyUsdc: number;
  /** V2 bRate now (scaled 1e12, monotonic up). */
  readonly bRateNow: bigint;
  /** Pool oracle USDC price (USD). */
  readonly oraclePriceUsd: number;
  /** Pool status integer (0 active … 6 setup). */
  readonly poolStatus: number;
  /** Headline supply APY (decimal fraction) — handy for the dashboard. */
  readonly supplyApy: number;
  /** Fraction of the backstop queued-for-withdrawal (0..1). */
  readonly q4wPercentage: number;
}

/** Read pool reserve + backstop + oracle in one pass. Live RPC — call server-side. */
export async function readPoolHealthSample(cfg: BlendNetworkConfig): Promise<PoolHealthSample> {
  const pool = await loadPool(cfg);
  const snap = readReserveSnapshot(pool, cfg.usdcSac);
  const [backstop, oraclePriceUsd] = await Promise.all([
    readBackstopHealth(cfg),
    readOraclePrice(pool, cfg.usdcSac),
  ]);
  return {
    backstopCoverageUsd: backstop.totalSpotValueUsd,
    poolTvlUsd: snap.totalSupply * oraclePriceUsd,
    totalSupplyUsdc: snap.totalSupply,
    bRateNow: snap.bRate,
    oraclePriceUsd,
    poolStatus: snap.status,
    supplyApy: snap.supplyApy,
    q4wPercentage: backstop.q4wPercentage,
  };
}

/**
 * Assemble {@link CircuitInputs} from a live sample plus the two monitor-threaded
 * values: the prior 5-minute bRate and the secondary USDC reference price
 * (defaults to the 1.0 peg when no external feed is wired).
 */
export function toCircuitInputs(
  s: PoolHealthSample,
  opts: { bRate5minAgo: bigint | null; referencePriceUsd?: number },
): CircuitInputs {
  return {
    backstopCoverageUsd: s.backstopCoverageUsd,
    poolTvlUsd: s.poolTvlUsd,
    bRateNow: s.bRateNow,
    bRate5minAgo: opts.bRate5minAgo,
    oraclePriceUsd: s.oraclePriceUsd,
    referencePriceUsd: opts.referencePriceUsd ?? 1.0,
    poolStatus: s.poolStatus,
  };
}
