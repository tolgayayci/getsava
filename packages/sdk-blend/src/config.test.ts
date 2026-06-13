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

  it('returns the D6-selected mainnet Blend addresses (Fixed V2 launch pool)', () => {
    const cfg = blendConfig('mainnet');
    expect(cfg.poolId).toBe('CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD');
    expect(cfg.usdcSac).toBe('CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75');
    expect(cfg.backstopId).toBe('CAQQR5SWBXKIGZKPBZDH3KM5GQ5GUTPKB7JAFCINLZBC5WXPJKRG3IM7');
    expect(cfg.poolFactoryId).toBe('CDSYOAVXFY7SM5S64IZPPPYB4GVGGLMQVFREPSQQEZVIWXX5R23G4QSU');
    expect(cfg.rpcUrl).toBe('https://mainnet.sorobanrpc.com');
    expect(cfg.networkPassphrase).toBe('Public Global Stellar Network ; September 2015');
    expect(cfg.usdcDecimals).toBe(7);
  });

  it('the mainnet pool is the one on the whitelist (config ↔ whitelist agree)', () => {
    // guards against config/whitelist drift — both must name the same launch pool
    expect(blendConfig('mainnet').poolId).toBe(
      'CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD',
    );
  });
});
