import type { Locale } from './messages';

const INTL_LOCALE: Record<Locale, string> = {
  en: 'en-US',
  tr: 'tr-TR',
};

export type CurrencyCode = 'USD' | 'TRY';

/** e.g. 1234.56 → '₺1.234,56' (tr) / '$1,234.56' (en, USD). */
export function formatCurrency(
  amount: number,
  currency: CurrencyCode,
  locale: Locale = 'tr',
): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(
  value: number,
  locale: Locale = 'tr',
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], options).format(value);
}

export function formatDate(
  date: Date,
  locale: Locale = 'tr',
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' },
): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], options).format(date);
}

/** Relative time vs `now` (defaults to the same instant if omitted by the caller). */
export function formatRelativeTime(date: Date, now: Date, locale: Locale = 'tr'): string {
  const rtf = new Intl.RelativeTimeFormat(INTL_LOCALE[locale], { numeric: 'auto' });
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);

  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (Math.abs(seconds) < 60) return rtf.format(seconds, 'second');
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
  return rtf.format(days, 'day');
}

/** Locale-specific group/decimal separators, derived from Intl. */
function separators(locale: Locale): { group: string; decimal: string } {
  const parts = new Intl.NumberFormat(INTL_LOCALE[locale]).formatToParts(11111.1);
  return {
    group: parts.find((p) => p.type === 'group')?.value ?? ',',
    decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
  };
}

/**
 * Format a token amount held as integer minor units (no floating-point drift).
 * `base` is the on-chain integer (e.g. USDC has 7 decimals on Stellar); the
 * fraction is truncated to `displayDecimals` for display.
 */
export function formatBaseUnits(
  base: bigint | string,
  decimals: number,
  locale: Locale = 'tr',
  displayDecimals = 2,
): string {
  const raw = typeof base === 'bigint' ? base : BigInt(base);
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;

  const divisor = 10n ** BigInt(decimals);
  const whole = abs / divisor;
  const fraction = (abs % divisor).toString().padStart(decimals, '0').slice(0, displayDecimals);

  const { decimal } = separators(locale);
  const wholeGrouped = new Intl.NumberFormat(INTL_LOCALE[locale]).format(whole);

  // Suppress a misleading "-0" when the magnitude truncates to zero for display.
  const rendersZero = whole === 0n && /^0*$/.test(fraction);
  const sign = negative && !rendersZero ? '-' : '';

  return displayDecimals > 0
    ? `${sign}${wholeGrouped}${decimal}${fraction}`
    : `${sign}${wholeGrouped}`;
}
