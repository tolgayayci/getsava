import type { Network } from '@getsava/types';
import { MAINNET_ENABLED } from '../config/mainnet';

/**
 * App-wide Stellar network. Mainnet is gated behind the T2.D6 feature flag
 * (MAINNET_ENABLED) and flips at Tranche 3 launch; the app runs on testnet until
 * then. See apps/mobile/src/config/mainnet.ts + docs/pool-whitelist.md.
 */
export const NETWORK: Network = MAINNET_ENABLED ? 'mainnet' : 'testnet';
