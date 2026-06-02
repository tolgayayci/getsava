/**
 * Order state machine for a lira deposit (T1.D2). Mirrors Mercuryo's lifecycle
 * plus our own Stellar-settlement step:
 *
 *   pending  → user got a signed widget URL, hasn't paid
 *   paid     → Mercuryo callback says the fiat payment completed
 *   settling → USDC delivery to the user's Stellar wallet in progress
 *   settled  → USDC confirmed on Horizon for the user's address (terminal)
 *   failed   → payment failed/cancelled or settlement gave up (terminal)
 */
export type OrderState = 'pending' | 'paid' | 'settling' | 'settled' | 'failed';

/** Allowed transitions; anything else is rejected (no silent regressions). */
const TRANSITIONS: Record<OrderState, readonly OrderState[]> = {
  pending: ['paid', 'failed'],
  paid: ['settling', 'failed'],
  settling: ['settled', 'failed'],
  settled: [],
  failed: [],
};

export function canTransition(from: OrderState, to: OrderState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isTerminal(state: OrderState): boolean {
  return state === 'settled' || state === 'failed';
}

/** Map a Mercuryo callback `status` to our order state (paid/failed only). */
export function orderStateFromCallback(status: string): 'paid' | 'failed' | null {
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'paid' || s === 'succeeded') {
    return 'paid';
  }
  if (s === 'failed' || s === 'cancelled' || s === 'canceled' || s === 'declined') {
    return 'failed';
  }
  // 'new'/'pending'/'processing' etc. → no state change yet.
  return null;
}

export interface MercuryoCallback {
  readonly type?: string;
  readonly status?: string;
  readonly merchant_transaction_id?: string;
  readonly merchantTransactionId?: string;
  readonly currency?: string;
  readonly amount?: string;
  readonly fiat_currency?: string;
  readonly fiat_amount?: string;
  readonly tx_id?: string;
}

/** Pull the merchant_transaction_id from a callback (handles both casings). */
export function callbackMerchantTxId(cb: MercuryoCallback): string | null {
  return cb.merchant_transaction_id ?? cb.merchantTransactionId ?? null;
}
