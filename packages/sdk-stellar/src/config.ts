import type { Network } from '@getsava/types';

export interface AssetRef {
  readonly code: string;
  readonly issuer: string;
}

export interface NetworkConfig {
  readonly network: Network;
  readonly horizonUrl: string;
  readonly rpcUrl: string;
  readonly networkPassphrase: string;
  /** Friendbot funding endpoint (testnet only; mainnet funds via a sponsor — T3). */
  readonly friendbotUrl: string | null;
  readonly usdc: AssetRef;
}

// Passphrases are the canonical Stellar network identifiers (same values as
// stellar-base's `Networks.TESTNET` / `Networks.PUBLIC`), inlined so this config
// module has no dependency and stays trivially testable.
const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
const PUBLIC_PASSPHRASE = 'Public Global Stellar Network ; September 2015';

export const NETWORKS: Record<Network, NetworkConfig> = {
  testnet: {
    network: 'testnet',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    networkPassphrase: TESTNET_PASSPHRASE,
    friendbotUrl: 'https://friendbot.stellar.org',
    // Circle's official testnet USDC issuer (faucet.circle.com) — the asset
    // Blend's testnet pool accepts. The Sava treasury holds it (from the faucet)
    // and TRANSFERS it on deposit, standing in for Mercuryo settlement until the
    // sandbox is live. Mainnet uses Circle's mainnet USDC + real Mercuryo settle.
    usdc: { code: 'USDC', issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5' },
  },
  mainnet: {
    network: 'mainnet',
    horizonUrl: 'https://horizon.stellar.org',
    rpcUrl: 'https://mainnet.sorobanrpc.com',
    networkPassphrase: PUBLIC_PASSPHRASE,
    friendbotUrl: null,
    // Circle USDC on Stellar mainnet. TODO(T3): re-verify issuer before mainnet launch.
    usdc: { code: 'USDC', issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN' },
  },
};

export function networkConfig(network: Network): NetworkConfig {
  return NETWORKS[network];
}
