import { describe, expect, it } from 'vitest';
import { scanForBannedTerms } from './banned-terms.js';

describe('scanForBannedTerms', () => {
  it('passes clean compliant copy', () => {
    expect(scanForBannedTerms('Earn variable yield by supplying USDC. Not a bank.')).toEqual([]);
  });

  it('flags an English banned term', () => {
    const hits = scanForBannedTerms('Open a savings account with guaranteed returns');
    const terms = hits.map((h) => h.term);
    expect(terms).toContain('guaranteed');
    expect(terms).toContain('savings account');
  });

  it('flags Turkish banned terms', () => {
    const hits = scanForBannedTerms('garantili faiz getirisi olan mevduat');
    expect(hits.map((h) => h.term)).toEqual(
      expect.arrayContaining(['garantili', 'faiz', 'mevduat']),
    );
  });

  it('does not match substrings inside other words', () => {
    // "interest" inside "interesting", "deposit" not present
    expect(scanForBannedTerms('This is an interesting product')).toEqual([]);
  });

  it('honours the allowlist', () => {
    const hits = scanForBannedTerms('income tax may apply to your investment', {
      allowlist: ['investment'],
    });
    expect(hits).toEqual([]);
  });
});
