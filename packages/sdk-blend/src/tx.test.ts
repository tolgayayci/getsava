import { xdr } from '@stellar/stellar-base';
import { describe, expect, it } from 'vitest';
import { blendConfig } from './config';
import { supplyRequest, withdrawRequest } from './request';
import { submitOpXdr } from './tx';

const cfg = blendConfig('testnet');
// Any valid Stellar G-address works for op construction (no network call).
const USER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

describe('submitOpXdr', () => {
  it('builds a decodable invokeHostFunction op for a supply request', () => {
    const b64 = submitOpXdr(cfg, USER, [supplyRequest(cfg, 10)]);
    expect(typeof b64).toBe('string');
    expect(b64.length).toBeGreaterThan(0);
    const op = xdr.Operation.fromXDR(b64, 'base64');
    expect(op.body().switch().name).toBe('invokeHostFunction');
  });

  it('builds a decodable op for a full withdraw (I128MAX)', () => {
    const b64 = submitOpXdr(cfg, USER, [withdrawRequest(cfg, { kind: 'all' })]);
    expect(() => xdr.Operation.fromXDR(b64, 'base64')).not.toThrow();
  });
});
