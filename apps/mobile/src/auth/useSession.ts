import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { usePrivy } from './privy-hooks';
import { useWalletStore } from './store';

/**
 * Session lifecycle (YK-459, S5): re-lock after idle with a biometric gate,
 * a persisted biometric toggle, and a clean sign-out. Privy persists the auth
 * session itself; this layer guards re-entry and tears everything down.
 */

const BIOMETRIC_PREF_KEY = 'sava.biometric.enabled';
/** Lock after this much background time. */
const IDLE_LOCK_MS = 60_000;

export type LockState = 'unlocked' | 'locked';

export interface UseSessionResult {
  locked: boolean;
  biometricEnabled: boolean;
  biometricSupported: boolean;
  unlock: () => Promise<boolean>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  signOut: () => Promise<void>;
}

export function useSession(): UseSessionResult {
  const { user, logout } = usePrivy();
  const resetWallet = useWalletStore((s) => s.reset);

  const [lock, setLock] = useState<LockState>('unlocked');
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  // Detect hardware support + load the persisted preference (default ON if able).
  useEffect(() => {
    let active = true;
    (async () => {
      const [hasHardware, enrolled, saved] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        AsyncStorage.getItem(BIOMETRIC_PREF_KEY),
      ]);
      if (!active) {
        return;
      }
      const supported = hasHardware && enrolled;
      setBiometricSupported(supported);
      setBiometricEnabledState(saved === null ? supported : saved === 'true');
    })().catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Lock on resume if the app was backgrounded past the idle threshold.
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        backgroundedAt.current = Date.now();
      } else if (next === 'active' && backgroundedAt.current !== null) {
        const idle = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (biometricEnabled && user && idle >= IDLE_LOCK_MS) {
          setLock('locked');
        }
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [biometricEnabled, user]);

  const unlock = useCallback(async (): Promise<boolean> => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Sava',
      disableDeviceFallback: false,
    });
    if (result.success) {
      setLock('unlocked');
    }
    return result.success;
  }, []);

  const setBiometricEnabled = useCallback(async (enabled: boolean): Promise<void> => {
    setBiometricEnabledState(enabled);
    await AsyncStorage.setItem(BIOMETRIC_PREF_KEY, String(enabled));
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await logout();
    } finally {
      resetWallet();
      setLock('unlocked');
      backgroundedAt.current = null;
    }
  }, [logout, resetWallet]);

  return {
    locked: lock === 'locked',
    biometricEnabled,
    biometricSupported,
    unlock,
    setBiometricEnabled,
    signOut,
  };
}
