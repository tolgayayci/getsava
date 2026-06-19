import { useEffect } from 'react';
import { fetchUsdcTry } from './fx-feed';
import { useFxStore } from './fx-store';

/** Poll interval for the live USDC/TRY rate. */
const REFRESH_MS = 60_000;

/**
 * Keeps the live USDC/TRY rate fresh from the CoinGecko/Binance feed. Mount once
 * in the app shell. On failure it leaves the last known rate in place (never
 * overwrites a real rate with a guess).
 */
export function useFxFeed(): void {
  const setQuote = useFxStore((s) => s.setQuote);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const tick = async () => {
      const quote = await fetchUsdcTry(controller.signal);
      if (active && quote) {
        setQuote(quote.rate, quote.source, Date.now());
      }
    };
    void tick();
    const id = setInterval(() => void tick(), REFRESH_MS);
    return () => {
      active = false;
      controller.abort();
      clearInterval(id);
    };
  }, [setQuote]);
}
