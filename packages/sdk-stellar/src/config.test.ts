import { describe, expect, it } from 'vitest';
import { networkConfig } from './config';

describe('networkConfig', () => {
  it('returns testnet config with Friendbot and the proven USDC issuer', () => {
    const cfg = networkConfig('testnet');
    expect(cfg.networkPassphrase).toBe('Test SDF Network ; September 2015');
    expect(cfg.friendbotUrl).toBe('https://friendbot.stellar.org');
    expect(cfg.usdc).toEqual({
      code: 'USDC',
      issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    });
  });

  it('returns mainnet config with no Friendbot', () => {
    const cfg = networkConfig('mainnet');
    expect(cfg.networkPassphrase).toBe('Public Global Stellar Network ; September 2015');
    expect(cfg.friendbotUrl).toBeNull();
    expect(cfg.usdc.code).toBe('USDC');
  });
});
