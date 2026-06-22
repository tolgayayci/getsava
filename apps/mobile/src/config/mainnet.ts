import type { Network } from '@getsava/types';

/**
 * Mainnet launch configuration (T2.D6). Sava runs on TESTNET until this flag is
 * flipped at Tranche 3 launch — set EXPO_PUBLIC_MAINNET_ENABLED=true (with a
 * mainnet build) to switch. The launch pool was chosen by scoring real Blend v2
 * mainnet pools against the 5-rule whitelist; full rationale + scoring matrix:
 * docs/pool-whitelist.md.
 */
export const MAINNET_ENABLED = process.env.EXPO_PUBLIC_MAINNET_ENABLED === 'true';

export const MAINNET_NETWORK: Network = 'mainnet';

/**
 * The selected launch pool: Blend v2 "Fixed V2" — the deepest USDC pool (~$53M).
 * It passes the SIZE-AWARE whitelist: its coverage ratio (6.3%) is below the 8%
 * floor, but its absolute first-loss capital (~$3.39M) clears the $1M bar, and a
 * large pool's absolute backstop is the better real measure of protection. Chosen
 * for launch liquidity (~94× the next-safest pool's TVL).
 */
export const MAINNET_POOL = {
  name: 'Fixed V2',
  id: 'CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD',
} as const;

/** Mainnet Blend v2 contract ids (source: blend-utils/mainnet.contracts.json). */
export const MAINNET_CONTRACTS = {
  pool: MAINNET_POOL.id,
  usdc: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
  backstop: 'CAQQR5SWBXKIGZKPBZDH3KM5GQ5GUTPKB7JAFCINLZBC5WXPJKRG3IM7',
  poolFactory: 'CDSYOAVXFY7SM5S64IZPPPYB4GVGGLMQVFREPSQQEZVIWXX5R23G4QSU',
  blnd: 'CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY',
} as const;

export interface PoolScore {
  readonly name: string;
  readonly id: string;
  readonly tvlUsdc: number;
  readonly backstopCoverage: number;
  readonly poolStatus: number;
  readonly passes: boolean;
  readonly note: string;
}

/**
 * Candidate scoring snapshot from the D6 selection (real mainnet data captured
 * 2026-06-13; live values drift, the relative ranking is the decision record).
 */
export const MAINNET_CANDIDATES: readonly PoolScore[] = [
  {
    name: 'Fixed V2',
    id: 'CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD',
    tvlUsdc: 53_466_365,
    backstopCoverage: 0.063,
    poolStatus: 1,
    passes: true,
    note: 'SELECTED — deepest USDC pool ($53M). 6.3% ratio but ~$3.39M absolute backstop (≥ $1M) → passes the size-aware rule; best launch liquidity.',
  },
  {
    name: 'YieldBlox V2',
    id: 'CCCCIQSDILITHMM7PBSLVDT5MISSY7R26MNZXCX4H7J5JQ5FPIYOGYFS',
    tvlUsdc: 568_713,
    backstopCoverage: 0.587,
    poolStatus: 0,
    passes: true,
    note: 'Passes (58.7% coverage) but ~94× smaller ($568K) — far less launch liquidity.',
  },
  {
    name: 'CDMAVJPF…',
    id: 'CDMAVJPFXPADND3YRL4BSM3AKZWCTFMX27GLLXCML3PD62HEQS5FPVAI',
    tvlUsdc: 34_698,
    backstopCoverage: 0.954,
    poolStatus: 1,
    passes: true,
    note: 'Passes all rules but TVL ~$35K — too small for launch liquidity.',
  },
] as const;
