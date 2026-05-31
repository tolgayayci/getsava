import { describe, expect, it } from 'vitest';
import { interpolate, translate } from './core';

describe('translate', () => {
  it('resolves a nested key in EN and TR', () => {
    expect(translate('en', 'onboarding.getStarted')).toBe('Get started');
    expect(translate('tr', 'onboarding.getStarted')).toBe('Başlayın');
  });

  it('interpolates variables', () => {
    expect(translate('en', 'auth.otpSentTo', { email: 'a@b.com' })).toBe(
      'We sent a code to a@b.com',
    );
  });

  it('falls back to the raw key when missing', () => {
    // @ts-expect-error — unknown keys must fail typecheck (runtime falls back).
    expect(translate('en', 'does.not.exist')).toBe('does.not.exist');
  });
});

describe('interpolate', () => {
  it('replaces known placeholders and leaves unknown ones intact', () => {
    expect(interpolate('Hi {name}, {x}', { name: 'Ada' })).toBe('Hi Ada, {x}');
  });

  it('returns the template unchanged with no vars', () => {
    expect(interpolate('nothing to do')).toBe('nothing to do');
  });

  it('stringifies numeric values', () => {
    expect(interpolate('{n} items', { n: 3 })).toBe('3 items');
  });
});
