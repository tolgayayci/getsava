import type { RateSample } from './vault-store';

/**
 * Chart series for the vault-detail APY chart, built from REAL recorded samples.
 *
 * Blend exposes no historical rate API, so the app samples the live `estSupplyApy`
 * on each read (see useVault → vault-store.recordRate) and this module windows that
 * real history per timeframe. Early on the history is sparse — we then show a flat
 * line at the live rate (the rate IS X; the curve fills in as samples accrue). A
 * supply rate is inherently stable, so the line is gentle by nature, not synthetic.
 */
export type Timeframe = '1D' | '1W' | '2W' | '1M' | '3M' | '1Y';

export interface ChartPoint {
  /** epoch ms */
  readonly t: number;
  /** APY percent */
  readonly v: number;
}

export const TIMEFRAMES: readonly Timeframe[] = ['1D', '1W', '2W', '1M', '3M', '1Y'];

const DAY = 86_400_000;
export const TIMEFRAME_SPAN_MS: Record<Timeframe, number> = {
  '1D': DAY,
  '1W': 7 * DAY,
  '2W': 14 * DAY,
  '1M': 30 * DAY,
  '3M': 90 * DAY,
  '1Y': 365 * DAY,
};

/**
 * Window the recorded samples to `tf` and pin the right edge to the live
 * `currentApy` at `now`. Fewer than two in-window samples → a flat line at the
 * live rate (true; history is still being recorded).
 */
export function buildSeriesFromHistory(
  history: readonly RateSample[],
  tf: Timeframe,
  currentApy: number,
  now: number,
): ChartPoint[] {
  const cutoff = now - TIMEFRAME_SPAN_MS[tf];
  const pts: ChartPoint[] = history
    .filter((h) => h.ts >= cutoff)
    .map((h) => ({ t: h.ts, v: h.apy }));

  const last = pts[pts.length - 1];
  if (!last || now - last.t > 60_000) {
    pts.push({ t: now, v: currentApy });
  }
  if (pts.length < 2) {
    return [
      { t: cutoff, v: currentApy },
      { t: now, v: currentApy },
    ];
  }
  return pts;
}

/** True when the window has real recorded variation (≥ 3 distinct samples). */
export function hasRealHistory(
  history: readonly RateSample[],
  tf: Timeframe,
  now: number,
): boolean {
  const cutoff = now - TIMEFRAME_SPAN_MS[tf];
  return history.filter((h) => h.ts >= cutoff).length >= 3;
}
