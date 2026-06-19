import { networkConfig } from '@getsava/sdk-stellar';
import type { Network } from '@getsava/types';

/** USDC uses 7 decimals on Stellar (1 USDC = 1e7 stroops). */
export const USDC_DECIMALS = 7;

export interface BlendNetworkConfig {
  readonly network: Network;
  readonly rpcUrl: string;
  readonly networkPassphrase: string;
  /** Blend v2 pool Sava supplies USDC into. */
  readonly poolId: string;
  /** USDC Stellar Asset Contract (SAC) id — the `address` field on every Request. */
  readonly usdcSac: string;
  readonly backstopId: string;
  readonly blndToken: string;
  readonly poolFactoryId: string;
  readonly usdcDecimals: number;
}

// Testnet Blend v2 addresses — all live-verified (see ../INTEGRATION.md §8 +
// ../VERIFICATION.md). The chosen pool's USDC reserve (index 1) accepts Circle's
// testnet USDC (issuer GBBD47…), the exact asset Sava's on/off-ramp already
// delivers; `usdcSac` is the deterministic SAC contract id of that classic asset.
// Testnet resets wipe Soroban state, so assert is_pool / get_reserve_list /
// config.enabled / get_config().status live at startup before trusting these.
const TESTNET = {
  poolId: 'CAPBMXIQTICKWFPWFDJWMAKBXBPJZUKLNONQH3MLPLLBKQ643CYN5PRW',
  usdcSac: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
  backstopId: 'CBDVWXT433PRVTUNM56C3JREF3HIZHRBA64NB2C3B2UNCKIS65ZYCLZA',
  blndToken: 'CB22KRA3YZVCNCQI64JQ5WE7UY2VAV7WFLK6A2JN3HEX56T2EDAFO7QF',
  poolFactoryId: 'CDV6RX4CGPCOKGTBFS52V3LMWQGZN3LCQTXF5RVPOOCG4XVMHXQ4NTF6',
} as const;

// Mainnet Blend v2 addresses (blend-utils/mainnet.contracts.json). The launch
// POOL was selected in T2.D6 (see docs/pool-whitelist.md): "Fixed V2" — the
// deepest USDC pool (~$53M), which passes the size-aware whitelist on its large
// absolute backstop (~$3.39M ≥ $1M) despite a low coverage ratio. The app stays
// on testnet until the T3 feature-flag flip (apps/mobile/src/config/mainnet.ts).
const MAINNET = {
  poolId: 'CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD',
  usdcSac: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
  backstopId: 'CAQQR5SWBXKIGZKPBZDH3KM5GQ5GUTPKB7JAFCINLZBC5WXPJKRG3IM7',
  blndToken: 'CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY',
  poolFactoryId: 'CDSYOAVXFY7SM5S64IZPPPYB4GVGGLMQVFREPSQQEZVIWXX5R23G4QSU',
} as const;

export function blendConfig(network: Network): BlendNetworkConfig {
  const base = networkConfig(network);
  return {
    network,
    rpcUrl: base.rpcUrl,
    networkPassphrase: base.networkPassphrase,
    usdcDecimals: USDC_DECIMALS,
    ...(network === 'mainnet' ? MAINNET : TESTNET),
  };
}

/** Project the blend-sdk `Network` shape (`{ rpc, passphrase }`) from a BlendNetworkConfig. */
export function blendNetwork(cfg: BlendNetworkConfig): { rpc: string; passphrase: string } {
  return { rpc: cfg.rpcUrl, passphrase: cfg.networkPassphrase };
}
