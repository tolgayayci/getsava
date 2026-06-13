import { currentFxRate, FX_BOOTSTRAP_RATE, useFxStore } from './fx-store';

/**
 * FX for display + the time-of-transaction ₺ stamp. The live USDC/TRY rate comes
 * from the CoinGecko-primary / Binance-fallback feed (see fx-feed.ts + useFxFeed);
 * crypto amounts remain the source of truth and ₺ is the conversion at the live
 * (or, for a recorded tx, the time-of-tx) rate.
 */

/** Cold-start placeholder only — the live rate replaces it within seconds. */
export const FX_TRY_PER_USDC = FX_BOOTSTRAP_RATE;

/**
 * USDC → ₺ at the live feed rate. Pass an explicit `rate` in reactive components
 * (so they re-render on rate changes); otherwise it uses the current feed rate —
 * which is exactly what stamps a transaction's time-of-tx ₺ at the moment it's
 * recorded.
 */
export function usdcToTry(usdc: number, rate?: number): number {
  return usdc * (rate ?? currentFxRate());
}

/** Reactive live USDC/TRY rate (re-renders when the feed updates). */
export function useTryRate(): number {
  return useFxStore((s) => s.rate);
}

/** Reactive FX status: which source, whether it's a real live quote, and freshness. */
export function useFxStatus(): { source: string; live: boolean; ts: number } {
  return useFxStore((s) => ({ source: s.source, live: s.live, ts: s.ts }));
}
