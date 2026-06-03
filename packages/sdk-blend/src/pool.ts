import { type PoolUser, PoolV2, type Reserve } from '@blend-capital/blend-sdk';
import { type BlendNetworkConfig, blendNetwork } from './config';

export interface ReserveSnapshot {
  readonly assetId: string;
  /** Reserve index within the pool (pool-specific — never hardcode). */
  readonly index: number;
  readonly decimals: number;
  /** Supply APR (decimal fraction, not compounded). */
  readonly supplyApr: number;
  /** Headline supply APY — `estSupplyApy`, weekly-compounded, interest-only. */
  readonly supplyApy: number;
  /** BLND emissions APY, or null when no emissions / no BLND price (testnet). */
  readonly emissionsApy: number | null;
  /** Total underlying USDC supplied (TVL leg). */
  readonly totalSupply: number;
  readonly totalBorrowed: number;
  /** Utilization 0..1. */
  readonly utilization: number;
  /** V2 bRate, scaled 1e12 — the yield-accrual rate (monotonic up). */
  readonly bRate: bigint;
  /** Pool status integer (0 Admin_Active … 6 Setup). */
  readonly status: number;
}

export interface UserPosition {
  readonly bTokens: bigint;
  readonly suppliedUsdc: number;
}

/** Load the Blend v2 pool (auto-accrues reserve rates to load time). */
export async function loadPool(cfg: BlendNetworkConfig): Promise<PoolV2> {
  return PoolV2.load(blendNetwork(cfg), cfg.poolId);
}

export function getReserve(pool: PoolV2, usdcSac: string): Reserve {
  const reserve = pool.reserves.get(usdcSac);
  if (reserve === undefined) {
    throw new Error(`[sdk-blend] USDC reserve ${usdcSac} not found in the pool`);
  }
  return reserve;
}

export function getSupplyApy(reserve: Reserve): number {
  return reserve.estSupplyApy;
}

export function readReserveSnapshot(pool: PoolV2, usdcSac: string): ReserveSnapshot {
  const r = getReserve(pool, usdcSac);
  return {
    assetId: r.assetId,
    index: r.config.index,
    decimals: r.config.decimals,
    supplyApr: r.supplyApr,
    supplyApy: r.estSupplyApy,
    emissionsApy: null,
    totalSupply: r.totalSupplyFloat(),
    totalBorrowed: r.totalLiabilitiesFloat(),
    utilization: r.getUtilizationFloat(),
    bRate: r.data.bRate,
    status: pool.metadata.status,
  };
}

/**
 * Read the user's USDC position from the COLLATERAL map (Sava uses
 * SupplyCollateral, so positions land there — `getCollateral*`, never `getSupply*`).
 */
export async function readUserPosition(
  pool: PoolV2,
  user: string,
  usdcSac: string,
): Promise<UserPosition> {
  const reserve = getReserve(pool, usdcSac);
  const poolUser: PoolUser = await pool.loadUser(user);
  const bTokens = poolUser.getCollateralBTokens(reserve);
  return { bTokens, suppliedUsdc: reserve.toAssetFromBTokenFloat(bTokens) };
}
