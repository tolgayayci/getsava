import { describe, expect, it } from 'vitest';
import { PgOrderStore, type SqlExecutor } from './pg-store';
import type { OrderRecord } from './store';

interface Call {
  readonly text: string;
  readonly values: unknown[];
}

/** Records each tagged-template call and replays canned row responses in order. */
function fakeSql(responses: unknown[][] = []): { sql: SqlExecutor; calls: Call[] } {
  const calls: Call[] = [];
  let i = 0;
  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join(' ? ').replace(/\s+/g, ' ').trim().toLowerCase(), values });
    return responses[i++] ?? [];
  }) as SqlExecutor;
  return { sql, calls };
}

const ORDER: OrderRecord = {
  id: 'order-1',
  userAddress: 'GCLIENT',
  amountTry: '500',
  expectedUsdc: '12.5000000',
  state: 'pending',
  widgetUrl: 'https://example/widget',
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
};

describe('PgOrderStore', () => {
  it('binds values as parameters on insert (no string interpolation)', async () => {
    const { sql, calls } = fakeSql();
    await new PgOrderStore(sql).create(ORDER);
    expect(calls[0]?.text).toContain('insert into orders');
    // The id/address travel as bound params, never embedded in the SQL text.
    expect(calls[0]?.values).toContain('order-1');
    expect(calls[0]?.values).toContain('GCLIENT');
    expect(calls[0]?.text).not.toContain('order-1');
  });

  it('maps a row → record (bigint strings → numbers, nulls → omitted)', async () => {
    const { sql } = fakeSql([
      [
        {
          id: 'order-1',
          user_address: 'GCLIENT',
          amount_try: '500',
          expected_usdc: '12.5000000',
          state: 'paid',
          widget_url: 'https://example/widget',
          created_at: '1700000000000',
          updated_at: '1700000000500',
          bridge_tx_hash: null,
          stellar_tx_hash: null,
          settled_at: null,
        },
      ],
    ]);
    const got = await new PgOrderStore(sql).get('order-1');
    expect(got).not.toBeNull();
    expect(got?.createdAt).toBe(1_700_000_000_000);
    expect(got?.updatedAt).toBe(1_700_000_000_500);
    expect(got?.state).toBe('paid');
    expect('bridgeTxHash' in (got ?? {})).toBe(false);
    expect('settledAt' in (got ?? {})).toBe(false);
  });

  it('dedups events via ON CONFLICT DO NOTHING', async () => {
    const { sql, calls } = fakeSql([
      [], // hasEvent → not seen
      [], // recordEvent
      [{ one: 1 }], // hasEvent → seen
    ]);
    const store = new PgOrderStore(sql);
    expect(await store.hasEvent('order-1:completed')).toBe(false);
    await store.recordEvent('order-1:completed');
    expect(await store.hasEvent('order-1:completed')).toBe(true);

    const insert = calls.find((c) => c.text.includes('insert into webhook_events'));
    expect(insert?.text).toContain('on conflict (event_key) do nothing');
    expect(insert?.values).toContain('order-1:completed');
  });
});
