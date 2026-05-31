import { ensureUsdcTrustline, findStellarAddress, getBalances } from '@getsava/sdk-stellar';
import type { Network } from '@getsava/types';
import { useCallback, useEffect, useRef } from 'react';
import type { BackendClient } from '../backend/client';
import { useCreateWallet, usePrivy, useSignRawHash } from './privy-hooks';
import { useWalletStore } from './store';

const NETWORK: Network = (process.env.EXPO_PUBLIC_STELLAR_NETWORK as Network) ?? 'testnet';

export interface UseProvisioningResult {
  /** Re-run provisioning after a failure (the "tap to retry" path). */
  retry: () => Promise<void>;
}

/**
 * Wallet provisioning (YK-458, S4, safety-critical). After login it ensures the
 * user has: an embedded Stellar wallet → a funded account → a USDC trustline,
 * driving the store's provisioning state machine. The trustline MUST exist
 * before any deposit or Mercuryo's USDC settlement bounces.
 *
 * Backend user-row upsert + JWT (also part of YK-458) goes through the injected
 * `backend` client — a stub until T1.D6 lands, so this is a clean seam.
 */
export function useProvisioning(backend: BackendClient): UseProvisioningResult {
  const { user, isReady: privyReady } = usePrivy();
  const { createWallet } = useCreateWallet();
  const { signRawHash } = useSignRawHash();
  const setAddress = useWalletStore((s) => s.setAddress);
  const setBalances = useWalletStore((s) => s.setBalances);
  const setProvisioning = useWalletStore((s) => s.setProvisioning);
  const inFlight = useRef(false);

  const run = useCallback(async () => {
    if (!user || inFlight.current) {
      return;
    }
    inFlight.current = true;
    try {
      // 1. Find or create the embedded Stellar wallet.
      let address = findStellarAddress(user);
      if (!address) {
        const { wallet } = await createWallet({ chainType: 'stellar' });
        address = wallet.address;
      }
      setAddress(address);

      // 2. Backend: bind the pubkey to the session (no-op stub until D6).
      await backend.upsertUser({ stellarAddress: address });

      // 3. Fund + USDC trustline, driving the state machine.
      const { balances } = await ensureUsdcTrustline(NETWORK, address, signRawHash, {
        onState: setProvisioning,
      });
      setBalances(balances);
    } catch {
      setProvisioning('failed');
    } finally {
      inFlight.current = false;
    }
  }, [user, createWallet, signRawHash, setAddress, setBalances, setProvisioning, backend]);

  useEffect(() => {
    if (privyReady && user) {
      void run();
    }
  }, [privyReady, user, run]);

  const retry = useCallback(async () => {
    setProvisioning('pending');
    const address = useWalletStore.getState().address;
    if (address) {
      try {
        const { balances } = await ensureUsdcTrustline(NETWORK, address, signRawHash, {
          onState: setProvisioning,
        });
        setBalances(balances);
        return;
      } catch {
        setProvisioning('failed');
        return;
      }
    }
    await run();
  }, [run, signRawHash, setBalances, setProvisioning]);

  // Keep balances fresh once ready (cheap Horizon read; screens can also pull).
  useEffect(() => {
    const address = useWalletStore.getState().address;
    if (useWalletStore.getState().isReady && address) {
      void getBalances(NETWORK, address).then(setBalances);
    }
  }, [setBalances]);

  return { retry };
}
