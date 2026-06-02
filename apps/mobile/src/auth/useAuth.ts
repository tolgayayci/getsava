import Constants from 'expo-constants';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { type OAuthProvider, useLoginWithEmail, useLoginWithOAuth } from './privy-hooks';

/**
 * Sign-in logic for the email-OTP / Google / Apple flows (YK-457, S3). The
 * screens are owned by Claude Design; this hook is the engine they call so the
 * UI is pure presentation.
 */

/** Apple Sign In needs native entitlements — unavailable in Expo Go. */
const isExpoGo = Constants.executionEnvironment === 'storeClient';

/** App Store Guideline 4.8 requires Apple when Google is offered (iOS only). */
export const isAppleSignInAvailable = Platform.OS === 'ios' && !isExpoGo;

export type AuthStep = 'idle' | 'sending-code' | 'awaiting-code' | 'verifying' | 'oauth';

export interface UseAuthResult {
  step: AuthStep;
  error: string | null;
  isAppleSignInAvailable: boolean;
  sendEmailCode: (email: string) => Promise<boolean>;
  verifyEmailCode: (code: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  resetError: () => void;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'errors.generic';
}

export function useAuth(): UseAuthResult {
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { login } = useLoginWithOAuth();
  const [step, setStep] = useState<AuthStep>('idle');
  const [error, setError] = useState<string | null>(null);

  const sendEmailCode = useCallback(
    async (email: string): Promise<boolean> => {
      setError(null);
      setStep('sending-code');
      try {
        await sendCode({ email: email.trim() });
        setStep('awaiting-code');
        return true;
      } catch (err) {
        console.warn('[Sava] Privy sendCode failed:', err);
        setError(toMessage(err));
        setStep('idle');
        return false;
      }
    },
    [sendCode],
  );

  const verifyEmailCode = useCallback(
    async (code: string): Promise<void> => {
      setError(null);
      setStep('verifying');
      try {
        await loginWithCode({ code: code.trim() });
        // On success Privy flips usePrivy().user; navigation reacts to that.
      } catch (err) {
        setError(toMessage(err));
        setStep('awaiting-code');
      }
    },
    [loginWithCode],
  );

  const oauth = useCallback(
    async (provider: OAuthProvider): Promise<void> => {
      setError(null);
      setStep('oauth');
      try {
        await login({ provider });
      } catch (err) {
        setError(toMessage(err));
        setStep('idle');
      }
    },
    [login],
  );

  const loginWithGoogle = useCallback(() => oauth('google'), [oauth]);
  const loginWithApple = useCallback(() => oauth('apple'), [oauth]);

  return {
    step,
    error,
    isAppleSignInAvailable,
    sendEmailCode,
    verifyEmailCode,
    loginWithGoogle,
    loginWithApple,
    resetError: useCallback(() => setError(null), []),
  };
}
