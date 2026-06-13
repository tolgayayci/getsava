import { describe, expect, it } from 'vitest';
import { blendConfig } from './config';
import type { PoolHealthSample } from './health';
import {
  assertPoolWhitelisted,
  isPoolWhitelisted,
  POOL_WHITELIST,
  scorePoolAgainstWhitelist,
} from './whitelist';

const TESTNET_POOL = POOL_WHITELIST.testnet[0] as string;

const HEALTHY: PoolHealthSample = {
  backstopCoverageUsd: 147_260,
  poolTvlUsd: 65_915,
  totalSupplyUsdc: 65_915,
  bRateNow: 1_000_826_178_899n,
  oraclePriceUsd: 1.0,
  poolStatus: 0,
  supplyApy: 0.0051,
  q4wPercentage: 0.0001,
};

describe('pool whitelist', () => {
  it('the configured testnet pool is whitelisted and asserts cleanly', () => {
    expect(isPoolWhitelisted(TESTNET_POOL, 'testnet')).toBe(true);
    expect(() => assertPoolWhitelisted(TESTNET_POOL, 'testnet')).not.toThrow();
  });

  it('matches the live SDK-configured pool id (no drift between config and whitelist)', () => {
    expect(blendConfig('testnet').poolId).toBe(TESTNET_POOL);
  });

  it('rejects an unknown pool at startup', () => {
    expect(isPoolWhitelisted('CXXXNOTAPOOL', 'testnet')).toBe(false);
    expect(() => assertPoolWhitelisted('CXXXNOTAPOOL', 'testnet')).toThrow(
      /not on the testnet whitelist/,
    );
  });

  it('mainnet has the D6-selected launch pool (Fixed V2)', () => {
    expect(POOL_WHITELIST.mainnet).toEqual([
      'CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD',
    ]);
    expect(() =>
      assertPoolWhitelisted('CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD', 'mainnet'),
    ).not.toThrow();
    // the testnet pool is NOT valid on mainnet
    expect(() => assertPoolWhitelisted(TESTNET_POOL, 'mainnet')).toThrow();
  });
});

describe('scorePoolAgainstWhitelist (5 rules)', () => {
  it('a healthy whitelisted pool passes all five rules', () => {
    const score = scorePoolAgainstWhitelist(TESTNET_POOL, 'testnet', HEALTHY);
    expect(score.pass).toBe(true);
    expect(score.rules.map((r) => r.rule)).toEqual([
      'identity',
      'supply_only',
      'backstop_coverage',
      'pool_status',
      'oracle_peg',
    ]);
    expect(score.rules.every((r) => r.pass)).toBe(true);
  });

  it('fails identity for a non-whitelisted pool but still reports supply_only enforced', () => {
    const score = scorePoolAgainstWhitelist('CXXXNOTAPOOL', 'testnet', HEALTHY);
    expect(score.pass).toBe(false);
    expect(score.rules.find((r) => r.rule === 'identity')?.pass).toBe(false);
    expect(score.rules.find((r) => r.rule === 'supply_only')?.pass).toBe(true);
  });

  it('fails backstop_coverage when the ratio is low AND the backstop is small', () => {
    // 5% ratio with a small absolute backstop ($147k) → fails.
    const thin: PoolHealthSample = { ...HEALTHY, poolTvlUsd: HEALTHY.backstopCoverageUsd / 0.05 };
    const score = scorePoolAgainstWhitelist(TESTNET_POOL, 'testnet', thin);
    expect(score.pass).toBe(false);
    expect(score.rules.find((r) => r.rule === 'backstop_coverage')?.pass).toBe(false);
  });

  it('PASSES backstop_coverage at a low ratio when the backstop is large (≥ $1M) — FixedV2', () => {
    // 6.3% ratio but $3.39M absolute first-loss capital → size-aware pass.
    const big: PoolHealthSample = {
      ...HEALTHY,
      backstopCoverageUsd: 3_390_000,
      poolTvlUsd: 53_400_000,
    };
    const score = scorePoolAgainstWhitelist('CXXXNOTAPOOL', 'testnet', big);
    expect(score.rules.find((r) => r.rule === 'backstop_coverage')?.pass).toBe(true);
  });

  it('fails pool_status when the pool is frozen (≥ 4) and oracle_peg when off-peg', () => {
    const bad: PoolHealthSample = { ...HEALTHY, poolStatus: 4, oraclePriceUsd: 1.02 };
    const score = scorePoolAgainstWhitelist(TESTNET_POOL, 'testnet', bad);
    expect(score.rules.find((r) => r.rule === 'pool_status')?.pass).toBe(false);
    expect(score.rules.find((r) => r.rule === 'oracle_peg')?.pass).toBe(false);
  });
});
