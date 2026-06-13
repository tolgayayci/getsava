import type { PortfolioSample } from './vault-store';

export interface PortfolioPoint {
  readonly ts: number;
  readonly valueUsdc: number;
}

const DAY_MS = 24 * 60 * 60_000;

/**
 * Build the 90-day portfolio-VALUE series for the chart from recorded samples.
 * Values are the real on-chain position value, so the series matches Blend/Stellar
 * state; the right edge is pinned to the current live value (criterion: "chart
 * matches on-chain testnet state"). Padded to ≥2 points so it always renders;
 * sparse early on (it fills in as samples accrue).
 */
export function buildPortfolioSeries(
  history: readonly PortfolioSample[],
  now: number,
  currentValueUsdc: number,
  days = 90,
): PortfolioPoint[] {
  const since = now - days * DAY_MS;
  const pts: PortfolioPoint[] = history
    .filter((s) => s.ts >= since)
    .map((s) => ({ ts: s.ts, valueUsdc: s.valueUsdc }));

  // Pin the right edge to the current live on-chain value.
  const last = pts[pts.length - 1];
  if (!last || now - last.ts > 60_000) {
    pts.push({ ts: now, valueUsdc: currentValueUsdc });
  }
  // Ensure at least two points for a drawable line.
  if (pts.length === 1) {
    pts.unshift({ ts: since, valueUsdc: pts[0]?.valueUsdc ?? currentValueUsdc });
  }
  return pts;
}

/** Days actually covered by in-window samples (for an "X days of history" hint). */
export function coveredDays(history: readonly PortfolioSample[], now: number, days = 90): number {
  const since = now - days * DAY_MS;
  const first = history.find((s) => s.ts >= since);
  return first ? Math.max(0, Math.round((now - first.ts) / DAY_MS)) : 0;
}
