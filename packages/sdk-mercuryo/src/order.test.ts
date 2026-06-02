import { describe, expect, it } from 'vitest';
import { callbackMerchantTxId, canTransition, isTerminal, orderStateFromCallback } from './order';

describe('order state machine', () => {
  it('allows the happy path pending→paid→settling→settled', () => {
    expect(canTransition('pending', 'paid')).toBe(true);
    expect(canTransition('paid', 'settling')).toBe(true);
    expect(canTransition('settling', 'settled')).toBe(true);
  });

  it('rejects illegal transitions', () => {
    expect(canTransition('pending', 'settled')).toBe(false);
    expect(canTransition('settled', 'paid')).toBe(false);
    expect(canTransition('failed', 'settled')).toBe(false);
  });

  it('marks terminal states', () => {
    expect(isTerminal('settled')).toBe(true);
    expect(isTerminal('failed')).toBe(true);
    expect(isTerminal('pending')).toBe(false);
  });
});

describe('orderStateFromCallback', () => {
  it('maps completed/paid → paid', () => {
    expect(orderStateFromCallback('completed')).toBe('paid');
    expect(orderStateFromCallback('PAID')).toBe('paid');
  });
  it('maps failed/cancelled → failed', () => {
    expect(orderStateFromCallback('failed')).toBe('failed');
    expect(orderStateFromCallback('cancelled')).toBe('failed');
  });
  it('returns null for non-terminal statuses', () => {
    expect(orderStateFromCallback('new')).toBeNull();
    expect(orderStateFromCallback('processing')).toBeNull();
  });
});

describe('callbackMerchantTxId', () => {
  it('reads snake_case and camelCase', () => {
    expect(callbackMerchantTxId({ merchant_transaction_id: 'a' })).toBe('a');
    expect(callbackMerchantTxId({ merchantTransactionId: 'b' })).toBe('b');
    expect(callbackMerchantTxId({})).toBeNull();
  });
});
