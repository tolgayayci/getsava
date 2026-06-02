import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type OrdersConfig, type OrdersDeps, OrdersService, quoteUsdc } from './service';
import { InMemoryOrderStore } from './store';

const SIGN_KEY = 'callback_sign_key';
const USER = 'GUSERADDRESSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function sign(body: string): string {
  return createHmac('sha256', SIGN_KEY).update(body).digest('hex');
}

function testnetConfig(over: Partial<OrdersConfig> = {}): OrdersConfig {
  return {
    network: 'testnet',
    mercuryo: { widgetId: 'wid_1', secret: 'widget_secret', signKey: SIGN_KEY },
    tryPerUsd: 40,
    bridge: { enabled: true, treasurySecret: 'STREASURY' },
    ...over,
  };
}

/** Mainnet config — no bridge (Mercuryo settles USDC-on-Stellar directly). */
function mainnetConfig(): OrdersConfig {
  return {
    network: 'mainnet',
    mercuryo: { widgetId: 'wid_1', secret: 'widget_secret', signKey: SIGN_KEY },
    tryPerUsd: 40,
  };
}

function makeDeps(over: Partial<OrdersDeps> = {}): OrdersDeps {
  let n = 0;
  return {
    generateId: () => `order_${++n}`,
    now: () => 1_000 + n,
    deliverUsdc: vi.fn(async () => ({ hash: 'bridge_hash' })),
    findSettlement: vi.fn(async () => null),
    log: vi.fn(),
    ...over,
  };
}

describe('quoteUsdc', () => {
  it('divides TRY by the rate to 7 dp', () => {
    expect(quoteUsdc('500', 40)).toBe('12.5000000');
  });
  it('guards against zero/invalid input', () => {
    expect(quoteUsdc('0', 40)).toBe('0.0000000');
    expect(quoteUsdc('abc', 40)).toBe('0.0000000');
    expect(quoteUsdc('500', 0)).toBe('0.0000000');
  });
});

describe('OrdersService.createDeposit', () => {
  it('persists a pending order and returns a signed widget URL', async () => {
    const store = new InMemoryOrderStore();
    const svc = new OrdersService(store, testnetConfig(), makeDeps());

    const res = await svc.createDeposit({
      userAddress: USER,
      amountTry: '500',
      ip: '1.2.3.4',
      returnUrl: 'sava://order/x',
    });

    expect(res.orderId).toBe('order_1');
    expect(res.expectedUsdc).toBe('12.5000000');
    const u = new URL(res.widgetUrl);
    expect(u.searchParams.get('signature')).toMatch(/^v2:[0-9a-f]{128}$/);
    expect(u.searchParams.get('merchant_transaction_id')).toBe('order_1');
    expect(u.searchParams.get('address')).toBe(USER);

    const order = await store.get('order_1');
    expect(order?.state).toBe('pending');
    expect(order?.expectedUsdc).toBe('12.5000000');
  });

  it('never leaks the widget secret or sign key into the URL', async () => {
    const store = new InMemoryOrderStore();
    const svc = new OrdersService(store, testnetConfig(), makeDeps());
    const res = await svc.createDeposit({ userAddress: USER, amountTry: '500', ip: '1.2.3.4' });
    expect(res.widgetUrl).not.toContain('widget_secret');
    expect(res.widgetUrl).not.toContain(SIGN_KEY);
  });
});

