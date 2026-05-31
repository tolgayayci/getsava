import type { ComponentType, ReactNode } from 'react';

/**
 * Privy provider wiring (YK-456).
 *
 * `@privy-io/expo` ships native modules that are ABSENT in Expo Go, where
 * `require('@privy-io/expo')` throws. We therefore lazy-load it: in Expo Go the
 * app boots in "demo mode" (no auth) so non-auth JS can be iterated; in a dev
 * build (expo-dev-client) the native modules are present and Privy runs for
 * real. Credentials come from EXPO_PUBLIC_* and are configured in the Privy
 * dashboard (human task YK-455).
 *
 * The App ID is public; the App SECRET is server-side only (backend) and must
 * never reach this bundle. `clientId` is an optional Privy "app client" id —
 * passed through when set, omitted otherwise.
 *
 * Embedded Stellar wallet provisioning (useCreateWallet, chainType:'stellar')
 * is a later story (YK-458) — this one only installs + mounts the provider.
 */

interface PrivyProviderProps {
  appId: string;
  clientId?: string;
  children: ReactNode;
}

/** The subset of Privy's client we depend on here (kept minimal on purpose). */
export interface PrivyClient {
  readonly isReady: boolean;
  readonly user: unknown;
}

interface PrivyModule {
  PrivyProvider: ComponentType<PrivyProviderProps>;
  usePrivy: () => PrivyClient;
}

function loadPrivy(): PrivyModule | null {
  try {
    // Native modules are missing in Expo Go → this throws there. A dev build
    // bundles them, so Privy loads and runs for real.
    return require('@privy-io/expo') as PrivyModule;
  } catch {
    return null;
  }
}

const privyModule = loadPrivy();
const APP_ID = process.env.EXPO_PUBLIC_PRIVY_APP_ID ?? '';
const CLIENT_ID = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ?? '';

/** True when the native module is present AND the App ID is configured. */
export const isPrivyConfigured = privyModule !== null && APP_ID !== '';

/**
 * `usePrivy`, or a no-op fallback returning a not-ready client. Only call it
 * from a component rendered when `isPrivyConfigured` is true (i.e. inside the
 * mounted PrivyProvider). The fallback exists so the hook reference is always
 * defined and never needs a non-null assertion.
 */
export const usePrivyClient: () => PrivyClient =
  privyModule?.usePrivy ?? (() => ({ isReady: false, user: null }));

export function PrivyAppProvider({ children }: { children: ReactNode }) {
  if (privyModule !== null && APP_ID !== '') {
    const { PrivyProvider } = privyModule;
    const clientIdProp = CLIENT_ID !== '' ? { clientId: CLIENT_ID } : {};
    return (
      <PrivyProvider appId={APP_ID} {...clientIdProp}>
        {children}
      </PrivyProvider>
    );
  }

  if (privyModule !== null) {
    console.warn(
      '[Sava] Privy module present but EXPO_PUBLIC_PRIVY_APP_ID is missing — auth disabled. Set it in apps/mobile/.env.local (Privy dashboard task YK-455).',
    );
  } else {
    console.warn(
      '[Sava] Privy native modules unavailable (Expo Go) — running without auth. Use a dev build (expo-dev-client) for real Privy.',
    );
  }
  return <>{children}</>;
}
