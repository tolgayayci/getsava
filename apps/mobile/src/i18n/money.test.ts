import { describe, expect, it } from 'vitest';
import { formatLira, formatPct, formatUsdc, liraParts } from './money';

describe('formatLira', () => {
  it('groups Turkish-style and places ₺ per locale', () => {
    expect(formatLira(14323.56, 'tr')).toBe('14.323,56 ₺');
    expect(formatLira(14323.56, 'en')).toBe('₺14.323,56');
  });
  it('handles negatives and rounds to 2 dp', () => {
    expect(formatLira(-5, 'tr')).toBe('-5,00 ₺');
    expect(formatLira(1234.005, 'en')).toBe('₺1.234,01');
  });
});

describe('formatUsdc', () => {
  it('is always US-style with optional ticker', () => {
    expect(formatUsdc(1410.84, 'tr')).toBe('1,410.84 USDC');
    expect(formatUsdc(1410.84, 'en', false)).toBe('1,410.84');
  });
});

describe('formatPct', () => {
  it('places the percent symbol per locale', () => {
    expect(formatPct(8, 'tr')).toBe('%8,0');
    expect(formatPct(8, 'en')).toBe('8.0%');
  });
});

describe('liraParts', () => {
  it('splits symbol / int / dec for the hero', () => {
    expect(liraParts(48250.73, 'tr')).toEqual({
      pre: '',
      int: '48.250',
      dec: '73',
      suf: '₺',
      sep: ',',
    });
    expect(liraParts(48250.73, 'en')).toEqual({
      pre: '₺',
      int: '48.250',
      dec: '73',
      suf: '',
      sep: ',',
    });
  });
});
