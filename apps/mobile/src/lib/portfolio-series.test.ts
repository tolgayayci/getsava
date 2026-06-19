import { describe, expect, it } from 'vitest';
import { buildPortfolioSeries, coveredDays } from './portfolio-series';
import type { PortfolioSample } from './vault-store';

const DAY = 24 * 60 * 60_000;
const NOW = 1_000 * DAY;

const s = (daysAgo: number, valueUsdc: number): PortfolioSample => ({
  ts: NOW - daysAgo * DAY,
  valueUsdc,
  principalUsdc: valueUsdc,
});

describe('buildPortfolioSeries', () => {
  it('pads to a flat 2-point line at the current value when there is no history', () => {
    const series = buildPortfolioSeries([], NOW, 50);
    expect(series).toHaveLength(2);
    expect(series[0]?.valueUsdc).toBe(50);
    expect(series[1]?.valueUsdc).toBe(50);
  });

  it('keeps in-window samples and pins the right edge to the live value', () => {
    const series = buildPortfolioSeries([s(80, 10), s(40, 20), s(10, 30)], NOW, 35);
    expect(series.length).toBeGreaterThanOrEqual(3);
    expect(series[0]?.valueUsdc).toBe(10);
    // last point is the current live value (chart matches on-chain)
    expect(series[series.length - 1]?.valueUsdc).toBe(35);
  });

  it('drops samples older than the 90-day window', () => {
    const series = buildPortfolioSeries([s(120, 99), s(5, 20)], NOW, 20);
    expect(series.some((p) => p.valueUsdc === 99)).toBe(false);
  });

  it('does not duplicate a fresh trailing sample', () => {
    const series = buildPortfolioSeries([s(10, 20), s(0, 40)], NOW, 40);
    // the 0-days-ago sample is the live edge already; no extra point appended
    expect(series.filter((p) => p.valueUsdc === 40)).toHaveLength(1);
  });
});

describe('coveredDays', () => {
  it('reports how many days of history are in-window', () => {
    expect(coveredDays([s(80, 10), s(10, 30)], NOW)).toBe(80);
    expect(coveredDays([], NOW)).toBe(0);
  });
});
