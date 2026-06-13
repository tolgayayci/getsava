/**
 * Honest USDC yield, or null (= N/A) when it can't be PROVEN from on-chain data.
 *
 * Blend stores only bTokens, not a cost basis, so the app tracks principal
 * off-chain (netPrincipalUsdc). That record can drift from the chain (a reinstall
 * wipes it; supplies made outside the app aren't seen), which would otherwise make
 * `position − principal` report principal as "yield". So we never assume profit:
 * we only show yield when it is physically possible.
 *
 * A position's value is `bTokens × bRate`, and bRate is monotonic up from par
 * (1.0) at pool inception. So the MOST a position can have earned is
 * `supplied × (1 − par/bRate_now)` — the gain if every bToken were bought at par.
 * If our recorded basis implies more yield than that ceiling (stale/incomplete
 * basis), or we have no basis, or the on-chain read failed, we return null → the
 * UI shows N/A rather than a fabricated number.
 */

/** bRate is fixed-point scaled 1e12 and starts at par (1.0). */
const BRATE_SCALE = 1e12;
const DUST = 1e-7;
const EPS = 1e-6;

export function deriveYieldUsdc(
  suppliedUsdc: number,
  bRate: bigint,
  netPrincipalUsdc: number,
  fresh: boolean,
): number | null {
  if (!fresh) {
    return null; // couldn't read the chain this cycle → N/A, never a stale guess
  }
  if (suppliedUsdc <= DUST) {
    return 0; // no position → nothing earned
  }
  if (netPrincipalUsdc <= 0) {
    return null; // no recorded cost basis → can't determine yield → N/A
  }
  const costBasisYield = suppliedUsdc - netPrincipalUsdc;
  if (costBasisYield <= DUST) {
    return 0; // at/under basis → nothing earned yet (or rounding)
  }
  const bRateFloat = Number(bRate) / BRATE_SCALE;
  const maxOnChainYield = bRateFloat > 1 ? suppliedUsdc * (1 - 1 / bRateFloat) : 0;
  if (costBasisYield > maxOnChainYield + EPS) {
    return null; // claims more yield than the chain allows → basis is stale → N/A
  }
  return costBasisYield;
}
