import { describe, expect, it } from 'vitest';
import { formatBaseUnits, formatCurrency, formatNumber, formatRelativeTime } from './format';

describe('formatCurrency', () => {
  it('formats TRY in Turkish (₺1.234,56)', () => {
    expect(formatCurrency(1234.56, 'TRY', 'tr')).toBe('₺1.234,56');
  });

  it('formats USD in English ($1,234.56)', () => {
    expect(formatCurrency(1234.56, 'USD', 'en')).toBe('$1,234.56');
  });
});

describe('formatNumber', () => {
  it('groups with Turkish separators', () => {
    expect(formatNumber(1234567.89, 'tr')).toBe('1.234.567,89');
  });

  it('groups with English separators', () => {
    expect(formatNumber(1234567.89, 'en')).toBe('1,234,567.89');
  });
});

describe('formatBaseUnits', () => {
  it('formats USDC (7-decimal base units) without float drift', () => {
    // 1,234.5600000 USDC as integer base units.
    expect(formatBaseUnits(12345600000n, 7, 'tr')).toBe('1.234,56');
    expect(formatBaseUnits('12345600000', 7, 'en')).toBe('1,234.56');
  });

  it('formats a clean negative amount', () => {
    expect(formatBaseUnits(-12345600000n, 7, 'en')).toBe('-1,234.56');
  });

  it('does not render a misleading "-0" when the magnitude truncates to zero', () => {
    // -0.5 USDC shown with 0 display decimals → "0", not "-0".
    expect(formatBaseUnits(-5000000n, 7, 'en', 0)).toBe('0');
  });
});

describe('formatRelativeTime', () => {
  it('formats past minutes', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const earlier = new Date('2026-01-01T11:58:00Z');
    expect(formatRelativeTime(earlier, now, 'en')).toBe('2 minutes ago');
  });
});
