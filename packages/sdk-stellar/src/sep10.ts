import type { Network } from '@getsava/types';
import {
  Account,
  BASE_FEE,
  Keypair,
  Operation,
  StrKey,
  Transaction,
  TransactionBuilder,
} from '@stellar/stellar-base';
import { networkConfig } from './config';

/**
 * SEP-10 Stellar Web Authentication (https://stellar.org/protocol/sep-10).
 *
 * The backend (the "server account") issues a challenge transaction the client
 * must sign with the key that controls its Stellar account. Verifying that
 * signature proves account control, which the backend exchanges for a session
 * JWT. These are pure functions over @stellar/stellar-base so they run in both
 * Cloudflare Workers and Node tests, and never touch HTTP/JWT/secrets storage.
 */

export class ChallengeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChallengeError';
  }
}

/** SEP-10: 48 random bytes, base64-encoded → a 64-byte manageData value. */
const NONCE_BYTES = 48;
const NONCE_B64_LEN = 64;
const AUTH_SUFFIX = ' auth';
const WEB_AUTH_DOMAIN_KEY = 'web_auth_domain';
const DEFAULT_TIMEOUT_SECONDS = 900;

/** Minimal shape of a decoded manageData operation (avoids stellar-base's wide union). */
interface ManageDataOp {
  readonly type: string;
  readonly name?: string;
  readonly value?: Buffer | null;
  readonly source?: string;
}

export interface BuildChallengeInput {
  readonly network: Network;
  /** SEP-10 server signing secret (S…). SERVER-SIDE ONLY. */
  readonly serverSecret: string;
  /** The client's Stellar account (G…) requesting authentication. */
  readonly clientAccountId: string;
  /** Home domain the challenge authenticates for (manageData key prefix). */
  readonly homeDomain: string;
  /** Domain hosting this web-auth endpoint (the `web_auth_domain` op). */
  readonly webAuthDomain: string;
  /** Challenge lifetime; default 900s (15 min). */
  readonly timeoutSeconds?: number;
  /** Unix seconds; injectable for deterministic tests. */
  readonly now?: number;
  /** 48-byte nonce override (tests). Random when omitted. */
  readonly nonce?: Uint8Array;
}

export interface BuiltChallenge {
  /** Base64 transaction envelope, signed by the server. */
  readonly transaction: string;
  readonly serverAccountId: string;
  readonly networkPassphrase: string;
}

export interface VerifyChallengeInput {
  readonly network: Network;
  /** The server's account id (G…) — the expected challenge source + signer. */
  readonly serverAccountId: string;
  /** The signed challenge envelope returned by the client. */
  readonly challengeXdr: string;
  readonly homeDomain: string;
  readonly webAuthDomain: string;
  /** Unix seconds; injectable for deterministic tests. */
  readonly now?: number;
}

/** True if `address` is a valid Stellar ed25519 public key (G…). */
export function isValidStellarAddress(address: string): boolean {
  return StrKey.isValidEd25519PublicKey(address);
}

function nowSeconds(override?: number): number {
  return Math.floor(override ?? Date.now() / 1000);
}

