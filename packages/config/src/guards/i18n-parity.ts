/**
 * i18n parity guard.
 *
 * Every user-facing string lives in i18n locale files, and EN must have full TR
 * parity (and vice-versa). This compares the flattened key sets of a group of
 * locales and reports any keys missing from a locale relative to the union.
 */

export interface LocaleParityResult {
  readonly ok: boolean;
  /** locale name -> keys present in some other locale but missing here */
  readonly missing: Record<string, string[]>;
}

function flattenKeys(value: unknown, prefix: string, out: string[]): void {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    if (prefix) {
      out.push(prefix);
    }
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    flattenKeys(child, prefix ? `${prefix}.${key}` : key, out);
  }
}

export function checkLocaleParity(locales: Record<string, unknown>): LocaleParityResult {
  const keysByLocale = new Map<string, Set<string>>();
  const union = new Set<string>();

  for (const [name, tree] of Object.entries(locales)) {
    const keys: string[] = [];
    flattenKeys(tree, '', keys);
    const set = new Set(keys);
    keysByLocale.set(name, set);
    for (const key of set) {
      union.add(key);
    }
  }

  const missing: Record<string, string[]> = {};
  let ok = true;
  for (const [name, keys] of keysByLocale) {
    const absent = [...union].filter((key) => !keys.has(key)).sort();
    if (absent.length > 0) {
      missing[name] = absent;
      ok = false;
    }
  }

  return { ok, missing };
}
