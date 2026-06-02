import type { Network } from '@getsava/types';
import {
  Account,
  Asset,
  Keypair,
  Memo,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-base';
import { networkConfig } from './config';
import { fetchAccount, submitTransaction } from './horizon';
import { DEFAULT_FEE, DEFAULT_TIMEOUT_SECONDS } from './trustline';

/**
 * Build, sign, and submit a USDC payment from a source account (holding its own
 * secret key) to a destination address. Used by the TESTNET treasury bridge
 * that delivers USDC to the user after a Mercuryo sandbox payment — flagged
 * BRIDGE_TESTNET and removed for mainnet, where Mercuryo settles USDC-on-Stellar
 * directly. Source signs locally with its keypair (NOT Privy raw-hash — this is
 * a Sava-controlled server account, secret server-side only).
 */
export interface SendUsdcInput {
  readonly network: Network;
  /** Source account secret (S...). SERVER-SIDE ONLY — never the client. */
  readonly sourceSecret: string;
  readonly destination: string;
  /** USDC amount as a decimal string, e.g. "500.00". */
  readonly amount: string;
  /** Optional text memo to tie the payment to an order (≤28 bytes). */
  readonly memo?: string;
}

export interface SendUsdcResult {
  readonly hash: string;
}

export async function sendUsdc(input: SendUsdcInput): Promise<SendUsdcResult> {
  const cfg = networkConfig(input.network);
  const keypair = Keypair.fromSecret(input.sourceSecret);
  const source = keypair.publicKey();

  const account = await fetchAccount(input.network, source);
  if (account === null) {
    throw new Error('Treasury source account not found on Horizon');
  }

  const asset = new Asset(cfg.usdc.code, cfg.usdc.issuer);
  const builder = new TransactionBuilder(new Account(source, account.sequence), {
    fee: DEFAULT_FEE,
    networkPassphrase: cfg.networkPassphrase,
  }).addOperation(
    Operation.payment({ destination: input.destination, asset, amount: input.amount }),
  );

  if (input.memo !== undefined) {
    builder.addMemo(memoText(input.memo));
  }

  const tx = builder.setTimeout(DEFAULT_TIMEOUT_SECONDS).build();
  tx.sign(keypair);
  const hash = await submitTransaction(input.network, tx.toEnvelope().toXDR('base64'));
  return { hash };
}

// Build a text memo truncated to Stellar's 28-byte limit (ties a payment to an order).
function memoText(text: string): Memo {
  return Memo.text(text.slice(0, 28));
}
