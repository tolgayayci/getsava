/**
 * FX for display + the deposit quote. A flat TCMB-rate placeholder until the
 * live TCMB TRY/USD feed lands in T2 (YK-515). Crypto amounts are the source of
 * truth; ₺ figures are indicative.
 */
export const FX_TRY_PER_USDC = 41;

export function usdcToTry(usdc: number): number {
  return usdc * FX_TRY_PER_USDC;
}
