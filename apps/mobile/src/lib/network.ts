import type { Network } from '@getsava/types';

/** App-wide Stellar network, from EXPO_PUBLIC_STELLAR_NETWORK (defaults to testnet). */
export const NETWORK: Network =
  process.env.EXPO_PUBLIC_STELLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
