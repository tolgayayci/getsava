import { describe, expect, it } from 'vitest';
import {
  bankMultiplier,
  CBRT_1Y_RATES,
  COMPARISON_YEARS,
  compareBankVsSava,
  TRY_USD_2020,
} from './bankRates';

describe('bankMultiplier', () => {
  it('compounds the CBRT 1-year rates to ≈ 3.75× over 2021–2025', () => {
    expect(bankMultiplier()).toBeCloseTo(3.7535, 3);
    expect(COMPARISON_YEARS).toBe(5);
    expect(CBRT_1Y_RATES).toHaveLength(5);
  });
});

describe('compareBankVsSava (dollar-terms, real data)', () => {
  // ₺100,000 5 years ago → principal in USD at the 2020 rate.
  const principalUsd = 100_000 / TRY_USD_2020; // ≈ $13,450
  const c = compareBankVsSava({ principalUsd, tryRateNow: 44.7, savaApyPct: 9.47 });

  it('anchors the lira-then value at the entered principal', () => {
    expect(c.liraThen).toBeCloseTo(100_000, 0);
    expect(c.startUsd).toBeCloseTo(13_450.3, 0);
  });

  it('shows a Turkish bank LOSING dollars despite a big nominal lira balance', () => {
    expect(c.bankLiraNow).toBeCloseTo(375_350, -1); // looks big in lira
    expect(c.bankUsd).toBeCloseTo(8_397, -1); // but ~$8.4k in dollars
    expect(c.bankUsd).toBeLessThan(c.startUsd); // a real dollar LOSS
    expect(c.bankPct).toBeCloseTo(-37.6, 0);
  });

  it('shows cash losing the most in dollars', () => {
    expect(c.cashUsd).toBeCloseTo(2_237, -1);
    expect(c.cashUsd).toBeLessThan(c.bankUsd);
  });

  it('shows Sava growing in dollars at the modeled APY', () => {
    expect(c.savaUsd).toBeCloseTo(21_144, -2);
    expect(c.savaUsd).toBeGreaterThan(c.startUsd);
    expect(c.savaPct).toBeCloseTo(57.2, 0);
  });

  it('even at the tiny testnet APY, dollars beat the lira bank in dollar terms', () => {
    const tiny = compareBankVsSava({ principalUsd, tryRateNow: 44.7, savaApyPct: 0.51 });
    expect(tiny.savaUsd).toBeGreaterThan(tiny.bankUsd); // Sava > bank in USD
    expect(tiny.savaPct).toBeGreaterThan(0); // held its dollar value
    expect(tiny.bankPct).toBeLessThan(0); // bank still lost dollars
  });

  it('handles degenerate inputs safely', () => {
    const z = compareBankVsSava({ principalUsd: 0, tryRateNow: 0, savaApyPct: 5 });
    expect(z.startUsd).toBe(0);
    expect(z.bankPct).toBe(0);
    expect(Number.isFinite(z.savaUsd)).toBe(true);
  });
});
