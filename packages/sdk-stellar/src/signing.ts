import type { Network } from '@getsava/types';
import { Transaction } from '@stellar/stellar-base';
import { networkConfig } from './config';

export type Hex = `0x${string}`;

export interface SignRawHashInput {
  readonly address: string;
  readonly chainType: 'stellar';
  readonly hash: Hex;
}

/**
 * Privy's raw-hash signer (from `@privy-io/expo/extended-chains`'s
 * `useSignRawHash`). Kept as a plain function type so this package has no
 * dependency on Privy or React and stays unit-testable.
 */
export type SignRawHashFn = (input: SignRawHashInput) => Promise<{ signature: Hex }>;

function stripHex(value: string): string {
  return value.startsWith('0x') ? value.slice(2) : value;
}

/** 0x-prefixed hex of a transaction's signature-base hash, for Privy signRawHash. */
export function transactionHashHex(network: Network, txXdr: string): Hex {
  const { networkPassphrase } = networkConfig(network);
  const tx = new Transaction(txXdr, networkPassphrase);
  return `0x${tx.hash().toString('hex')}`;
}

/**
 * Attach a raw Ed25519 signature (hex, from Privy signRawHash) to an unsigned
 * transaction XDR and return the signed base64 envelope.
 */
export function attachSignature(
  network: Network,
  txXdr: string,
  signerAddress: string,
  signatureHex: string,
): string {
  const { networkPassphrase } = networkConfig(network);
  const tx = new Transaction(txXdr, networkPassphrase);
  // stellar-base's addSignature expects a base64-encoded signature string.
  const sigBase64 = Buffer.from(stripHex(signatureHex), 'hex').toString('base64');
  tx.addSignature(signerAddress, sigBase64);
  return tx.toEnvelope().toXDR('base64');
}

/**
 * Hash → Privy sign → attach, in one step. Returns the signed base64 XDR ready
 * for {@link submitTransaction}.
 */
export async function signTransaction(
  network: Network,
  txXdr: string,
  signerAddress: string,
  signRawHash: SignRawHashFn,
): Promise<string> {
  const hash = transactionHashHex(network, txXdr);
  const { signature } = await signRawHash({ address: signerAddress, chainType: 'stellar', hash });
  return attachSignature(network, txXdr, signerAddress, signature);
}
