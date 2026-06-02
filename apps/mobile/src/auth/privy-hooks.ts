import type { Hex, SignRawHashFn } from '@getsava/sdk-stellar';
import {
  useLoginWithEmail as privyUseLoginWithEmail,
  useLoginWithOAuth as privyUseLoginWithOAuth,
  usePrivy as privyUsePrivy,
} from '@privy-io/expo';
import {
  useCreateWallet as privyUseCreateWallet,
  useSignRawHash as privyUseSignRawHash,
} from '@privy-io/expo/extended-chains';

/**
 * Typed re-exports of the Privy hooks we use.
 *
 * `@privy-io/expo` ships native modules that ONLY exist in a dev build — it
 * cannot run in Expo Go. We import it directly (no try/catch, no demo fallback):
 * in Expo Go the bundle simply fails, which is the intended behaviour — there is
 * no fake "logged-out" mode. Use a dev build (expo-dev-client) to run the app.
 */

export interface PrivyUser {
  readonly id?: string;
  readonly linked_accounts?: readonly unknown[];
  readonly linkedAccounts?: readonly unknown[];
  readonly email?: { address?: string };
  readonly google?: { email?: string };
}

export interface UsePrivyResult {
  readonly isReady: boolean;
  readonly user: PrivyUser | null;
  readonly logout: () => Promise<void>;
}

export interface UseLoginWithEmailResult {
  readonly sendCode: (input: { email: string }) => Promise<void>;
  readonly loginWithCode: (input: { code: string }) => Promise<void>;
}

export type OAuthProvider = 'google' | 'apple';

export interface UseLoginWithOAuthResult {
  readonly login: (input: { provider: OAuthProvider }) => Promise<void>;
}

export interface UseCreateWalletResult {
  readonly createWallet: (input: {
    chainType: 'stellar';
  }) => Promise<{ wallet: { address: string } }>;
}

export interface UseSignRawHashResult {
  readonly signRawHash: SignRawHashFn;
}

export const usePrivy = privyUsePrivy as unknown as () => UsePrivyResult;
export const useLoginWithEmail = privyUseLoginWithEmail as unknown as () => UseLoginWithEmailResult;
export const useLoginWithOAuth = privyUseLoginWithOAuth as unknown as () => UseLoginWithOAuthResult;
export const useCreateWallet = privyUseCreateWallet as unknown as () => UseCreateWalletResult;
export const useSignRawHash = privyUseSignRawHash as unknown as () => UseSignRawHashResult;

// Re-export Hex so dependents have the signing type without reaching into sdk-stellar.
export type { Hex };
