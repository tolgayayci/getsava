import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchUsdcTry } from './fx-feed';

function res(ok: boolean, body: unknown) {
  return { ok, json: async () => body } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchUsdcTry (CoinGecko primary, Binance fallback)', () => {
  it('uses CoinGecko when it responds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('coingecko')) {
          return res(true, { 'usd-coin': { try: 46.08 } });
        }
        throw new Error('binance should not be called');
      }),
    );
    expect(await fetchUsdcTry()).toEqual({ rate: 46.08, source: 'coingecko' });
  });

  it('falls back to Binance when CoinGecko fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('coingecko')) {
          return res(false, {});
        }
        return res(true, { symbol: 'USDTTRY', price: '46.07000000' });
      }),
    );
    expect(await fetchUsdcTry()).toEqual({ rate: 46.07, source: 'binance' });
  });

  it('falls back to Binance when CoinGecko returns a bad shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('coingecko') ? res(true, { 'usd-coin': {} }) : res(true, { price: '45.9' }),
      ),
    );
    expect(await fetchUsdcTry()).toEqual({ rate: 45.9, source: 'binance' });
  });

  it('returns null when BOTH sources fail (caller shows N/A, never a guess)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    expect(await fetchUsdcTry()).toBeNull();
  });

  it('rejects non-positive / non-numeric rates', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('coingecko')
          ? res(true, { 'usd-coin': { try: 0 } })
          : res(true, { price: 'NaN' }),
      ),
    );
    expect(await fetchUsdcTry()).toBeNull();
  });
});
