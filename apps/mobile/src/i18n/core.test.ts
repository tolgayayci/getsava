import { describe, expect, it } from 'vitest';
import { interpolate, translate } from './core';

describe('translate', () => {
  it('resolves a nested key in EN and TR', () => {
    expect(translate('en', 'onboarding.cta')).toBe('I understand — continue');
    expect(translate('tr', 'onboarding.cta')).toBe('Anladım — devam et');
  });

  it('interpolates variables', () => {
    expect(translate('en', 'otp.sentTo', { email: 'a@b.com' })).toBe('We sent a code to a@b.com');
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
});
