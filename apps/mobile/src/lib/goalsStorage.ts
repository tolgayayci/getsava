import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { StateStorage } from 'zustand/middleware';

/**
 * Reinstall-durable storage for goals (T2.D3). AsyncStorage is the fast primary
 * but is wiped when the app is uninstalled; the iOS Keychain (expo-secure-store)
 * survives a reinstall. So we write both: a full copy to AsyncStorage and a
 * COMPACT copy (goals + progress, no contribution log) to secure-store, then
 * restore from secure-store when AsyncStorage comes up empty (a fresh install).
 *
 * Goals and their progress survive a reinstall; the per-goal contribution history
 * does not (kept out of the small secure-store value on purpose).
 */

const BACKUP_KEY = 'sava_goals_backup';

/** Drop contribs so the secure-store value stays well under its size limit. */
function compact(value: string): string {
  try {
    const parsed = JSON.parse(value) as { state?: { goals?: { contribs?: unknown }[] } };
    const goals = parsed.state?.goals;
    if (Array.isArray(goals)) {
      parsed.state!.goals = goals.map((g) => ({ ...g, contribs: [] }));
    }
    return JSON.stringify(parsed);
  } catch {
    return value;
  }
}

export const goalsStorage: StateStorage = {
  getItem: async (key) => {
    const primary = await AsyncStorage.getItem(key);
    if (primary != null) {
      return primary;
    }
    // Fresh install: AsyncStorage was wiped — restore goals from the durable backup.
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
