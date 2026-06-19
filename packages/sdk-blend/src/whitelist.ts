import type { Network } from '@getsava/types';
import { CIRCUIT_THRESHOLDS } from './circuit';
import type { PoolHealthSample } from './health';

/**
 * Pool whitelist — the ONLY Blend v2 pools Sava is allowed to supply into.
 * Layer 1 of the defense: enforced at app startup (identity gate,
 * {@link assertPoolWhitelisted}) and continuously by the circuit breaker.
 * Testnet holds the single audited USDC pool; mainnet is empty until the T3 /
 * D6 pool selection commits its chosen pool here.
 */
export const POOL_WHITELIST: Record<Network, readonly string[]> = {
  testnet: ['CAPBMXIQTICKWFPWFDJWMAKBXBPJZUKLNONQH3MLPLLBKQ643CYN5PRW'],
  // T2.D6 launch pool: Blend v2 "Fixed V2" — the deepest USDC pool (~$53M), passing
  // the size-aware whitelist (~$3.39M absolute backstop ≥ $1M). See docs/pool-whitelist.md.
  // Dormant until the T3 feature-flag flip.
  mainnet: ['CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD'],
};

export function isPoolWhitelisted(poolId: string, network: Network): boolean {
  return POOL_WHITELIST[network].includes(poolId);
}

/**
 * Startup gate (whitelist rule 1, identity). Throws when the configured pool is
 * not on the network's whitelist — the app calls this once before any supply so
 * an unknown/rotated pool can never receive deposits.
 */
export function assertPoolWhitelisted(poolId: string, network: Network): void {
  if (!isPoolWhitelisted(poolId, network)) {
    throw new Error(
      `[sdk-blend] pool ${poolId} is not on the ${network} whitelist — refusing to supply`,
    );
  }
}

export type WhitelistRule =
  | 'identity'
  | 'supply_only'
  | 'backstop_coverage'
  | 'pool_status'
  | 'oracle_peg';

export interface RuleResult {
  readonly rule: WhitelistRule;
  readonly pass: boolean;
  readonly detail: string;
}

export interface WhitelistScore {
  readonly poolId: string;
  readonly network: Network;
  readonly pass: boolean;
  readonly rules: readonly RuleResult[];
}

/**
 * Score a pool against the 5-rule whitelist using a live health sample. Rule 2
 * (supply_only) is structurally guaranteed by the SDK guardrail (RequestType is
 * narrowed to SupplyCollateral/WithdrawCollateral), so it is a constant pass; the
 * other four are evaluated against live on-chain data and share the circuit
 * breaker's thresholds. Reused by D6's mainnet pool-scoring matrix.
 */
export function scorePoolAgainstWhitelist(
  poolId: string,
  network: Network,
  s: PoolHealthSample,
): WhitelistScore {
  const coverage = s.poolTvlUsd > 0 ? s.backstopCoverageUsd / s.poolTvlUsd : 0;
  // Size-aware: pass on a healthy ratio OR a large absolute backstop (≥ $1M).
  const coverageOk =
    coverage >= CIRCUIT_THRESHOLDS.minBackstopCoverage ||
    s.backstopCoverageUsd >= CIRCUIT_THRESHOLDS.minBackstopUsd;
  const oracleDivergence = Math.abs(s.oraclePriceUsd - 1);
  const whitelisted = isPoolWhitelisted(poolId, network);
  const pct = (n: number, d = 2) => `${(n * 100).toFixed(d)}%`;
  const usd0 = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

  const rules: RuleResult[] = [
    {
      rule: 'identity',
      pass: whitelisted,
      detail: whitelisted ? 'on whitelist' : 'NOT on whitelist',
    },
    {
      rule: 'supply_only',
      pass: true,
      detail: 'enforced by SDK guardrail (SupplyCollateral/WithdrawCollateral only)',
    },
    {
      rule: 'backstop_coverage',
      pass: coverageOk,
      detail: `${pct(coverage)} ratio · ${usd0(s.backstopCoverageUsd)} backstop (≥ ${pct(CIRCUIT_THRESHOLDS.minBackstopCoverage, 0)} ratio or ≥ ${usd0(CIRCUIT_THRESHOLDS.minBackstopUsd)})`,
    },
    {
      rule: 'pool_status',
      pass: s.poolStatus < CIRCUIT_THRESHOLDS.haltAtStatus,
      detail: `status ${s.poolStatus} (halt at ${CIRCUIT_THRESHOLDS.haltAtStatus})`,
    },
    {
      rule: 'oracle_peg',
      pass: oracleDivergence <= CIRCUIT_THRESHOLDS.maxOracleDivergence,
      detail: `${pct(oracleDivergence, 3)} off peg (max ${pct(CIRCUIT_THRESHOLDS.maxOracleDivergence, 1)})`,
    },
  ];
  return { poolId, network, pass: rules.every((r) => r.pass), rules };
}
