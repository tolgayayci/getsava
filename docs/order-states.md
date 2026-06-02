# Deposit order state machine

The lira-deposit flow (T1.D2) tracks each order through a small, explicit state
machine. The canonical implementation lives in
[`@getsava/sdk-mercuryo` → `order.ts`](../packages/sdk-mercuryo/src/order.ts);
the orchestration lives in
[`apps/backend/src/orders/service.ts`](../apps/backend/src/orders/service.ts).

## States

| State           | Meaning                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| `pending`       | A signed Mercuryo widget URL was issued; the user has not paid yet.      |
| `widget_opened` | The user opened the widget (client-reported).                           |
| `paid`          | A verified Mercuryo callback says the fiat payment completed.            |
| `settled`       | Incoming USDC confirmed on Horizon for the user's address. **Terminal.** |
| `failed`        | Payment failed/cancelled, or settlement gave up. **Terminal.**          |

## Transitions

```
pending ──▶ widget_opened ──▶ paid ──▶ settled
   │              │             │
   ├──────────────┴─────────────┴──▶ failed
   │              │
   └──────────────┴──▶ settled        (chain-first: USDC arrives before "paid")
```

- Any non-terminal state can move to `failed`.
- `settled` is reachable from `pending`, `widget_opened`, or `paid` because
  **Horizon is the source of truth** — USDC can land before Mercuryo's callback.
- Terminal states never transition again. Late callbacks against a terminal
  order are accepted and ignored (no double-credit).

## Safety properties

- **Signature is the auth.** Webhooks are verified with
  `HMAC-SHA256(rawBody, signKey)`; a mismatch is `401`, never applied.
- **Idempotency.** Each callback is keyed by `(merchant_transaction_id,
  event_type)`. A replay returns `200` immediately and changes nothing.
- **Ground truth is on-chain.** `paid` reflects only what Mercuryo *claims*;
  `settled` requires a matching incoming USDC payment on Horizon.

## Testnet treasury bridge (removed at mainnet)

Mercuryo's sandbox cannot settle USDC on Stellar, so on **testnet** a Sava
treasury account delivers the equivalent testnet USDC once an order is `paid`
(`OrdersService.maybeBridge`). The settlement sweep then detects that payment on
Horizon exactly as it would a real one. On **mainnet** the bridge is disabled
(construction throws if it is enabled) and Mercuryo settles USDC-on-Stellar
directly.
