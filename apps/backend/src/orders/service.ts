import {
  buildWidgetUrl,
  callbackEventKey,
  callbackMerchantTxId,
  canTransition,
  isTerminal,
  type MercuryoCallback,
  type OrderState,
  orderStateFromCallback,
  verifyCallbackSignature,
} from '@getsava/sdk-mercuryo';
import {
  type findUsdcSettlement,
  type SettlementMatch,
  type sendUsdc,
  stellarExpertTxUrl,
} from '@getsava/sdk-stellar';
import type { Network } from '@getsava/types';
import type { OrderRecord, OrderStore } from './store';

/** Server-side Mercuryo + bridge configuration. All secrets stay here. */
export interface OrdersConfig {
  readonly network: Network;
  readonly mercuryo: {
    /** Sandbox/production widget id. */
    readonly widgetId: string;
    /** Widget Secret key — signs the URL. NEVER sent to the client. */
    readonly secret: string;
    /** Callback HMAC sign key. NEVER sent to the client. */
    readonly signKey: string;
  };
  /** TRY per 1 USD used for the MVP quote (static spread acceptable for D2). */
  readonly tryPerUsd: number;
  /**
   * TESTNET-ONLY treasury bridge. Mercuryo's sandbox can't settle USDC on
   * Stellar, so a Sava treasury account delivers the equivalent testnet USDC.
   * Disabled/removed for mainnet, where Mercuryo settles USDC-on-Stellar direct.
   */
  readonly bridge?: {
    readonly enabled: boolean;
    /** Treasury source secret (S...). SERVER-SIDE ONLY. */
    readonly treasurySecret: string;
  };
}

/** Injectable side-effects so the service is unit-testable without I/O. */
export interface OrdersDeps {
  readonly generateId: () => string;
  readonly now: () => number;
  readonly deliverUsdc: typeof sendUsdc;
  readonly findSettlement: typeof findUsdcSettlement;
  /** Audit log. The secret/signKey are NEVER passed in here. */
  readonly log: (event: string, data: Record<string, unknown>) => void;
}

export interface CreateDepositInput {
  readonly userAddress: string;
  readonly amountTry: string;
  /** The user's IP, captured by the backend from the request (used in signing). */
  readonly ip: string;
  readonly returnUrl?: string;
  readonly lang?: string;
}

export interface CreateDepositResult {
  readonly orderId: string;
  readonly widgetUrl: string;
  readonly expectedUsdc: string;
}

export interface WebhookResult {
  readonly status: 200 | 401;
  readonly state?: OrderState;
  readonly idempotent?: boolean;
  readonly matched?: boolean;
}

/** USDC a TRY amount buys at the configured rate (static MVP quote). */
export function quoteUsdc(amountTry: string, tryPerUsd: number): string {
  const try_ = Number.parseFloat(amountTry);
  if (!Number.isFinite(try_) || try_ <= 0 || tryPerUsd <= 0) {
    return '0.0000000';
  }
  return (try_ / tryPerUsd).toFixed(7);
}

/**
 * Orchestrates the lira-deposit lifecycle (YK-462/463/466) over an injected
 * OrderStore. Framework-agnostic: the Hono routes + Drizzle store (YK-487) wrap
 * this without changing the logic.
 */
export class OrdersService {
  constructor(
    private readonly store: OrderStore,
    private readonly config: OrdersConfig,
    private readonly deps: OrdersDeps,
  ) {
    if (config.network === 'mainnet' && config.bridge?.enabled) {
      // Hard guardrail: the treasury bridge is a testnet shim, never real money.
      throw new Error('Treasury bridge must never be enabled on mainnet');
    }
  }

  /** YK-462: create order (pending) + signed widget URL. */
  async createDeposit(input: CreateDepositInput): Promise<CreateDepositResult> {
    const orderId = this.deps.generateId();
    const expectedUsdc = quoteUsdc(input.amountTry, this.config.tryPerUsd);

    const built = buildWidgetUrl({
      network: this.config.network,
      widgetId: this.config.mercuryo.widgetId,
      secret: this.config.mercuryo.secret,
      address: input.userAddress,
      ip: input.ip,
      merchantTransactionId: orderId,
      fiatAmount: input.amountTry,
      ...(input.returnUrl !== undefined ? { returnUrl: input.returnUrl } : {}),
      ...(input.lang !== undefined ? { lang: input.lang } : {}),
    });

    const ts = this.deps.now();
    await this.store.create({
      id: orderId,
      userAddress: input.userAddress,
      amountTry: input.amountTry,
      expectedUsdc,
      state: 'pending',
      widgetUrl: built.url,
      createdAt: ts,
      updatedAt: ts,
    });

    // Audit (no secret/signKey, no signature query string).
    this.deps.log('order.created', {
      orderId,
      amountTry: input.amountTry,
      expectedUsdc,
      userAddress: input.userAddress,
    });

    return { orderId, widgetUrl: built.url, expectedUsdc };
  }

  async getOrder(id: string): Promise<OrderRecord | null> {
    return this.store.get(id);
  }

