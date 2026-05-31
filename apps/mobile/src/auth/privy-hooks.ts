import type { Hex, SignRawHashFn } from '@getsava/sdk-stellar';

/**
 * Expo-Go-safe access to Privy's hooks.
 *
 * `@privy-io/expo` has native modules that throw on import in Expo Go. We
 * `require()` it once at module load and, if absent, substitute stub hooks. The
 * exported hook *references are constant for the app's lifetime*, so components
 * call them unconditionally and never violate the rules of hooks — whether Privy
 * is present (dev build) or not (Expo Go demo mode).
 *
 * Real auth/wallet only runs in a dev build with Privy configured (YK-455).
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

interface PrivyModule {
  usePrivy: () => UsePrivyResult;
  useLoginWithEmail: () => UseLoginWithEmailResult;
  useLoginWithOAuth: () => UseLoginWithOAuthResult;
}

interface PrivyExtendedChainsModule {
  useCreateWallet: () => UseCreateWalletResult;
  useSignRawHash: () => UseSignRawHashResult;
}

function loadPrivy(): { base: PrivyModule; ext: PrivyExtendedChainsModule } | null {
  try {
    const base = require('@privy-io/expo') as PrivyModule;
    const ext = require('@privy-io/expo/extended-chains') as PrivyExtendedChainsModule;
    return { base, ext };
  } catch {
    return null;
  }
}

const privy = loadPrivy();

export const isPrivyAvailable = privy !== null;

const notAvailable = (): never => {
  throw new Error('Privy is unavailable in this runtime (use a dev build, not Expo Go).');
};

// Stub hooks return shapes that match the real ones but no-op / report not-ready,
// so demo-mode renders without crashing.
const stubUsePrivy = (): UsePrivyResult => ({
  isReady: false,
  user: null,
  logout: async () => {},
});
const stubUseLoginWithEmail = (): UseLoginWithEmailResult => ({
  sendCode: notAvailable,
  loginWithCode: notAvailable,
});
const stubUseLoginWithOAuth = (): UseLoginWithOAuthResult => ({ login: notAvailable });
const stubUseCreateWallet = (): UseCreateWalletResult => ({ createWallet: notAvailable });
const stubUseSignRawHash = (): UseSignRawHashResult => ({
  signRawHash: async (): Promise<{ signature: Hex }> => notAvailable(),
});

export const usePrivy: () => UsePrivyResult = privy?.base.usePrivy ?? stubUsePrivy;
export const useLoginWithEmail: () => UseLoginWithEmailResult =
  privy?.base.useLoginWithEmail ?? stubUseLoginWithEmail;
export const useLoginWithOAuth: () => UseLoginWithOAuthResult =
  privy?.base.useLoginWithOAuth ?? stubUseLoginWithOAuth;
export const useCreateWallet: () => UseCreateWalletResult =
  privy?.ext.useCreateWallet ?? stubUseCreateWallet;
export const useSignRawHash: () => UseSignRawHashResult =
  privy?.ext.useSignRawHash ?? stubUseSignRawHash;
