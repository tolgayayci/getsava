import { describe, expect, it } from 'vitest';
import { checkLocaleParity } from './i18n-parity.js';

describe('checkLocaleParity', () => {
  it('passes when locales share the same keys', () => {
    const result = checkLocaleParity({
      en: { home: { title: 'Home' }, cta: 'Go' },
      tr: { home: { title: 'Ana Sayfa' }, cta: 'Git' },
    });
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual({});
  });

  it('passes for an empty set of locales', () => {
    expect(checkLocaleParity({}).ok).toBe(true);
  });

  it('reports keys missing from a locale', () => {
    const result = checkLocaleParity({
      en: { home: { title: 'Home' }, cta: 'Go' },
      tr: { home: { title: 'Ana Sayfa' } },
    });
    expect(result.ok).toBe(false);
    expect(result.missing.tr).toEqual(['cta']);
  });
});
