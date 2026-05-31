import type { Network } from '@getsava/types';
import {
  type Balances,
  fetchAccount,
  fundWithFriendbot,
  getBalances,
  type HorizonAccount,
  hasUsdcTrustline,
  submitTransaction,
} from './horizon';
import { type SignRawHashFn, signTransaction } from './signing';
import { buildUsdcTrustlineXdr } from './trustline';

/**
 * Provisioning state machine (YK-458). The user must reach `ready` — a funded
 * account WITH a USDC trustline — before any deposit, or Mercuryo's USDC
 * settlement would bounce and the funds appear to vanish.
 */
export type ProvisioningState =
  | 'pending'
  | 'funding'
  | 'funded'
  | 'trustline_pending'
  | 'ready'
  | 'failed';

export interface ProvisionResult {
  readonly address: string;
  readonly balances: Balances;
}

export interface ProvisionOptions {
  readonly onState?: (state: ProvisioningState) => void;
  /** Injectable sleep (tests pass a no-op). Defaults to real setTimeout. */
  readonly sleep?: (ms: number) => Promise<void>;
  /** Poll attempts when waiting for Horizon to reflect a change. */
  readonly maxPollAttempts?: number;
  readonly pollIntervalMs?: number;
}

const realSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ensure `address` is a funded account with a USDC trustline, signing the
 * `changeTrust` with Privy's raw-hash signer. Idempotent: safe to re-run after a
 * partial failure (skips funding / trustline if already present).
 *
 * NOTE: the backend `users`-row upsert + session-JWT issuance (also part of
 * YK-458) is deliberately NOT here — it belongs to the backend (T1.D6) and is
 * invoked by the caller through a separate client, keeping this on-chain flow
 * pure and unit-testable.
 */
export async function ensureUsdcTrustline(
  network: Network,
  address: string,
  signRawHash: SignRawHashFn,
  options: ProvisionOptions = {},
): Promise<ProvisionResult> {
  const onState = options.onState ?? (() => {});
  const sleep = options.sleep ?? realSleep;
  const maxPollAttempts = options.maxPollAttempts ?? 10;
  const pollIntervalMs = options.pollIntervalMs ?? 2000;

  try {
    onState('pending');

    // 1. Fund the account if it doesn't exist yet.
    let account = await fetchAccount(network, address);
    if (account === null) {
      onState('funding');
      await fundWithFriendbot(network, address);
      account = await pollForAccount(network, address, sleep, maxPollAttempts, pollIntervalMs);
    }
    onState('funded');

    // 2. Add the USDC trustline if missing.
    if (!hasUsdcTrustline(account, network)) {
      onState('trustline_pending');
      const unsignedXdr = buildUsdcTrustlineXdr(network, address, account.sequence);
      const signedXdr = await signTransaction(network, unsignedXdr, address, signRawHash);
      await submitTransaction(network, signedXdr);
      await pollForTrustline(network, address, sleep, maxPollAttempts, pollIntervalMs);
    }

    const balances = await getBalances(network, address);
    onState('ready');
    return { address, balances };
  } catch (error) {
    onState('failed');
    throw error;
  }
}

async function pollForAccount(
  network: Network,
  address: string,
  sleep: (ms: number) => Promise<void>,
  attempts: number,
  intervalMs: number,
): Promise<HorizonAccount> {
  for (let i = 0; i < attempts; i += 1) {
    await sleep(intervalMs);
    const account = await fetchAccount(network, address);
    if (account !== null) {
      return account;
    }
  }
  throw new Error('Timed out waiting for the funded account to appear on Horizon');
}

async function pollForTrustline(
  network: Network,
  address: string,
  sleep: (ms: number) => Promise<void>,
  attempts: number,
  intervalMs: number,
): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    await sleep(intervalMs);
    const account = await fetchAccount(network, address);
    if (account !== null && hasUsdcTrustline(account, network)) {
      return;
    }
  }
  throw new Error('Timed out waiting for the USDC trustline to confirm on Horizon');
}
