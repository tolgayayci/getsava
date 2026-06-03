import { describe, expect, it } from 'vitest';
import { blendConfig, blendNetwork, USDC_DECIMALS } from './config';

describe('blendConfig', () => {
  it('returns the live-verified testnet Blend addresses', () => {
    const cfg = blendConfig('testnet');
    expect(cfg.poolId).toBe('CAPBMXIQTICKWFPWFDJWMAKBXBPJZUKLNONQH3MLPLLBKQ643CYN5PRW');
    expect(cfg.usdcSac).toBe('CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA');
    expect(cfg.backstopId).toBe('CBDVWXT433PRVTUNM56C3JREF3HIZHRBA64NB2C3B2UNCKIS65ZYCLZA');
    expect(cfg.rpcUrl).toBe('https://soroban-testnet.stellar.org');
    expect(cfg.networkPassphrase).toBe('Test SDF Network ; September 2015');
    expect(cfg.usdcDecimals).toBe(USDC_DECIMALS);
    expect(cfg.usdcDecimals).toBe(7);
  });

  it('projects the blend-sdk Network shape', () => {
    const cfg = blendConfig('testnet');
    expect(blendNetwork(cfg)).toEqual({ rpc: cfg.rpcUrl, passphrase: cfg.networkPassphrase });
  });

  it('throws on mainnet (not configured until T3)', () => {
    expect(() => blendConfig('mainnet')).toThrow(/testnet only/);
  });
});
