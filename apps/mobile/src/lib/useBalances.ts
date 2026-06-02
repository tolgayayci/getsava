import { type Balances, getBalances } from '@getsava/sdk-stellar';
import { useCallback, useEffect, useState } from 'react';
import { useWalletStore } from '../auth';
import { NETWORK } from './network';

interface UseBalances {
  balances: Balances;
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
}

/**
 * Read the wallet's XLM + USDC balances from Horizon and cache them in the
 * persisted wallet store. Fetches on mount and exposes a manual `refresh`
 * (pull-to-refresh on Home). Backend-independent — reads chain state directly.
 */
export function useBalances(): UseBalances {
  const address = useWalletStore((s) => s.address);
  const balances = useWalletStore((s) => s.balances);
  const setBalances = useWalletStore((s) => s.setBalances);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    if (!address) {
      return;
    }
    setLoading(true);
    setError(false);
    try {
      setBalances(await getBalances(NETWORK, address));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [address, setBalances]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { balances, loading, error, refresh };
}
