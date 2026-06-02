import { afterEach, describe, expect, it, vi } from 'vitest';
import { findUsdcSettlement, stellarExpertTxUrl } from './settlement';

const ADDR = 'GUSER';
const ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

function payment(over: Record<string, unknown>) {
  return {
    type: 'payment',
    transaction_hash: 'hash_default',
    to: ADDR,
    asset_code: 'USDC',
    asset_issuer: ISSUER,
    amount: '500.0000000',
    ...over,
  };
}

function mockPayments(records: unknown[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ _embedded: { records } }),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('findUsdcSettlement', () => {
  it('matches an incoming USDC payment at or above the minimum', async () => {
    mockPayments([payment({ transaction_hash: 'h1' })]);
    const match = await findUsdcSettlement('testnet', ADDR, '500');
    expect(match).toEqual({ transactionHash: 'h1', amount: '500.0000000' });
  });

  it('tolerates floating-point dust below the minimum (1e-7)', async () => {
    mockPayments([payment({ amount: '499.9999999' })]);
    const match = await findUsdcSettlement('testnet', ADDR, '500');
    expect(match).not.toBeNull();
  });

  it('ignores wrong asset, wrong direction, and amounts under the minimum', async () => {
    mockPayments([
      payment({ asset_issuer: 'GWRONGISSUER', transaction_hash: 'wrong-asset' }),
      payment({ to: 'GSOMEONEELSE', transaction_hash: 'wrong-dest' }),
      payment({ amount: '100.0000000', transaction_hash: 'too-small' }),
      payment({ type: 'create_account', transaction_hash: 'wrong-type' }),
    ]);
    expect(await findUsdcSettlement('testnet', ADDR, '500')).toBeNull();
  });

  it('returns null when Horizon errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );
    expect(await findUsdcSettlement('testnet', ADDR, '500')).toBeNull();
  });
});

describe('stellarExpertTxUrl', () => {
  it('uses testnet/public network segments', () => {
    expect(stellarExpertTxUrl('testnet', 'abc')).toBe(
      'https://stellar.expert/explorer/testnet/tx/abc',
    );
    expect(stellarExpertTxUrl('mainnet', 'abc')).toBe(
      'https://stellar.expert/explorer/public/tx/abc',
    );
  });
});
