import type { Balances, ProvisioningState } from '@getsava/sdk-stellar';
import { create } from 'zustand';

/**
 * Wallet/session store. The Stellar address, balances, and provisioning state
 * live here so screens (when Claude Design delivers them) read a single source
 * of truth. Auth actions live in the hooks; this holds derived state.
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

export const useWalletStore = create<WalletState>((set) => ({
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
    set({ address: null, email: null, balances: ZERO, provisioning: 'pending', isReady: false }),
}));
