/**
 * Marketing-language guard (Sava non-CASP posture).
 *
 * The CI guard scans user-facing string sources (i18n locale files + the
 * disclaimer copy bank) for terms that would imply Sava is a bank / regulated
 * deposit-taker / guaranteed-return product. Unavoidable wording can be passed
 * through an explicit per-call allowlist.
 *
 * Source of truth for the banned list: the Sava project brief + Linear project
 * description (Law 7518 / CMB Communiqués III-35/B.1 & B.2 posture).
 */

export interface BannedTerm {
  readonly term: string;
  readonly lang: 'en' | 'tr';
}

export const BANNED_MARKETING_TERMS: readonly BannedTerm[] = [
  { term: 'guaranteed', lang: 'en' },
  { term: 'garantili', lang: 'tr' },
  { term: 'interest', lang: 'en' },
  { term: 'faiz', lang: 'tr' },
  { term: 'deposit', lang: 'en' },
  { term: 'mevduat', lang: 'tr' },
  { term: 'savings account', lang: 'en' },
  { term: 'tasarruf hesabı', lang: 'tr' },
  { term: 'fixed return', lang: 'en' },
  { term: 'sabit getiri', lang: 'tr' },
  { term: 'investment', lang: 'en' },
  { term: 'yatırım', lang: 'tr' },
  { term: 'fdic', lang: 'en' },
  { term: 'principal protected', lang: 'en' },
];

export interface BannedTermHit {
  readonly term: string;
  readonly index: number;
  readonly excerpt: string;
}

const WORD_CHAR = /[a-z0-9çğıöşü]/;

function isWordChar(char: string): boolean {
  return WORD_CHAR.test(char);
}

/**
 * Returns every banned-term occurrence in `text` (case-insensitive, with a
 * light word-boundary check so "interest" does not match "interesting").
 */
export function scanForBannedTerms(
  text: string,
  options: { readonly allowlist?: readonly string[] } = {},
): BannedTermHit[] {
  const allow = new Set((options.allowlist ?? []).map((entry) => entry.toLowerCase()));
  const haystack = text.toLowerCase();
  const hits: BannedTermHit[] = [];

  for (const { term } of BANNED_MARKETING_TERMS) {
    if (allow.has(term)) {
      continue;
    }
    let from = 0;
    for (;;) {
      const idx = haystack.indexOf(term, from);
      if (idx === -1) {
        break;
      }
      const before = idx === 0 ? '' : (haystack[idx - 1] ?? '');
      const after = haystack[idx + term.length] ?? '';
      if (!isWordChar(before) && !isWordChar(after)) {
        hits.push({
          term,
          index: idx,
          excerpt: text.slice(Math.max(0, idx - 24), idx + term.length + 24),
        });
      }
      from = idx + term.length;
    }
  }

  return hits;
}