function randomNonce(): Uint8Array {
  const bytes = new Uint8Array(NONCE_BYTES);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** Build + server-sign a SEP-10 challenge transaction for `clientAccountId`. */
export function buildChallengeTransaction(input: BuildChallengeInput): BuiltChallenge {
  if (!StrKey.isValidEd25519SecretSeed(input.serverSecret)) {
    throw new ChallengeError('Invalid server signing secret');
  }
  if (!isValidStellarAddress(input.clientAccountId)) {
    throw new ChallengeError('Invalid client account id');
  }
  const { networkPassphrase } = networkConfig(input.network);
  const serverKp = Keypair.fromSecret(input.serverSecret);
  // Sequence -1 so the built transaction has sequence 0, per SEP-10.
  const serverAccount = new Account(serverKp.publicKey(), '-1');
  const start = nowSeconds(input.now);
  const timeout = input.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;
  const nonceB64 = Buffer.from(input.nonce ?? randomNonce()).toString('base64');

  const tx = new TransactionBuilder(serverAccount, {
    fee: BASE_FEE,
    networkPassphrase,
    timebounds: { minTime: start, maxTime: start + timeout },
  })
    .addOperation(
      Operation.manageData({
        name: `${input.homeDomain}${AUTH_SUFFIX}`,
        value: nonceB64,
        source: input.clientAccountId,
      }),
    )
    .addOperation(
      Operation.manageData({
        name: WEB_AUTH_DOMAIN_KEY,
        value: input.webAuthDomain,
        source: serverKp.publicKey(),
      }),
    )
    .build();

  tx.sign(serverKp);
  return {
    transaction: tx.toEnvelope().toXDR('base64'),
    serverAccountId: serverKp.publicKey(),
    networkPassphrase,
  };
}

/**
 * Verify a signed SEP-10 challenge: structure, time bounds, and that BOTH the
 * server and the client account signed it. Returns the client account id, or
 * throws {@link ChallengeError}. Stateless — the server's own signature on the
 * challenge is the integrity anchor, so no challenge needs to be stored.
 */
export function verifyChallengeTransaction(input: VerifyChallengeInput): {
  clientAccountId: string;
} {
  const { networkPassphrase } = networkConfig(input.network);

  let tx: Transaction;
  try {
    tx = new Transaction(input.challengeXdr, networkPassphrase);
  } catch {
    throw new ChallengeError('Malformed challenge transaction');
  }

  if (tx.source !== input.serverAccountId) {
    throw new ChallengeError('Challenge source is not the server account');
  }
  if (tx.sequence !== '0') {
    throw new ChallengeError('Challenge sequence number must be 0');
  }

  const ops = tx.operations as ManageDataOp[];
  const first = ops[0];
  if (!first || first.type !== 'manageData' || typeof first.name !== 'string') {
    throw new ChallengeError('First operation must be manageData');
  }
  if (typeof first.source !== 'string' || !isValidStellarAddress(first.source)) {
    throw new ChallengeError('First operation must be sourced by the client account');
  }
  const clientAccountId = first.source;
  if (first.name !== `${input.homeDomain}${AUTH_SUFFIX}`) {
    throw new ChallengeError('Challenge home domain does not match');
  }
  if (!first.value || first.value.length !== NONCE_B64_LEN) {
    throw new ChallengeError('Challenge nonce is malformed');
  }
  if (Buffer.from(first.value.toString('utf8'), 'base64').length !== NONCE_BYTES) {
    throw new ChallengeError('Challenge nonce is malformed');
  }

  // Any additional manageData ops must be sourced by the server account; the
  // web_auth_domain op (when present) must match our domain.
  for (let i = 1; i < ops.length; i += 1) {
    const op = ops[i];
    if (!op || op.type !== 'manageData') {
      throw new ChallengeError('Unexpected operation in challenge');
    }
    if (op.source !== input.serverAccountId) {
      throw new ChallengeError('Subsequent operations must be server-sourced');
    }
    if (op.name === WEB_AUTH_DOMAIN_KEY) {
      const domain = op.value ? op.value.toString('utf8') : '';
      if (domain !== input.webAuthDomain) {
        throw new ChallengeError('web_auth_domain does not match');
      }
    }
  }

  const tb = tx.timeBounds;
  if (!tb) {
    throw new ChallengeError('Challenge has no time bounds');
  }
  const minTime = Number(tb.minTime);
  const maxTime = Number(tb.maxTime);
  if (!Number.isFinite(maxTime) || maxTime === 0) {
    throw new ChallengeError('Challenge has no expiration');
  }
  const at = nowSeconds(input.now);
  if (at < minTime || at > maxTime) {
    throw new ChallengeError('Challenge has expired or is not yet valid');
  }

  // Exactly one valid server signature and one valid client signature required.
  const hash = tx.hash();
  const serverKp = Keypair.fromPublicKey(input.serverAccountId);
  const clientKp = Keypair.fromPublicKey(clientAccountId);
  let serverSigned = false;
  let clientSigned = false;
  for (const decorated of tx.signatures) {
    const sig = decorated.signature();
    if (serverKp.verify(hash, sig)) {
      serverSigned = true;
    }
    if (clientKp.verify(hash, sig)) {
      clientSigned = true;
    }
  }
  if (!serverSigned) {
    throw new ChallengeError('Missing or invalid server signature');
  }
  if (!clientSigned) {
    throw new ChallengeError('Missing or invalid client signature');
  }

  return { clientAccountId };
}

/** Add client signature(s) to a challenge envelope (test/CLI helper). */
export function signChallengeWithSecret(
  network: Network,
  challengeXdr: string,
  ...secrets: string[]
): string {
  const { networkPassphrase } = networkConfig(network);
  const tx = new Transaction(challengeXdr, networkPassphrase);
  for (const secret of secrets) {
    tx.sign(Keypair.fromSecret(secret));
  }
  return tx.toEnvelope().toXDR('base64');
}

/** Fresh random keypair (test/CLI helper). */
export function generateKeypair(): { publicKey: string; secret: string } {
  const kp = Keypair.random();
  return { publicKey: kp.publicKey(), secret: kp.secret() };
}

/** Derive the public account id (G…) for a secret seed (S…). */
export function accountIdFromSecret(secret: string): string {
  return Keypair.fromSecret(secret).publicKey();
}
