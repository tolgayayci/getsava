/**
 * Find the user's embedded Stellar wallet address among Privy linked accounts.
 *
 * Privy's Stellar embedded wallet is a curve-signing embedded-wallet account
 * with `chain_type: 'stellar'` — unlike EVM/Solana wallets it does NOT carry a
 * `type: 'wallet'` field, so we match on chain_type. Accepts both snake_case
 * (`linked_accounts`/`chain_type`) and camelCase shapes Privy may return, and
 * tolerates loosely-typed (`unknown`) account arrays from the Privy SDK.
 */
export interface PrivyUserLike {
  readonly linked_accounts?: readonly unknown[];
  readonly linkedAccounts?: readonly unknown[];
}

interface LinkedAccountShape {
  readonly chain_type?: unknown;
  readonly chainType?: unknown;
  readonly address?: unknown;
}

function chainTypeOf(account: unknown): string | null {
  if (typeof account !== 'object' || account === null) {
    return null;
  }
  const a = account as LinkedAccountShape;
  const chain = a.chain_type ?? a.chainType;
  return typeof chain === 'string' ? chain : null;
}

function addressOf(account: unknown): string | null {
  if (typeof account !== 'object' || account === null) {
    return null;
  }
  const { address } = account as LinkedAccountShape;
  return typeof address === 'string' ? address : null;
}

export function findStellarAddress(user: PrivyUserLike | null | undefined): string | null {
  if (!user) {
    return null;
  }
  const accounts = user.linked_accounts ?? user.linkedAccounts ?? [];
  const stellar = accounts.find((a) => chainTypeOf(a) === 'stellar');
  return stellar ? addressOf(stellar) : null;
}
