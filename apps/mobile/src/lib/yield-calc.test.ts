import { describe, expect, it } from 'vitest';
import { deriveYieldUsdc } from './yield-calc';

// The pool bRate from the live read that exposed the bug (1.000893…).
const BRATE = 1_000_893_088_023n;

describe('deriveYieldUsdc', () => {
  it('is N/A (null) when the on-chain read failed', () => {
    expect(deriveYieldUsdc(60, BRATE, 35, false)).toBeNull();
  });

  it('is 0 when there is no position', () => {
    expect(deriveYieldUsdc(0, BRATE, 0, true)).toBe(0);
  });

  it('is N/A when there is a position but no recorded cost basis', () => {
    expect(deriveYieldUsdc(60, BRATE, 0, true)).toBeNull();
  });

  it('THE BUG: 60 supplied with 35 tracked principal → N/A, never 25', () => {
    // 25 USDC "yield" is physically impossible: bRate is only 1.000893, so the
    // most 60 USDC could have earned is ~0.05 USDC.
    expect(deriveYieldUsdc(60.0058561, BRATE, 35, true)).toBeNull();
  });

  it('shows real yield when it is within the on-chain ceiling', () => {
    // ceiling for 60 USDC ≈ 60 × (1 − 1/1.000893) ≈ 0.0535
    const y = deriveYieldUsdc(60.04, BRATE, 60, true);
    expect(y).not.toBeNull();
    expect(y as number).toBeCloseTo(0.04, 4);
  });

  it('is 0 when the position is at or below the recorded basis', () => {
    expect(deriveYieldUsdc(60, BRATE, 60, true)).toBe(0);
    expect(deriveYieldUsdc(60, BRATE, 70, true)).toBe(0);
  });

  it('caps trust at the ceiling — just over is N/A, just under is shown', () => {
    const supplied = 100;
    const bRateFloat = Number(BRATE) / 1e12;
    const ceiling = supplied * (1 - 1 / bRateFloat); // ≈ 0.0892
    const principalJustUnder = supplied - (ceiling - 0.001);
    const principalJustOver = supplied - (ceiling + 0.01);
    expect(deriveYieldUsdc(supplied, BRATE, principalJustUnder, true)).not.toBeNull();
    expect(deriveYieldUsdc(supplied, BRATE, principalJustOver, true)).toBeNull();
  });
});
