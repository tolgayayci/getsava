import { describe, expect, it } from 'vitest';
import {
  callbackEventKey,
  callbackMerchantTxId,
  canTransition,
  isTerminal,
  orderStateFromCallback,
} from './order';

describe('order state machine', () => {
  it('allows the happy path pending→widget_opened→paid→settled', () => {
    expect(canTransition('pending', 'widget_opened')).toBe(true);
    expect(canTransition('widget_opened', 'paid')).toBe(true);
    expect(canTransition('paid', 'settled')).toBe(true);
  });

  it('allows chain-first settlement (USDC before the paid callback)', () => {
    expect(canTransition('pending', 'settled')).toBe(true);
    expect(canTransition('widget_opened', 'settled')).toBe(true);
  });

  it('rejects illegal transitions', () => {
    expect(canTransition('settled', 'paid')).toBe(false);
    expect(canTransition('failed', 'settled')).toBe(false);
    expect(canTransition('paid', 'widget_opened')).toBe(false);
  });

  it('marks terminal states', () => {
    expect(isTerminal('settled')).toBe(true);
    expect(isTerminal('failed')).toBe(true);
    expect(isTerminal('pending')).toBe(false);
    expect(isTerminal('widget_opened')).toBe(false);
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

describe('callbackEventKey', () => {
  it('combines id and event type for idempotency', () => {
    expect(callbackEventKey({ merchant_transaction_id: 'a', type: 'completed' })).toBe(
      'a:completed',
    );
    expect(callbackEventKey({ merchant_transaction_id: 'a', status: 'PAID' })).toBe('a:paid');
  });
  it('returns null without a merchant_transaction_id', () => {
    expect(callbackEventKey({ type: 'completed' })).toBeNull();
  });
});
