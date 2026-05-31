import type { Network } from '@getsava/types';
import { Account, Asset, Operation, TransactionBuilder } from '@stellar/stellar-base';
import { networkConfig } from './config';

/** Fee per operation, in stroots. 10000 = 0.001 XLM — safe, well under any ceiling. */
export const DEFAULT_FEE = '10000';

/** Seconds a built transaction stays valid before it must be re-built. */
export const DEFAULT_TIMEOUT_SECONDS = 180;

/**
 * Build the unsigned `changeTrust` transaction that adds the USDC trustline for
 * `address`. `sequence` is the account's CURRENT sequence from Horizon — the
 * builder increments it. Returns the base64 XDR to hash + sign.
 */
export function buildUsdcTrustlineXdr(
  network: Network,
  address: string,
  sequence: string,
  options: { fee?: string; timeoutSeconds?: number } = {},
): string {
  const { usdc, networkPassphrase } = networkConfig(network);
  const account = new Account(address, sequence);
  const asset = new Asset(usdc.code, usdc.issuer);

  const tx = new TransactionBuilder(account, {
    fee: options.fee ?? DEFAULT_FEE,
    networkPassphrase,
  })
    .addOperation(Operation.changeTrust({ asset }))
    .setTimeout(options.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS)
    .build();

  return tx.toEnvelope().toXDR('base64');
}
