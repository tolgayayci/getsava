import type { CircuitState } from '@getsava/sdk-blend';
import { describe, expect, it } from 'vitest';
import { applyOverride, parseForcedReasons } from './override';

const HEALTHY: CircuitState = {
  tripped: false,
  reasons: [],
  backstopCoverageRatio: 2.2,
  bRateDriftPct: 0,
  oracleDivergencePct: 0,
};

describe('parseForcedReasons', () => {
  it('returns [] for unset / empty / none', () => {
    expect(parseForcedReasons(undefined)).toEqual([]);
    expect(parseForcedReasons('')).toEqual([]);
    expect(parseForcedReasons('none')).toEqual([]);
    expect(parseForcedReasons('NONE')).toEqual([]);
  });

  it('parses a single reason', () => {
    expect(parseForcedReasons('backstop_coverage')).toEqual(['backstop_coverage']);
  });

  it('parses a comma list and ignores unknown tokens + dupes', () => {
    expect(parseForcedReasons('oracle_divergence, bogus ,brate_drift,oracle_divergence')).toEqual([
      'oracle_divergence',
      'brate_drift',
    ]);
  });
});

describe('applyOverride', () => {
  it('is a no-op with no forced reasons', () => {
    const { state, forced } = applyOverride(HEALTHY, []);
    expect(forced).toBe(false);
    expect(state.tripped).toBe(false);
  });

  it('forces a trip and merges reasons (dedup) when overridden', () => {
    const { state, forced } = applyOverride(
      { ...HEALTHY, tripped: true, reasons: ['pool_status'] },
      ['pool_status', 'oracle_divergence'],
    );
    expect(forced).toBe(true);
    expect(state.tripped).toBe(true);
    expect(state.reasons).toEqual(['pool_status', 'oracle_divergence']);
  });
});
