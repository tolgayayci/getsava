import type { OrderState } from '@getsava/sdk-mercuryo';
import type { OrderPatch, OrderRecord, OrderStore } from './store';

/**
 * Postgres-backed {@link OrderStore} (Neon via Hyperdrive in production).
 *
 * The `webhook_events` table — `event_key` as PRIMARY KEY plus
 * `ON CONFLICT DO NOTHING` — is the durable idempotency anchor: a replayed
 * Mercuryo callback can never apply twice, even across concurrent Workers.
 * See schema.sql for the DDL.
 */

/**
 * The slice of `@neondatabase/serverless`'s tagged-template client we use.
 * Values interpolated as `${value}` are bound as query parameters (never string
 * concatenated), so this is injection-safe. Kept as a structural type so the
 * store is unit-testable with a fake and carries no driver dependency itself.
 */
export type SqlExecutor = <T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<T[]>;

interface OrderRow {
  readonly id: string;
  readonly user_address: string;
  readonly amount_try: string;
  readonly expected_usdc: string;
  readonly state: string;
  readonly widget_url: string;
  readonly created_at: string | number;
  readonly updated_at: string | number;
  readonly bridge_tx_hash: string | null;
  readonly stellar_tx_hash: string | null;
  readonly settled_at: string | number | null;
}

/** Map a DB row → domain record. Postgres returns bigint columns as strings. */
function toRecord(row: OrderRow): OrderRecord {
  return {
    id: row.id,
    userAddress: row.user_address,
    amountTry: row.amount_try,
    expectedUsdc: row.expected_usdc,
    state: row.state as OrderState,
    widgetUrl: row.widget_url,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    ...(row.bridge_tx_hash !== null ? { bridgeTxHash: row.bridge_tx_hash } : {}),
    ...(row.stellar_tx_hash !== null ? { stellarTxHash: row.stellar_tx_hash } : {}),
    ...(row.settled_at !== null ? { settledAt: Number(row.settled_at) } : {}),
  };
}

export class PgOrderStore implements OrderStore {
  constructor(private readonly sql: SqlExecutor) {}

  async create(record: OrderRecord): Promise<void> {
    await this.sql`
      insert into orders
        (id, user_address, amount_try, expected_usdc, state, widget_url, created_at, updated_at)
      values
        (${record.id}, ${record.userAddress}, ${record.amountTry}, ${record.expectedUsdc},
         ${record.state}, ${record.widgetUrl}, ${record.createdAt}, ${record.updatedAt})
    `;
  }

  async get(id: string): Promise<OrderRecord | null> {
    const rows = await this.sql<OrderRow>`select * from orders where id = ${id} limit 1`;
    const row = rows[0];
    return row ? toRecord(row) : null;
  }

  async update(id: string, patch: OrderPatch): Promise<OrderRecord> {
    const current = await this.get(id);
    if (current === null) {
      throw new Error(`Order ${id} not found`);
    }
    const next: OrderRecord = { ...current, ...patch };
    await this.sql`
      update orders set
        state = ${next.state},
        bridge_tx_hash = ${next.bridgeTxHash ?? null},
        stellar_tx_hash = ${next.stellarTxHash ?? null},
        settled_at = ${next.settledAt ?? null},
        updated_at = ${next.updatedAt}
      where id = ${id}
    `;
    return next;
  }

  async listSettleable(): Promise<readonly OrderRecord[]> {
    const rows = await this.sql<OrderRow>`
      select * from orders
      where settled_at is null and state not in ('settled', 'failed')
    `;
    return rows.map(toRecord);
  }

  async hasEvent(eventKey: string): Promise<boolean> {
    const rows = await this.sql`
      select 1 as one from webhook_events where event_key = ${eventKey} limit 1
    `;
    return rows.length > 0;
  }

  async recordEvent(eventKey: string): Promise<void> {
    // PRIMARY KEY + DO NOTHING ⇒ concurrent replays of the same event are no-ops.
    await this.sql`
      insert into webhook_events (event_key, received_at)
      values (${eventKey}, ${Date.now()})
      on conflict (event_key) do nothing
    `;
  }
}
