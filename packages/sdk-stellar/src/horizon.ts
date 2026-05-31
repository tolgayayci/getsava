import type { Network } from '@getsava/types';
import { networkConfig } from './config';

/** Subset of a Horizon balance line we care about. */
interface HorizonBalance {
  readonly asset_type: string;
  readonly balance: string;
  readonly asset_code?: string;
  readonly asset_issuer?: string;
}

export interface HorizonAccount {
  readonly sequence: string;
  readonly balances?: readonly HorizonBalance[];
}

export interface Balances {
  /** Native XLM, fixed to 7 decimals as a string. */
  readonly xlm: string;
  /** USDC, fixed to 7 decimals as a string. */
  readonly usdc: string;
}

export class HorizonError extends Error {
  readonly status: number;
  /** Stellar operation result codes, when Horizon supplies them. */
  readonly resultCodes?: readonly string[];

  constructor(message: string, status: number, resultCodes?: readonly string[]) {
    super(message);
    this.name = 'HorizonError';
    this.status = status;
    if (resultCodes !== undefined) {
      this.resultCodes = resultCodes;
    }
  }
}

function zeros(): Balances {
  return { xlm: '0', usdc: '0' };
}

/** Fetch an account from Horizon. Returns null if it does not exist (404). */
export async function fetchAccount(
  network: Network,
  address: string,
): Promise<HorizonAccount | null> {
  const { horizonUrl } = networkConfig(network);
  const res = await fetch(`${horizonUrl}/accounts/${address}`);
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new HorizonError(`Horizon account lookup failed (${res.status})`, res.status);
  }
  return (await res.json()) as HorizonAccount;
}

export async function accountExists(network: Network, address: string): Promise<boolean> {
  return (await fetchAccount(network, address)) !== null;
}

export function hasUsdcTrustline(account: HorizonAccount, network: Network): boolean {
  const { usdc } = networkConfig(network);
  return (account.balances ?? []).some(
    (b) => b.asset_code === usdc.code && b.asset_issuer === usdc.issuer,
  );
}

/** Read XLM + USDC balances from a fetched account. */
export function readBalances(account: HorizonAccount, network: Network): Balances {
  const { usdc } = networkConfig(network);
  let xlm = '0';
  let usdcBal = '0';
  for (const b of account.balances ?? []) {
    if (b.asset_type === 'native') {
      xlm = Number.parseFloat(b.balance).toFixed(7);
    } else if (b.asset_code === usdc.code && b.asset_issuer === usdc.issuer) {
      usdcBal = Number.parseFloat(b.balance).toFixed(7);
    }
  }
  return { xlm, usdc: usdcBal };
}

/** Convenience: fetch + read balances, returning zeros for a missing account. */
export async function getBalances(network: Network, address: string): Promise<Balances> {
  const account = await fetchAccount(network, address);
  return account ? readBalances(account, network) : zeros();
}

/** Submit a signed base64 XDR envelope; returns the transaction hash on success. */
export async function submitTransaction(network: Network, signedXdr: string): Promise<string> {
  const { horizonUrl } = networkConfig(network);
  const res = await fetch(`${horizonUrl}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `tx=${encodeURIComponent(signedXdr)}`,
  });
  const data = (await res.json()) as {
    hash?: string;
    detail?: string;
    title?: string;
    extras?: { result_codes?: { operations?: string[]; transaction?: string } };
  };
  if (!res.ok) {
    const opCodes = data.extras?.result_codes?.operations;
    const txCode = data.extras?.result_codes?.transaction;
    const codes = [txCode, ...(opCodes ?? [])].filter((c): c is string => Boolean(c));
    const message =
      codes.length > 0
        ? `Transaction failed: ${codes.join(', ')}`
        : (data.detail ?? data.title ?? `Horizon error ${res.status}`);
    throw new HorizonError(message, res.status, codes.length > 0 ? codes : undefined);
  }
  if (!data.hash) {
    throw new HorizonError('Horizon accepted the tx but returned no hash', res.status);
  }
  return data.hash;
}

/** Fund a testnet account via Friendbot. Throws on mainnet (no Friendbot). */
export async function fundWithFriendbot(network: Network, address: string): Promise<void> {
  const { friendbotUrl } = networkConfig(network);
  if (friendbotUrl === null) {
    throw new HorizonError('Friendbot is testnet-only; mainnet funding uses a sponsor', 400);
  }
  const res = await fetch(`${friendbotUrl}?addr=${encodeURIComponent(address)}`);
  if (!res.ok && res.status !== 400) {
    // 400 usually means "account already funded" — not an error for our purposes.
    throw new HorizonError(`Friendbot funding failed (${res.status})`, res.status);
  }
}
