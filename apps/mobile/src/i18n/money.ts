import type { Locale } from './messages';

/**
 * Currency-NATIVE money formatting (ported 1:1 from the Claude Design handoff).
 *
 * Independent of the UI language and capped at 2 decimals:
 *  - Lira is ALWAYS grouped Turkish-style (`.` thousands, `,` decimal); only the
 *    ₺ symbol position flips (before in EN, after in TR).
 *  - USDC is ALWAYS grouped US-style (`,` thousands, `.` decimal).
 *  - Percent uses the locale's decimal separator and symbol position.
 *
 * These deliberately differ from the Intl helpers in `format.ts` (which the
 * design's lira rule — Turkish grouping even in EN — can't express).
 */

interface LiraGroup {
  readonly sign: string;
  readonly int: string;
  readonly dec: string;
  readonly str: string;
}

function groupLira(n: number, locale: Locale): LiraGroup {
  const fixed = Math.abs(n).toFixed(2);
  const [intRaw, dec] = fixed.split('.') as [string, string];
  const sign = n < 0 ? '-' : '';
  const int = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); // period thousands (TR)
  const str = locale === 'tr' ? `${sign}${int},${dec} ₺` : `${sign}₺${int},${dec}`;
  return { sign, int, dec, str };
}

/** e.g. 14323.56 → `14.323,56 ₺` (tr) / `₺14.323,56` (en). */
export function formatLira(n: number, locale: Locale): string {
  return groupLira(n, locale).str;
}

export interface LiraParts {
  /** Leading symbol (₺ in EN, empty in TR). */
  readonly pre: string;
  /** Sign + grouped integer part. */
  readonly int: string;
  /** Two-digit decimal part. */
  readonly dec: string;
  /** Trailing symbol (₺ in TR, empty in EN). */
  readonly suf: string;
  /** Decimal separator (always `,` for lira). */
  readonly sep: string;
}

/** Split a lira amount for the styled hero (symbol / int / dimmed decimal / suffix). */
export function liraParts(n: number, locale: Locale): LiraParts {
  const g = groupLira(n, locale);
  if (locale === 'tr') {
    return { pre: '', int: g.sign + g.int, dec: g.dec, suf: '₺', sep: ',' };
  }
  return { pre: '₺', int: g.sign + g.int, dec: g.dec, suf: '', sep: ',' };
}

/** e.g. 1410.84 → `1,410.84 USDC` (US style, both locales). */
export function formatUsdc(n: number, _locale: Locale, withTicker = true): string {
  const fixed = Math.abs(n).toFixed(2);
  const [intRaw, dec] = fixed.split('.') as [string, string];
  const sign = n < 0 ? '-' : '';
  const int = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ','); // comma thousands (US)
  return `${sign}${int}.${dec}${withTicker ? ' USDC' : ''}`;
}

/** e.g. 8 → `%8,0` (tr) / `8.0%` (en). */
export function formatPct(n: number, locale: Locale): string {
  const s = n.toFixed(1).replace('.', locale === 'tr' ? ',' : '.');
  return locale === 'tr' ? `%${s}` : `${s}%`;
}
