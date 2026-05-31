import { type Locale, messages, type TranslationKey } from './messages';

export type TVars = Record<string, string | number>;

/** Resolve a dotted key against a message tree; undefined if absent or non-string. */
function resolve(tree: unknown, key: string): string | undefined {
  let node: unknown = tree;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) {
      return undefined;
    }
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Replace `{name}` placeholders with values from `vars`. Unknown placeholders are left intact. */
export function interpolate(template: string, vars?: TVars): string {
  if (!vars) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/**
 * Translate a typed key for a locale, falling back to EN, then to the raw key.
 * Use the `useTranslation()` hook in components; this pure function powers it
 * and is the unit-tested core.
 */
export function translate(locale: Locale, key: TranslationKey, vars?: TVars): string {
  const value = resolve(messages[locale], key) ?? resolve(messages.en, key) ?? key;
  return interpolate(value, vars);
}