  /** Client-reported: the user opened the widget (pending → widget_opened). */
  async markWidgetOpened(id: string): Promise<OrderRecord | null> {
    const order = await this.store.get(id);
    if (order === null || !canTransition(order.state, 'widget_opened')) {
      return order;
    }
    return this.store.update(id, { state: 'widget_opened', updatedAt: this.deps.now() });
  }

  /** YK-463: verify + apply a Mercuryo callback. Idempotent on replays. */
  async applyWebhook(rawBody: string, signature: string): Promise<WebhookResult> {
    if (!verifyCallbackSignature(rawBody, signature, this.config.mercuryo.signKey)) {
      this.deps.log('webhook.invalid_signature', {});
      return { status: 401 };
    }

    let cb: MercuryoCallback;
    try {
      cb = JSON.parse(rawBody) as MercuryoCallback;
    } catch {
      this.deps.log('webhook.bad_json', {});
      return { status: 200, matched: false };
    }

    const eventKey = callbackEventKey(cb);
    const merchantTxId = callbackMerchantTxId(cb);
    if (eventKey === null || merchantTxId === null) {
      return { status: 200, matched: false };
    }

    // Idempotency: a replay of an already-processed event is a 200 no-op.
    if (await this.store.hasEvent(eventKey)) {
      this.deps.log('webhook.replay', { orderId: merchantTxId, eventKey });
      const existing = await this.store.get(merchantTxId);
      return {
        status: 200,
        idempotent: true,
        matched: existing !== null,
        ...(existing ? { state: existing.state } : {}),
      };
    }
    await this.store.recordEvent(eventKey);

    const order = await this.store.get(merchantTxId);
    if (order === null) {
      this.deps.log('webhook.unknown_order', { orderId: merchantTxId });
      return { status: 200, matched: false };
    }

    this.deps.log('webhook.received', {
      orderId: merchantTxId,
      status: cb.status ?? cb.type ?? null,
    });

    const target = orderStateFromCallback(cb.status ?? cb.type ?? '');
    // No actionable state, already terminal, or illegal transition → no-op (200).
    if (target === null || isTerminal(order.state) || !canTransition(order.state, target)) {
      return { status: 200, matched: true, state: order.state };
    }

    const updated = await this.store.update(merchantTxId, {
      state: target,
      updatedAt: this.deps.now(),
    });
    return { status: 200, matched: true, state: updated.state };
  }

  /**
   * YK-466: settlement sweep (cron). For each non-terminal order: on testnet,
   * once paid, deliver treasury USDC (the bridge); then confirm on Horizon and
   * flip to settled. Horizon is ground truth — chain-first arrivals settle too.
   */
  async sweepSettlements(): Promise<{ settled: number; bridged: number }> {
    const orders = await this.store.listSettleable();
    let settled = 0;
    let bridged = 0;

    for (const order of orders) {
      const withBridge = await this.maybeBridge(order);
      if (withBridge.didBridge) {
        bridged += 1;
      }
      if (await this.maybeSettle(withBridge.order)) {
        settled += 1;
      }
    }
    return { settled, bridged };
  }

  /** TESTNET: deliver treasury USDC for a paid order not yet bridged. */
  private async maybeBridge(
    order: OrderRecord,
  ): Promise<{ order: OrderRecord; didBridge: boolean }> {
    const bridge = this.config.bridge;
    if (
      bridge?.enabled !== true ||
      this.config.network === 'mainnet' ||
      order.state !== 'paid' ||
      order.bridgeTxHash !== undefined
    ) {
      return { order, didBridge: false };
    }
    try {
      const { hash } = await this.deps.deliverUsdc({
        network: this.config.network,
        sourceSecret: bridge.treasurySecret,
        destination: order.userAddress,
        amount: order.expectedUsdc,
        memo: order.id,
      });
      const updated = await this.store.update(order.id, {
        bridgeTxHash: hash,
        updatedAt: this.deps.now(),
      });
      this.deps.log('order.bridged', { orderId: order.id, bridgeTxHash: hash });
      return { order: updated, didBridge: true };
    } catch (err) {
      this.deps.log('order.bridge_failed', {
        orderId: order.id,
        error: err instanceof Error ? err.message : String(err),
      });
      return { order, didBridge: false };
    }
  }

  /** Detect the incoming USDC on Horizon and mark the order settled. */
  private async maybeSettle(order: OrderRecord): Promise<boolean> {
    if (isTerminal(order.state) || order.settledAt !== undefined) {
      return false;
    }
    let match: SettlementMatch | null;
    try {
      match = await this.deps.findSettlement(
        this.config.network,
        order.userAddress,
        order.expectedUsdc,
      );
    } catch (err) {
      this.deps.log('order.settle_check_failed', {
        orderId: order.id,
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
    if (match === null || !canTransition(order.state, 'settled')) {
      return false;
    }
    await this.store.update(order.id, {
      state: 'settled',
      stellarTxHash: match.transactionHash,
      settledAt: this.deps.now(),
      updatedAt: this.deps.now(),
    });
    this.deps.log('order.settled', {
      orderId: order.id,
      stellarTxHash: match.transactionHash,
      explorer: stellarExpertTxUrl(this.config.network, match.transactionHash),
    });
    return true;
  }
}
