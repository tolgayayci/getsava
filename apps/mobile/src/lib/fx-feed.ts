/**
 * Live USDC/TRY FX feed (T2.D4): CoinGecko primary, Binance fallback. Returns the
 * real rate + which source produced it, or null when BOTH fail (callers then keep
 * the last known rate or show N/A — never a fabricated number).
 */

export type FxSource = 'coingecko' | 'binance';

export interface FxQuote {
  readonly rate: number;
  readonly source: FxSource;
}

const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=try';
const BINANCE_URL = 'https://api.binance.com/api/v3/ticker/price?symbol=USDTTRY';
const TIMEOUT_MS = 8000;

function withTimeout(signal?: AbortSignal): { signal: AbortSignal; done: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  if (signal) {
    signal.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  return { signal: ctrl.signal, done: () => clearTimeout(timer) };
}

async function fromCoinGecko(parent?: AbortSignal): Promise<number | null> {
  const { signal, done } = withTimeout(parent);
  try {
    const res = await fetch(COINGECKO_URL, { signal });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as { 'usd-coin'?: { try?: number } };
    const rate = data['usd-coin']?.try;
    return typeof rate === 'number' && rate > 0 ? rate : null;
  } catch {
    return null;
  } finally {
    done();
  }
}

async function fromBinance(parent?: AbortSignal): Promise<number | null> {
  const { signal, done } = withTimeout(parent);
  try {
    const res = await fetch(BINANCE_URL, { signal });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as { price?: string };
    const rate = Number.parseFloat(data.price ?? '');
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  } catch {
    return null;
  } finally {
    done();
  }
}

/** Real USDC/TRY rate from CoinGecko, falling back to Binance. null if both fail. */
export async function fetchUsdcTry(signal?: AbortSignal): Promise<FxQuote | null> {
  const cg = await fromCoinGecko(signal);
  if (cg !== null) {
    return { rate: cg, source: 'coingecko' };
  }
  const bn = await fromBinance(signal);
  if (bn !== null) {
    return { rate: bn, source: 'binance' };
  }
  return null;
}
