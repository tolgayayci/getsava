import * as Crypto from 'expo-crypto';
import { FX_TRY_PER_USDC } from '../lib/fx';

/**
 * Backend client seam.
 *
 * The client talks to this interface; a no-op/in-memory stub stands in until the
 * real Hono backend (T1.D6, YK-487/488) wires the SEP-10 session, the HMAC
 * widget-URL endpoint, the Mercuryo webhook, and the testnet treasury bridge.
 * Swapping the impl is the only change needed then.
 *
 * NOTE: the deposit lifecycle below is SIMULATED on-device for now (the treasury
 * bridge needs the treasury secret, which is server-side only). On D6 these calls
 * hit the deployed endpoints and a real Stellar settlement drives `getOrder`.
 */

export interface UpsertUserInput {
  readonly stellarAddress: string;
  readonly locale?: string;
}

export interface SessionToken {
  readonly token: string;
  readonly expiresAt: number;
}

/** Mirrors the @getsava/sdk-mercuryo order state machine (kept local — that SDK
 * pulls node:crypto and must not enter the client bundle). */
export type DepositState = 'pending' | 'widget_opened' | 'paid' | 'settled' | 'failed';

export interface CreateDepositInput {
  readonly amountTry: string;
}

export interface DepositOrder {
  readonly orderId: string;
  /** Signed Mercuryo widget URL (placeholder until D6 signs server-side). */
  readonly widgetUrl: string;
  readonly expectedUsdc: string;
}

export interface OrderStatus {
  readonly orderId: string;
  readonly state: DepositState;
  readonly amountTry: string;
  readonly expectedUsdc: string;
  readonly stellarTxHash?: string;
  readonly createdAt: number;
}

export interface BackendClient {
  /** Bind the authenticated Privy user to its Stellar pubkey; returns a session JWT. */
  upsertUser: (input: UpsertUserInput) => Promise<SessionToken | null>;
  /** Create a deposit order + signed widget URL (YK-462). */
  createDepositOrder: (input: CreateDepositInput) => Promise<DepositOrder>;
  /** Client reports the widget was opened (pending → widget_opened). */
  markWidgetOpened: (orderId: string) => Promise<void>;
  /** DEMO: stand in for Mercuryo's paid webhook (YK-463). Removed at D6. */
  simulatePayment: (orderId: string) => Promise<void>;
  /** Mark an order settled with the real Stellar tx hash (testnet deposit bridge). */
  settleOrder: (orderId: string, stellarTxHash: string) => Promise<void>;
  /** Mark an order failed (payment or settlement error). */
  failOrder: (orderId: string) => Promise<void>;
  /** Poll an order's current state (YK-466 settlement detection on D6). */
  getOrder: (orderId: string) => Promise<OrderStatus | null>;
}

function quoteUsdc(amountTry: string): string {
  const v = Number.parseFloat(amountTry);
  return Number.isFinite(v) && v > 0 ? (v / FX_TRY_PER_USDC).toFixed(7) : '0.0000000';
}

/** How long the simulated bridge+settlement takes after "payment". */
const SIMULATED_SETTLE_MS = 2600;

interface StoredOrder {
  amountTry: string;
  expectedUsdc: string;
  state: DepositState;
  createdAt: number;
  paidAt: number | null;
  stellarTxHash?: string;
}

const orders = new Map<string, StoredOrder>();

/**
 * Stub backend client. `upsertUser` no-ops (provisioning is client-side on
 * testnet); the deposit lifecycle is simulated in-memory so the UI flow is
 * exercisable end-to-end before the D6 backend + Mercuryo creds exist.
 */
export const stubBackendClient: BackendClient = {
  upsertUser: async ({ stellarAddress }) => {
    if (__DEV__) {
      console.log(`[Sava] (stub) backend.upsertUser(${stellarAddress}) — wired in T1.D6`);
    }
    return null;
  },

  createDepositOrder: async ({ amountTry }) => {
    const orderId = Crypto.randomUUID();
    const expectedUsdc = quoteUsdc(amountTry);
    orders.set(orderId, {
      amountTry,
      expectedUsdc,
      state: 'pending',
      createdAt: Date.now(),
      paidAt: null,
    });
    return {
      orderId,
      widgetUrl: `https://sandbox-exchange.mrcr.io/?merchant_transaction_id=${orderId}`,
      expectedUsdc,
    };
  },

  markWidgetOpened: async (orderId) => {
    const o = orders.get(orderId);
    if (o && o.state === 'pending') {
      o.state = 'widget_opened';
    }
  },

  simulatePayment: async (orderId) => {
    const o = orders.get(orderId);
    if (o && (o.state === 'pending' || o.state === 'widget_opened')) {
      o.state = 'paid';
      o.paidAt = Date.now();
    }
  },

  settleOrder: async (orderId, stellarTxHash) => {
    const o = orders.get(orderId);
    if (o) {
      o.state = 'settled';
      o.stellarTxHash = stellarTxHash;
    }
  },

  failOrder: async (orderId) => {
    const o = orders.get(orderId);
    if (o) {
      o.state = 'failed';
    }
  },

  getOrder: async (orderId) => {
    const o = orders.get(orderId);
    if (!o) {
      return null;
    }
    // Simulated settlement: a while after "payment", USDC "arrives".
    if (o.state === 'paid' && o.paidAt && Date.now() - o.paidAt > SIMULATED_SETTLE_MS) {
      o.state = 'settled';
      o.stellarTxHash = Crypto.randomUUID().replace(/-/g, '');
    }
    return {
      orderId,
      state: o.state,
      amountTry: o.amountTry,
      expectedUsdc: o.expectedUsdc,
      createdAt: o.createdAt,
      ...(o.stellarTxHash ? { stellarTxHash: o.stellarTxHash } : {}),
    };
  },
};
