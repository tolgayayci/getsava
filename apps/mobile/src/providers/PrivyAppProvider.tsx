import { PrivyProvider } from '@privy-io/expo';
import type { ReactNode } from 'react';

/**
 * Privy provider, mounted at the app root (YK-456).
 *
 * `@privy-io/expo` requires native modules that only exist in a dev build — it
 * does NOT run in Expo Go. There is intentionally no demo/fallback path: in Expo
 * Go the app fails to load (use a dev build). The App ID is public
 * (EXPO_PUBLIC_*); the App SECRET is server-side only and never reaches the
 * client bundle. `clientId` is an optional Privy "app client" id.
 */

const APP_ID = process.env.EXPO_PUBLIC_PRIVY_APP_ID ?? '';
const CLIENT_ID = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ?? '';

export function PrivyAppProvider({ children }: { children: ReactNode }) {
  if (APP_ID === '') {
    throw new Error(
      'EXPO_PUBLIC_PRIVY_APP_ID is not set — configure it in apps/mobile/.env.local (Privy dashboard, YK-455).',
    );
  }
  const clientIdProp = CLIENT_ID !== '' ? { clientId: CLIENT_ID } : {};
  return (
    <PrivyProvider appId={APP_ID} {...clientIdProp}>
      {children}
    </PrivyProvider>
  );
}
