import { describe, expect, it } from 'vitest';
import { evaluateCircuitBreaker } from './circuit';
import { type PoolHealthSample, toCircuitInputs } from './health';

const SAMPLE: PoolHealthSample = {
  backstopCoverageUsd: 147_260,
  poolTvlUsd: 65_915,
  totalSupplyUsdc: 65_915,
  bRateNow: 1_000_826_178_899n,
  oraclePriceUsd: 1.0,
  poolStatus: 0,
  supplyApy: 0.0051,
  q4wPercentage: 0.0001,
};

describe('toCircuitInputs', () => {
  it('threads bRate5minAgo and defaults the reference price to the 1.0 peg', () => {
    const inputs = toCircuitInputs(SAMPLE, { bRate5minAgo: 1_000_000_000_000n });
    expect(inputs.bRate5minAgo).toBe(1_000_000_000_000n);
    expect(inputs.referencePriceUsd).toBe(1.0);
    expect(inputs.backstopCoverageUsd).toBe(SAMPLE.backstopCoverageUsd);
    expect(inputs.poolTvlUsd).toBe(SAMPLE.poolTvlUsd);
    expect(inputs.poolStatus).toBe(0);
  });

  it('passes a supplied secondary reference price through unchanged', () => {
    const inputs = toCircuitInputs(SAMPLE, { bRate5minAgo: null, referencePriceUsd: 0.997 });
    expect(inputs.referencePriceUsd).toBe(0.997);
    expect(inputs.bRate5minAgo).toBeNull();
  });

  it('a healthy live sample (223% coverage, on-peg, status 0) does not trip', () => {
    const state = evaluateCircuitBreaker(
      toCircuitInputs(SAMPLE, { bRate5minAgo: SAMPLE.bRateNow }),
    );
    expect(state.tripped).toBe(false);
    expect(state.backstopCoverageRatio).toBeGreaterThan(2);
  });

  it('trips backstop_coverage once TVL grows past the 8% backstop ratio', () => {
    const thin: PoolHealthSample = { ...SAMPLE, poolTvlUsd: SAMPLE.backstopCoverageUsd / 0.05 };
    const state = evaluateCircuitBreaker(toCircuitInputs(thin, { bRate5minAgo: thin.bRateNow }));
    expect(state.tripped).toBe(true);
    expect(state.reasons).toContain('backstop_coverage');
  });
});
