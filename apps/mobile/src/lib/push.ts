import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { loadNotifications } from './notifications';

/**
 * Expo push registration for circuit-trip alerts (T2.D1). Requests permission,
 * gets the device's Expo push token, and registers it with the backend so a trip
 * push can target real devices. Fully defensive: a no-op on web / in Expo Go /
 * when permission is denied / when the projectId is missing / when the
 * expo-notifications native module is absent — never throws.
 *
 * Device verification (a real OS banner on a trip) requires a TestFlight/Play
 * build + physical device; this wires the token pipeline end to end.
 */

const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? 'https://api.getsava.app').replace(/\/+$/, '');

function projectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId
  );
}

/** Register this device for circuit-trip push. Returns the token, or null if unavailable. */
export async function registerForCircuitPush(): Promise<string | null> {
  try {
    const N = await loadNotifications();
    if (!N) {
      return null;
    }
    const existing = await N.getPermissionsAsync();
    const status =
      existing.status === 'granted' ? 'granted' : (await N.requestPermissionsAsync()).status;
    if (status !== 'granted') {
      return null;
    }

    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('default', {
        name: 'Sava alerts',
        importance: N.AndroidImportance.HIGH,
      });
    }

    const id = projectId();
    if (!id) {
      return null;
    }
    const { data: token } = await N.getExpoPushTokenAsync({ projectId: id });
    if (!token) {
      return null;
    }
    await fetch(`${API_BASE}/circuit/push-tokens`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return token;
  } catch {
    return null;
  }
}
