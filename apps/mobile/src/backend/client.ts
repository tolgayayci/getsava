/**
 * Backend client seam.
 *
 * T1.D1.S4 requires the backend to upsert a `users` row (Privy DID + Stellar
 * pubkey + locale) and issue a session JWT on first provisioning. That backend
 * is T1.D6 (YK-487/488). To honour the build order without blocking D1, the
 * client side talks to this interface; a no-op stub stands in until D6 wires the
 * real Hono endpoints. Swapping the impl is the only change needed then.
 */

export interface UpsertUserInput {
  readonly stellarAddress: string;
  readonly locale?: string;
}

export interface SessionToken {
  readonly token: string;
  readonly expiresAt: number;
}

export interface BackendClient {
  /** Bind the authenticated Privy user to its Stellar pubkey; returns a session JWT. */
  upsertUser: (input: UpsertUserInput) => Promise<SessionToken | null>;
}

/**
 * Stub backend client — logs and no-ops. Replaced by the real HTTP client in
 * T1.D6 (SEP-10 → JWT). Until then, provisioning runs fully client-side on
 * testnet and the session is Privy's own.
 */
export const stubBackendClient: BackendClient = {
  upsertUser: async ({ stellarAddress }) => {
    if (__DEV__) {
      console.log(`[Sava] (stub) backend.upsertUser(${stellarAddress}) — wired in T1.D6`);
    }
    return null;
  },
};
