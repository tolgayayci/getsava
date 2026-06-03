import { Keypair } from '@stellar/stellar-base';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensureUsdcTrustline, type ProvisioningState } from './provisioning';
import type { SignRawHashFn } from './signing';

const USDC_ISSUER = 'GBHJKBFM3O3F4Z5EOLWMGWDTDTTSTU5KRREB6SZHANMYFYMMRLIGIGWK';

function res(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const accountNoTrustline = {
  sequence: '100',
  balances: [{ asset_type: 'native', balance: '10000.0000000' }],
};
const accountWithTrustline = {
  sequence: '101',
  balances: [
    { asset_type: 'native', balance: '9999.0000000' },
    {
      asset_type: 'credit_alphanum4',
      asset_code: 'USDC',
      asset_issuer: USDC_ISSUER,
      balance: '0.0000000',
    },
  ],
};

/**
 * Stateful fetch mock. `accountResponses` is consumed in order for each
 * GET /accounts call; friendbot + POST /transactions are handled generically.
 */
function mockFetch(accountResponses: Response[], postResponse: Response) {
  let acctIdx = 0;
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('friendbot')) return res(200, {});
    if (u.includes('/transactions') && init?.method === 'POST') return postResponse;
    if (u.includes('/accounts/')) {
      const r = accountResponses[Math.min(acctIdx, accountResponses.length - 1)];
      acctIdx += 1;
      return r as Response;
    }
    return res(404, {});
  });
}

const noSleep = async () => {};

// Real keypair so the signature attachSignature receives actually verifies.
const kp = Keypair.random();
const address = kp.publicKey();
const signRawHash: SignRawHashFn = async ({ hash }) => ({
  signature: `0x${kp.sign(Buffer.from(hash.slice(2), 'hex')).toString('hex')}`,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ensureUsdcTrustline', () => {
  it('funds, adds trustline, and reaches ready (full path)', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(
        [
          res(404, {}), // initial: account missing
          res(200, accountNoTrustline), // after friendbot poll
          res(200, accountWithTrustline), // trustline poll
          res(200, accountWithTrustline), // getBalances
        ],
        res(200, { hash: 'h1' }),
      ),
    );

    const states: ProvisioningState[] = [];
    const result = await ensureUsdcTrustline('testnet', address, signRawHash, {
      onState: (s) => states.push(s),
      sleep: noSleep,
    });

    expect(states).toEqual(['pending', 'funding', 'funded', 'trustline_pending', 'ready']);
    expect(result.balances.usdc).toBe('0.0000000');
  });

  it('is idempotent when already provisioned', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(
        [res(200, accountWithTrustline), res(200, accountWithTrustline)],
        res(200, { hash: 'h' }),
      ),
    );

    const states: ProvisioningState[] = [];
    await ensureUsdcTrustline('testnet', address, signRawHash, {
      onState: (s) => states.push(s),
      sleep: noSleep,
    });

    expect(states).toEqual(['pending', 'funded', 'ready']);
  });

  it('emits "failed" and rethrows when submit fails', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(
        [res(404, {}), res(200, accountNoTrustline)],
        res(400, { extras: { result_codes: { operations: ['op_low_reserve'] } } }),
      ),
    );

    const states: ProvisioningState[] = [];
    await expect(
      ensureUsdcTrustline('testnet', address, signRawHash, {
        onState: (s) => states.push(s),
        sleep: noSleep,
      }),
    ).rejects.toThrow(/op_low_reserve/);

    expect(states.at(-1)).toBe('failed');
  });
});
