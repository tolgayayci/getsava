import type { OrderState } from '@getsava/sdk-mercuryo';

/**
 * A deposit order. `id` is the Mercuryo `merchant_transaction_id` (UUID) — the
 * idempotency anchor for the whole flow.
 */
export interface OrderRecord {
  readonly id: string;
  readonly userAddress: string;
  readonly amountTry: string;
  /** USDC the user should receive, from the quote at creation time. */
  readonly expectedUsdc: string;
  readonly state: OrderState;
  readonly widgetUrl: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  /** TESTNET bridge delivery tx (treasury → user). Absent on mainnet. */
  readonly bridgeTxHash?: string;
  /** Settlement tx hash from Horizon (ground truth). Set when settled. */
  readonly stellarTxHash?: string;
  readonly settledAt?: number;
}

export type OrderPatch = Partial<
  Pick<OrderRecord, 'state' | 'bridgeTxHash' | 'stellarTxHash' | 'settledAt' | 'updatedAt'>
>;

/**
 * Persistence seam. The in-memory implementation below is the D2 stub; YK-487
 * swaps in a Drizzle/Neon implementation of this exact interface — the service
 * layer never changes.
 */
export interface OrderStore {
  create(record: OrderRecord): Promise<void>;
  get(id: string): Promise<OrderRecord | null>;
  update(id: string, patch: OrderPatch): Promise<OrderRecord>;
  /** Non-terminal orders awaiting settlement (settledAt unset). */
  listSettleable(): Promise<readonly OrderRecord[]>;
  /** Idempotency: has this (merchant_transaction_id, event_type) been seen? */
  hasEvent(eventKey: string): Promise<boolean>;
  recordEvent(eventKey: string): Promise<void>;
}

/** In-memory OrderStore — the D2 stub. Not for production (no durability). */
export class InMemoryOrderStore implements OrderStore {
  private readonly orders = new Map<string, OrderRecord>();
  private readonly events = new Set<string>();

  async create(record: OrderRecord): Promise<void> {
    if (this.orders.has(record.id)) {
      throw new Error(`Order ${record.id} already exists`);
    }
    this.orders.set(record.id, record);
  }

  async get(id: string): Promise<OrderRecord | null> {
    return this.orders.get(id) ?? null;
  }

  async update(id: string, patch: OrderPatch): Promise<OrderRecord> {
    const current = this.orders.get(id);
    if (current === undefined) {
      throw new Error(`Order ${id} not found`);
    }
    const next: OrderRecord = { ...current, ...patch };
    this.orders.set(id, next);
    return next;
  }

  async listSettleable(): Promise<readonly OrderRecord[]> {
    const out: OrderRecord[] = [];
    for (const o of this.orders.values()) {
      if (o.settledAt === undefined && o.state !== 'settled' && o.state !== 'failed') {
        out.push(o);
      }
    }
    return out;
  }

  async hasEvent(eventKey: string): Promise<boolean> {
    return this.events.has(eventKey);
  }

  async recordEvent(eventKey: string): Promise<void> {
    this.events.add(eventKey);
  }
}
