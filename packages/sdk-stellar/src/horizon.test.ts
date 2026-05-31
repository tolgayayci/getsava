import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchAccount,
  fundWithFriendbot,
  getBalances,
  HorizonError,
  hasUsdcTrustline,
  readBalances,
  submitTransaction,
} from './horizon';

const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

const accountWithTrustline = {
  sequence: '42',
  balances: [
    { asset_type: 'native', balance: '9999.5000000' },
    {
      asset_type: 'credit_alphanum4',
      asset_code: 'USDC',
      asset_issuer: USDC_ISSUER,
      balance: '100.0000000',
    },
  ],
};

describe('fetchAccount', () => {
  it('returns the account on 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(200, accountWithTrustline)),
    );
    const account = await fetchAccount('testnet', 'GADDR');
    expect(account?.sequence).toBe('42');
  });

  it('returns null on 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(404, {})),
    );
    expect(await fetchAccount('testnet', 'GADDR')).toBeNull();
  });

  it('throws HorizonError on 500', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(500, {})),
    );
    await expect(fetchAccount('testnet', 'GADDR')).rejects.toBeInstanceOf(HorizonError);
  });
});

describe('balances + trustline', () => {
  it('reads XLM and USDC balances', () => {
    expect(readBalances(accountWithTrustline, 'testnet')).toEqual({
      xlm: '9999.5000000',
      usdc: '100.0000000',
    });
  });

  it('detects the USDC trustline', () => {
    expect(hasUsdcTrustline(accountWithTrustline, 'testnet')).toBe(true);
    expect(hasUsdcTrustline({ sequence: '1', balances: [] }, 'testnet')).toBe(false);
  });

  it('getBalances returns zeros for a missing account', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(404, {})),
    );
    expect(await getBalances('testnet', 'GADDR')).toEqual({ xlm: '0', usdc: '0' });
  });
});

describe('submitTransaction', () => {
  it('returns the hash on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(200, { hash: 'deadbeef' })),
    );
    expect(await submitTransaction('testnet', 'AAAA')).toBe('deadbeef');
  });

  it('throws with decoded op result codes on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(400, { extras: { result_codes: { operations: ['op_no_trust'] } } }),
      ),
    );
    await expect(submitTransaction('testnet', 'AAAA')).rejects.toThrow(/op_no_trust/);
  });
});

describe('fundWithFriendbot', () => {
  it('resolves on testnet success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(200, {})),
    );
    await expect(fundWithFriendbot('testnet', 'GADDR')).resolves.toBeUndefined();
  });

  it('throws on mainnet (no Friendbot)', async () => {
    await expect(fundWithFriendbot('mainnet', 'GADDR')).rejects.toBeInstanceOf(HorizonError);
  });
});
