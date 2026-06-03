/**
 * Blend supply position (T1.D3). There's no supply flow yet, so there's no
 * vault position to show — Home renders the "In your wallet" row but hides the
 * vault row until this returns a real position.
 */
export interface Position {
  readonly vaultName: string;
  readonly suppliedUsdc: number;
  readonly yieldUsdc: number;
  readonly rate: number;
}

export function usePosition(): Position | null {
  return null;
}
