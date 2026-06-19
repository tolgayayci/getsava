import type { PoolV2 } from '@blend-capital/blend-sdk';

/**
 * Read the pool oracle's USDC price in USD — the circuit breaker's oracle-divergence
 * input. Blend's `loadOracle()` resolves the pool's configured price oracle and the
 * latest price for each reserve asset; we read the USDC reserve's price as a float.
 */
export async function readOraclePrice(pool: PoolV2, usdcSac: string): Promise<number> {
  const oracle = await pool.loadOracle();
  const price = oracle.getPriceFloat(usdcSac);
  if (price === undefined || !Number.isFinite(price) || price <= 0) {
    throw new Error(`[sdk-blend] oracle returned no usable USDC price for ${usdcSac}`);
  }
  return price;
}
