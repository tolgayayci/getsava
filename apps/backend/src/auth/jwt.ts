import { importSPKI, jwtVerify, SignJWT } from 'jose';
import type { PrivyConfig } from '../config';

/**
 * Session tokens + Privy binding.
 *
 * After a SEP-10 challenge is verified, the backend issues its own short-lived
 * HS256 session JWT bound to the proven Stellar account (and, when a Privy
 * access token is supplied, to the Privy user id). Privy access tokens are
 * verified with the app's ES256 verification key — never trusting client claims.
 * Built on `jose`, which runs on both Cloudflare Workers and Node via Web Crypto.
 */

const PRIVY_ISSUER = 'privy.io';
const SESSION_ALG = 'HS256';
const PRIVY_ALG = 'ES256';

export interface SessionClaims {
  readonly stellarAddress: string;
  readonly privyUserId?: string;
}

export interface IssuedSession {
  readonly token: string;
  /** Expiry as unix seconds. */
  readonly expiresAt: number;
}

export interface IssueSessionInput {
  readonly stellarAddress: string;
  readonly privyUserId?: string;
  /** Token issuer — the web-auth domain. */
  readonly issuer: string;
  readonly jwtSecret: string;
  readonly expSeconds: number;
  /** Unix seconds; injectable for tests. */
  readonly now?: number;
}

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/** Issue a Sava session JWT bound to the (Privy-issued) Stellar account. */
export async function issueSession(input: IssueSessionInput): Promise<IssuedSession> {
  const iat = Math.floor(input.now ?? Date.now() / 1000);
  const exp = iat + input.expSeconds;
  const token = await new SignJWT({
    stellar_address: input.stellarAddress,
    ...(input.privyUserId ? { privy_user_id: input.privyUserId } : {}),
  })
    .setProtectedHeader({ alg: SESSION_ALG, typ: 'JWT' })
    .setSubject(input.stellarAddress)
    .setIssuer(input.issuer)
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(secretKey(input.jwtSecret));
  return { token, expiresAt: exp };
}

/** Verify a Sava session JWT and return its bound claims. Throws on failure. */
export async function verifySession(
  token: string,
  jwtSecret: string,
  issuer: string,
): Promise<SessionClaims> {
  const { payload } = await jwtVerify(token, secretKey(jwtSecret), { issuer });
  const stellarAddress =
    typeof payload.stellar_address === 'string' ? payload.stellar_address : payload.sub;
  if (typeof stellarAddress !== 'string' || stellarAddress.length === 0) {
    throw new Error('Session token missing stellar address');
  }
  return {
    stellarAddress,
    ...(typeof payload.privy_user_id === 'string' ? { privyUserId: payload.privy_user_id } : {}),
  };
}

export interface PrivyIdentity {
  readonly userId: string;
}

/**
 * Verify a Privy access-token JWT (ES256) against the app's verification key and
 * return the Privy user id. Enforces issuer `privy.io` and audience = app id.
 */
export async function verifyPrivyToken(token: string, privy: PrivyConfig): Promise<PrivyIdentity> {
  const key = await importSPKI(privy.verificationKey, PRIVY_ALG);
  const { payload } = await jwtVerify(token, key, {
    issuer: PRIVY_ISSUER,
    audience: privy.appId,
  });
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('Privy token missing subject');
  }
  return { userId: payload.sub };
}
