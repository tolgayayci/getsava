import {
  blendConfig,
  buildSupplyTx,
  buildWithdrawTx,
  loadPool,
  type ReserveSnapshot,
  readReserveSnapshot,
  readUserPosition,
  signAndSubmit,
  type UserPosition,
  type WithdrawMode,
} from '@getsava/sdk-blend';
import { useCallback, useEffect, useState } from 'react';
import { useWalletStore } from '../auth';
import { useSignRawHash } from '../auth/privy-hooks';
import { usdcToTry } from './fx';
import { NETWORK } from './network';
import { useVaultStore } from './vault-store';

/** View-model the Earn screens render. One USDC vault (the Blend pool) for now. */
export interface VaultView {
  readonly id: string;
  readonly name: string;
  readonly asset: 'USDC';
  /** Headline supply APY, percent (e.g. 0.38). */
  readonly apy: number;
  readonly apr: number;
  readonly tvlUsdc: number;
  /** 0..1 */
  readonly utilization: number;
  readonly status: number;
  /** status ≥ 4 → new supply blocked on-chain (withdraw still allowed). */
  readonly paused: boolean;
  readonly risk: 'low' | 'mid';
  readonly supplied: boolean;
  readonly suppliedUsdc: number;
  readonly yieldUsdc: number;
  readonly bTokens: bigint;
}

const VAULT_ID = 'usdc-core';
const VAULT_NAME = 'USDC Core';

function deriveVault(snap: ReserveSnapshot, pos: UserPosition, netPrincipal: number): VaultView {
  return {
    id: VAULT_ID,
    name: VAULT_NAME,
    asset: 'USDC',
    apy: snap.supplyApy * 100,
    apr: snap.supplyApr * 100,
    tvlUsdc: snap.totalSupply,
    utilization: snap.utilization,
    status: snap.status,
    paused: snap.status >= 4,
    risk: 'low',
    supplied: pos.suppliedUsdc > 0,
    suppliedUsdc: pos.suppliedUsdc,
    yieldUsdc: Math.max(0, pos.suppliedUsdc - netPrincipal),
    bTokens: pos.bTokens,
  };
}

const EMPTY_POSITION: UserPosition = { bTokens: 0n, suppliedUsdc: 0 };

export interface UseVault {
  vault: VaultView | null;
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
  /** Supply USDC to the pool; resolves to the on-chain tx hash. */
  supply: (usdc: number) => Promise<string>;
  /** Withdraw (partial or full); resolves to the on-chain tx hash. */
  withdraw: (mode: WithdrawMode, usdc: number) => Promise<string>;
}

/**
 * Live Blend vault state + supply/withdraw actions. Reads pool/reserve/position
 * via @getsava/sdk-blend and signs writes with Privy raw-hash signing. All Blend
 * access is supply-only and goes through the SDK guardrail.
 */
export function useVault(): UseVault {
  const address = useWalletStore((s) => s.address);
  const { signRawHash } = useSignRawHash();
  const netPrincipal = useVaultStore((s) => s.netPrincipalUsdc);
  const addSupply = useVaultStore((s) => s.addSupply);
  const addWithdraw = useVaultStore((s) => s.addWithdraw);

  const [snap, setSnap] = useState<ReserveSnapshot | null>(null);
  const [pos, setPos] = useState<UserPosition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    if (!address) {
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const cfg = blendConfig(NETWORK);
      const pool = await loadPool(cfg);
      setSnap(readReserveSnapshot(pool, cfg.usdcSac));
      setPos(await readUserPosition(pool, address, cfg.usdcSac));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const supply = useCallback(
    async (usdc: number): Promise<string> => {
      if (!address) {
        throw new Error('No wallet address');
      }
      const cfg = blendConfig(NETWORK);
      const { preparedXdr } = await buildSupplyTx(cfg, address, usdc);
      const { hash, status } = await signAndSubmit(NETWORK, preparedXdr, address, signRawHash);
      if (status !== 'SUCCESS') {
        throw new Error('Supply did not confirm on-chain');
      }
      addSupply(usdc, usdcToTry(usdc), hash, Date.now());
      await refresh();
      return hash;
    },
    [address, signRawHash, addSupply, refresh],
  );

  const withdraw = useCallback(
    async (mode: WithdrawMode, usdc: number): Promise<string> => {
      if (!address) {
        throw new Error('No wallet address');
      }
      const cfg = blendConfig(NETWORK);
      const { preparedXdr } = await buildWithdrawTx(cfg, address, mode);
      const { hash, status } = await signAndSubmit(NETWORK, preparedXdr, address, signRawHash);
      if (status !== 'SUCCESS') {
        throw new Error('Withdraw did not confirm on-chain');
      }
      addWithdraw(usdc, usdcToTry(usdc), hash, Date.now(), mode.kind === 'all');
      await refresh();
      return hash;
    },
    [address, signRawHash, addWithdraw, refresh],
  );

  const vault = snap ? deriveVault(snap, pos ?? EMPTY_POSITION, netPrincipal) : null;

  return { vault, loading, error, refresh, supply, withdraw };
}
