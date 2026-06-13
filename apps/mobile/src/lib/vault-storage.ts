import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { StateStorage } from 'zustand/middleware';

/**
 * Reinstall-durable storage for the vault cost basis (`netPrincipalUsdc`). The
 * chain stores only bTokens, so this off-chain basis is what lets us prove yield;
 * if it were wiped on reinstall, yield would (correctly) fall back to N/A. So we
 * write the full state to AsyncStorage AND a COMPACT copy (just the basis) to the
 * iOS Keychain (expo-secure-store), and restore from the Keychain on a fresh
 * install. The activity log + rate history are intentionally not backed up.
 */

const BACKUP_KEY = 'sava_vault_backup';

/** Keep only the cost basis in the durable backup (small + the value that matters). */
function compact(value: string): string {
  try {
    const parsed = JSON.parse(value) as {
      version?: number;
      state?: { netPrincipalUsdc?: number };
    };
    return JSON.stringify({
      ...(parsed.version !== undefined ? { version: parsed.version } : {}),
      state: {
        netPrincipalUsdc: parsed.state?.netPrincipalUsdc ?? 0,
        activity: [],
        rateHistory: [],
      },
    });
  } catch {
    return value;
  }
}

export const vaultStorage: StateStorage = {
  getItem: async (key) => {
    const primary = await AsyncStorage.getItem(key);
    if (primary != null) {
      return primary;
    }
    try {
      const backup = await SecureStore.getItemAsync(BACKUP_KEY);
      if (backup != null) {
        await AsyncStorage.setItem(key, backup);
      }
      return backup ?? null;
    } catch {
      return null;
    }
  },
  setItem: async (key, value) => {
    await AsyncStorage.setItem(key, value);
    try {
      await SecureStore.setItemAsync(BACKUP_KEY, compact(value));
    } catch {
      // secure-store unavailable (e.g. web) — AsyncStorage still holds the data.
    }
  },
  removeItem: async (key) => {
    await AsyncStorage.removeItem(key);
    try {
      await SecureStore.deleteItemAsync(BACKUP_KEY);
    } catch {
      // ignore
    }
  },
};
