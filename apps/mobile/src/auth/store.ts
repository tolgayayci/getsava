import type { Balances, ProvisioningState } from '@getsava/sdk-stellar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Wallet/session store. The Stellar address, balances, and readiness are
 * PERSISTED to AsyncStorage so a returning, already-provisioned user reloads
 * straight to Home — the "Setting up your account" screen is shown only the
 * first time, never again. Auth actions live in the hooks; this holds state.
 */
interface WalletState {
  address: string | null;
  email: string | null;
  balances: Balances;
  provisioning: ProvisioningState;
  /** True once the account is funded AND has the USDC trustline. */
  isReady: boolean;

  setAddress: (address: string | null) => void;
  setEmail: (email: string | null) => void;
  setBalances: (balances: Balances) => void;
  setProvisioning: (state: ProvisioningState) => void;
  reset: () => void;
}

const ZERO: Balances = { xlm: '0', usdc: '0' };

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      address: null,
      email: null,
      balances: ZERO,
      provisioning: 'pending',
      isReady: false,

      setAddress: (address) => set({ address }),
      setEmail: (email) => set({ email }),
      setBalances: (balances) => set({ balances }),
      setProvisioning: (provisioning) => set({ provisioning, isReady: provisioning === 'ready' }),
      reset: () =>
        set({
          address: null,
          email: null,
          balances: ZERO,
          provisioning: 'pending',
          isReady: false,
        }),
    }),
    {
      name: 'sava.wallet',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist only the durable facts. `provisioning` is derived from isReady on
      // load, so a ready user restores as ready (→ Home), never mid-setup.
      partialize: (s) => ({
        address: s.address,
        email: s.email,
        balances: s.balances,
        isReady: s.isReady,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<WalletState>;
        return {
          ...current,
          ...p,
          provisioning: p.isReady ? 'ready' : current.provisioning,
        };
      },
    },
  ),
);

/** True once the persisted wallet state has finished loading from AsyncStorage. */
export function useWalletHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useWalletStore.persist.hasHydrated());
  useEffect(() => {
    if (hydrated) {
      return;
    }
    const unsub = useWalletStore.persist.onFinishHydration(() => setHydrated(true));
    // Guard against a race where hydration finished between render and effect.
    if (useWalletStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    return unsub;
  }, [hydrated]);
  return hydrated;
}
