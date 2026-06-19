import { describe, expect, it } from 'vitest';
import { type CircuitInputs, evaluateCircuitBreaker } from './circuit';

// A healthy baseline: 12% backstop coverage, flat bRate, on-peg oracle, status 0.
const HEALTHY: CircuitInputs = {
  backstopCoverageUsd: 1200,
  poolTvlUsd: 10_000,
  bRateNow: 1_000_768_010_169n,
  bRate5minAgo: 1_000_768_000_000n,
  oraclePriceUsd: 1.0,
  referencePriceUsd: 1.0,
  poolStatus: 0,
};

describe('evaluateCircuitBreaker', () => {
  it('does not trip when every signal is healthy', () => {
    const s = evaluateCircuitBreaker(HEALTHY);
    expect(s.tripped).toBe(false);
    expect(s.reasons).toEqual([]);
  });

  it('trips on backstop coverage below 8% when the backstop is also small', () => {
    const s = evaluateCircuitBreaker({ ...HEALTHY, backstopCoverageUsd: 700 }); // 7%, $700 abs
    expect(s.tripped).toBe(true);
    expect(s.reasons).toContain('backstop_coverage');
    expect(s.backstopCoverageRatio).toBeCloseTo(0.07, 5);
  });

  it('does NOT trip a low ratio when the backstop is large in absolute terms (≥ $1M)', () => {
    // FixedV2-style: 6.3% ratio but $3.39M first-loss capital → not halted.
    const s = evaluateCircuitBreaker({
      ...HEALTHY,
      backstopCoverageUsd: 3_390_000,
      poolTvlUsd: 53_400_000,
    });
    expect(s.backstopCoverageRatio).toBeCloseTo(0.0635, 3);
    expect(s.reasons).not.toContain('backstop_coverage');
    expect(s.tripped).toBe(false);
  });

  it('trips on bRate drift beyond ±2% over 5 minutes', () => {
    const s = evaluateCircuitBreaker({
      ...HEALTHY,
      bRate5minAgo: 1_000_000_000_000n,
      bRateNow: 1_030_000_000_000n, // +3%
    });
    expect(s.tripped).toBe(true);
    expect(s.reasons).toContain('brate_drift');
    expect(s.bRateDriftPct).toBeCloseTo(0.03, 5);
  });

  it('does not flag drift when there is no prior sample', () => {
    const s = evaluateCircuitBreaker({ ...HEALTHY, bRate5minAgo: null });
    expect(s.bRateDriftPct).toBeNull();
    expect(s.reasons).not.toContain('brate_drift');
  });

  it('trips on oracle divergence beyond ±0.5%', () => {
    const s = evaluateCircuitBreaker({ ...HEALTHY, oraclePriceUsd: 1.01 }); // +1%
    expect(s.tripped).toBe(true);
    expect(s.reasons).toContain('oracle_divergence');
  });

  it('trips when pool status is frozen (≥ 4)', () => {
    const s = evaluateCircuitBreaker({ ...HEALTHY, poolStatus: 4 });
    expect(s.tripped).toBe(true);
    expect(s.reasons).toContain('pool_status');
  });

  it('accumulates multiple reasons at once', () => {
    const s = evaluateCircuitBreaker({
      ...HEALTHY,
      backstopCoverageUsd: 500,
      oraclePriceUsd: 1.02,
      poolStatus: 5,
    });
    expect(s.reasons).toEqual(
      expect.arrayContaining(['backstop_coverage', 'oracle_divergence', 'pool_status']),
    );
  });
});
