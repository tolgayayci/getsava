/**
 * Find the user's embedded Stellar wallet address among Privy linked accounts.
 *
 * Privy's Stellar embedded wallet is a curve-signing embedded-wallet account
 * with `chain_type: 'stellar'` — unlike EVM/Solana wallets it does NOT carry a
 * `type: 'wallet'` field, so we match on chain_type. Accepts both snake_case
 * (`linked_accounts`/`chain_type`) and camelCase shapes Privy may return.
 */
export interface LinkedAccountLike {
  readonly chain_type?: string;
  readonly chainType?: string;
  readonly address?: string;
}

export interface PrivyUserLike {
  readonly linked_accounts?: readonly LinkedAccountLike[];
  readonly linkedAccounts?: readonly LinkedAccountLike[];
}

export function findStellarAddress(user: PrivyUserLike | null | undefined): string | null {
  if (!user) {
    return null;
  }
  const accounts = user.linked_accounts ?? user.linkedAccounts ?? [];
  const stellar = accounts.find((a) => (a.chain_type ?? a.chainType) === 'stellar');
  return stellar?.address ?? null;
}
