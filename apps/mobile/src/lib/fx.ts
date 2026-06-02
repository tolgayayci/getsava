/**
 * FX for display. A flat demo rate until the live TRY/USD feed lands in T2
 * (YK-515). Crypto amounts are the source of truth; ₺ figures are indicative.
 */
export const FX_TRY_PER_USDC = 34.2;

export function usdcToTry(usdc: number): number {
  return usdc * FX_TRY_PER_USDC;
}
