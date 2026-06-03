import { RequestType } from '@blend-capital/blend-sdk';
import { describe, expect, it } from 'vitest';
import { ALLOWED_REQUEST_TYPES, assertSafeRequestType } from './guardrail';

describe('assertSafeRequestType (supply-only invariant)', () => {
  it('allows SupplyCollateral and WithdrawCollateral', () => {
    expect(() => assertSafeRequestType(RequestType.SupplyCollateral)).not.toThrow();
    expect(() => assertSafeRequestType(RequestType.WithdrawCollateral)).not.toThrow();
  });

  it('rejects every other request type', () => {
    const forbidden = [
      RequestType.Supply,
      RequestType.Withdraw,
      RequestType.Borrow,
      RequestType.Repay,
      RequestType.FillUserLiquidationAuction,
      RequestType.FillBadDebtAuction,
      RequestType.FillInterestAuction,
      RequestType.DeleteLiquidationAuction,
    ];
    for (const rt of forbidden) {
      expect(() => assertSafeRequestType(rt)).toThrow(/supply-only/);
    }
  });

  it('allow-list is exactly [SupplyCollateral=2, WithdrawCollateral=3]', () => {
    expect([...ALLOWED_REQUEST_TYPES]).toEqual([
      RequestType.SupplyCollateral,
      RequestType.WithdrawCollateral,
    ]);
    expect([...ALLOWED_REQUEST_TYPES]).toEqual([2, 3]);
  });
});
