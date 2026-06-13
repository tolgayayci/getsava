import { Platform } from 'react-native';

/**
 * Lazy, crash-safe access to expo-notifications. The native module may be ABSENT
 * (e.g. a dev build that predates it, or web) — a static import would throw at
 * startup, so we defer evaluation behind a dynamic import wrapped in try/catch and
 * return null when it isn't available. Callers no-op gracefully. The foreground
 * notification handler is installed once, on first successful load.
 */

type NotificationsModule = typeof import('expo-notifications');

let handlerReady = false;

export async function loadNotifications(): Promise<NotificationsModule | null> {
  if (Platform.OS === 'web') {
    return null;
  }
  try {
    const N = await import('expo-notifications');
    if (!handlerReady) {
      handlerReady = true;
      N.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    }
    return N;
  } catch {
    return null;
  }
}
