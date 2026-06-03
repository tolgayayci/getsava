import { USDC_DECIMALS } from './config';

/**
 * Convert a human USDC amount to an i128 stroop value (7 decimals). Rounds to the
 * nearest stroop and rejects non-positive / non-finite input. Keep amounts as
 * `bigint` end-to-end; only widen to `number` at the display boundary.
 */
export function toStroops(humanUsdc: number): bigint {
  if (!Number.isFinite(humanUsdc) || humanUsdc <= 0) {
    throw new Error('[sdk-blend] amount must be a positive, finite USDC value');
  }
  return BigInt(Math.round(humanUsdc * 10 ** USDC_DECIMALS));
}
