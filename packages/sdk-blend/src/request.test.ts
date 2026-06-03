import { I128MAX, RequestType } from '@blend-capital/blend-sdk';
import { describe, expect, it } from 'vitest';
import { blendConfig } from './config';
import { supplyRequest, withdrawRequest } from './request';

const cfg = blendConfig('testnet');

describe('supplyRequest', () => {
  it('builds a SupplyCollateral request with 7-decimal scaled amount', () => {
    const r = supplyRequest(cfg, 12.5);
    expect(r.request_type).toBe(RequestType.SupplyCollateral);
    expect(r.address).toBe(cfg.usdcSac);
    expect(r.amount).toBe(125_000_000n); // 12.5 × 1e7
  });

  it('rejects non-positive / non-finite amounts', () => {
    expect(() => supplyRequest(cfg, 0)).toThrow();
    expect(() => supplyRequest(cfg, -1)).toThrow();
    expect(() => supplyRequest(cfg, Number.NaN)).toThrow();
  });
});

describe('withdrawRequest', () => {
  it('partial withdrawal scales like supply', () => {
    const r = withdrawRequest(cfg, { kind: 'partial', humanUsdc: 5 });
    expect(r.request_type).toBe(RequestType.WithdrawCollateral);
    expect(r.amount).toBe(50_000_000n);
  });

  it('full withdrawal uses I128MAX (clamped to position on-chain)', () => {
    const r = withdrawRequest(cfg, { kind: 'all' });
    expect(r.amount).toBe(I128MAX);
    expect(r.amount).toBe(170_141_183_460_469_231_731_687_303_715_884_105_727n);
  });
});
