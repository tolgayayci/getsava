import { useVault } from './useVault';

/**
 * Blend supply position for Home. Derived from the live vault state — Home shows
 * the "In your wallet" row always, and the vault row only when there's a position.
 */
export interface Position {
  readonly vaultName: string;
  readonly suppliedUsdc: number;
  /** Earned USDC, or null = N/A (not provable on-chain). */
  readonly yieldUsdc: number | null;
  readonly rate: number;
}

export function usePosition(): Position | null {
  const { vault } = useVault();
  if (!vault?.supplied) {
    return null;
  }
  return {
    vaultName: vault.name,
    suppliedUsdc: vault.suppliedUsdc,
    yieldUsdc: vault.yieldUsdc,
    rate: vault.apy,
  };
}