describe('OrdersService.applyWebhook', () => {
  let store: InMemoryOrderStore;
  let svc: OrdersService;

  beforeEach(async () => {
    store = new InMemoryOrderStore();
    svc = new OrdersService(store, testnetConfig(), makeDeps());
    await svc.createDeposit({ userAddress: USER, amountTry: '500', ip: '1.2.3.4' });
  });

  it('rejects an invalid signature with 401', async () => {
    const body = JSON.stringify({ merchant_transaction_id: 'order_1', status: 'completed' });
    const res = await svc.applyWebhook(body, 'v2:wrong');
    expect(res.status).toBe(401);
  });

  it('advances pending → paid on a completed callback', async () => {
    const body = JSON.stringify({
      type: 'completed',
      merchant_transaction_id: 'order_1',
      status: 'completed',
    });
    const res = await svc.applyWebhook(body, sign(body));
    expect(res).toMatchObject({ status: 200, matched: true, state: 'paid' });
    expect((await store.get('order_1'))?.state).toBe('paid');
  });

  it('is idempotent: a replayed event does not transition twice', async () => {
    const body = JSON.stringify({
      type: 'completed',
      merchant_transaction_id: 'order_1',
      status: 'completed',
    });
    await svc.applyWebhook(body, sign(body));
    const replay = await svc.applyWebhook(body, sign(body));
    expect(replay.idempotent).toBe(true);
    expect(replay.state).toBe('paid');
  });

  it('200 no-ops an unknown order', async () => {
    const body = JSON.stringify({ merchant_transaction_id: 'nope', status: 'completed' });
    const res = await svc.applyWebhook(body, sign(body));
    expect(res).toMatchObject({ status: 200, matched: false });
  });

  it('marks a failed callback as failed (terminal)', async () => {
    const body = JSON.stringify({
      type: 'failed',
      merchant_transaction_id: 'order_1',
      status: 'failed',
    });
    const res = await svc.applyWebhook(body, sign(body));
    expect(res.state).toBe('failed');
  });
});

describe('OrdersService.sweepSettlements (testnet bridge)', () => {
  it('bridges a paid order then settles it from Horizon', async () => {
    const store = new InMemoryOrderStore();
    const deliverUsdc = vi.fn(async () => ({ hash: 'bridge_tx' }));
    // First sweep: no settlement yet; second sweep: USDC has arrived.
    const findSettlement = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ transactionHash: 'settle_tx', amount: '12.5000000' });
    const svc = new OrdersService(
      store,
      testnetConfig(),
      makeDeps({ deliverUsdc, findSettlement }),
    );

    await svc.createDeposit({ userAddress: USER, amountTry: '500', ip: '1.2.3.4' });
    const body = JSON.stringify({
      type: 'completed',
      merchant_transaction_id: 'order_1',
      status: 'completed',
    });
    await svc.applyWebhook(body, sign(body));

    const first = await svc.sweepSettlements();
    expect(first.bridged).toBe(1);
    expect(deliverUsdc).toHaveBeenCalledOnce();
    expect((await store.get('order_1'))?.bridgeTxHash).toBe('bridge_tx');
    expect((await store.get('order_1'))?.state).toBe('paid');

    const second = await svc.sweepSettlements();
    expect(second.settled).toBe(1);
    expect(deliverUsdc).toHaveBeenCalledOnce(); // not bridged again
    const settled = await store.get('order_1');
    expect(settled?.state).toBe('settled');
    expect(settled?.stellarTxHash).toBe('settle_tx');
    expect(settled?.settledAt).toBeDefined();
  });

  it('does not bridge before the order is paid', async () => {
    const store = new InMemoryOrderStore();
    const deliverUsdc = vi.fn(async () => ({ hash: 'x' }));
    const svc = new OrdersService(store, testnetConfig(), makeDeps({ deliverUsdc }));
    await svc.createDeposit({ userAddress: USER, amountTry: '500', ip: '1.2.3.4' });

    const res = await svc.sweepSettlements();
    expect(res.bridged).toBe(0);
    expect(deliverUsdc).not.toHaveBeenCalled();
  });
});

describe('OrdersService chain-first + guardrails', () => {
  it('settles a chain-first arrival on mainnet without a paid callback', async () => {
    const store = new InMemoryOrderStore();
    const findSettlement = vi.fn(async () => ({
      transactionHash: 'mainnet_tx',
      amount: '12.5000000',
    }));
    const svc = new OrdersService(store, mainnetConfig(), makeDeps({ findSettlement }));
    await svc.createDeposit({ userAddress: USER, amountTry: '500', ip: '1.2.3.4' });

    const res = await svc.sweepSettlements();
    expect(res.settled).toBe(1);
    expect((await store.get('order_1'))?.state).toBe('settled');
  });

  it('refuses to construct with the bridge enabled on mainnet', () => {
    expect(
      () =>
        new OrdersService(
          new InMemoryOrderStore(),
          testnetConfig({ network: 'mainnet' }),
          makeDeps(),
        ),
    ).toThrow(/never be enabled on mainnet/);
  });
});
