/**
 * Illustrative APY history for the vault-detail chart.
 *
 * Blend exposes no on-chain rate history (only the current `estSupplyApy`), so
 * until the backend sampler (D4) records real `{ts, supplyApy}` points, we render
 * a DETERMINISTIC illustrative series anchored to the live APY — same input →
 * same curve (no per-render jitter). The detail screen labels it as illustrative.
 */
export type Timeframe = '1D' | '1W' | '2W' | '1M' | '3M' | '1Y';

export interface ChartPoint {
  /** epoch ms */
  readonly t: number;
  /** APY percent at that time */
  readonly v: number;
}

export const TIMEFRAMES: readonly Timeframe[] = ['1D', '1W', '2W', '1M', '3M', '1Y'];

const DAY = 86_400_000;
const SPEC: Record<Timeframe, { points: number; spanMs: number }> = {
  '1D': { points: 24, spanMs: DAY },
  '1W': { points: 28, spanMs: 7 * DAY },
  '2W': { points: 30, spanMs: 14 * DAY },
  '1M': { points: 30, spanMs: 30 * DAY },
  '3M': { points: 45, spanMs: 90 * DAY },
  '1Y': { points: 52, spanMs: 365 * DAY },
};

/** Small deterministic PRNG (mulberry32) — stable curve per seed. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build a deterministic illustrative APY series for `tf`, ending exactly at
 * `currentApy` (percent). `now` is the right-edge timestamp (pass Date.now()).
 */
export function buildRateSeries(tf: Timeframe, currentApy: number, now: number): ChartPoint[] {
  const { points, spanMs } = SPEC[tf];
  const seed =
    (tf.charCodeAt(0) * 131 + tf.charCodeAt(1) * 7 + Math.round(Math.max(currentApy, 0) * 1000)) >>>
    0;
  const rnd = mulberry32(seed);
  const base = Math.max(currentApy, 0.05);
  const vol = base * 0.4 + 0.03;

  const raw: number[] = [];
  let x = base;
  for (let i = 0; i < points; i++) {
    x += (rnd() - 0.5) * vol;
    if (i > points * 0.6) x += (base - x) * 0.15; // drift back toward the anchor near the end
    x = Math.max(0.01, x);
    raw.push(x);
  }
  const lastRaw = raw[raw.length - 1] ?? base;
  const shift = currentApy - lastRaw;
  const dt = spanMs / (points - 1);
  return raw.map((v, i) => ({ t: now - spanMs + i * dt, v: Math.max(0.01, v + shift) }));
}
