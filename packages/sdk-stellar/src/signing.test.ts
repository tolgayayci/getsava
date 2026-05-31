import { Keypair, Networks, Transaction } from '@stellar/stellar-base';
import { describe, expect, it } from 'vitest';
import { attachSignature, type Hex, transactionHashHex } from './signing';
import { buildUsdcTrustlineXdr } from './trustline';

describe('raw-hash signing flow', () => {
  const kp = Keypair.random();
  const address = kp.publicKey();
  const xdr = buildUsdcTrustlineXdr('testnet', address, '987654321');

  it('produces a deterministic 0x-prefixed 32-byte hash', () => {
    const hash = transactionHashHex('testnet', xdr);
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(transactionHashHex('testnet', xdr)).toBe(hash);
  });

  it('attaches a valid raw signature (addSignature verifies, so this proves the path)', () => {
    // Simulate Privy signRawHash: Ed25519-sign the raw hash bytes.
    const hashHex = transactionHashHex('testnet', xdr);
    const sig = kp.sign(Buffer.from(hashHex.slice(2), 'hex'));
    const signatureHex: Hex = `0x${sig.toString('hex')}`;

    const signedXdr = attachSignature('testnet', xdr, address, signatureHex);
    const signed = new Transaction(signedXdr, Networks.TESTNET);

    // If the signature were wrong for the hash, addSignature would have thrown.
    expect(signed.signatures).toHaveLength(1);
  });

  it('rejects a signature that does not match the hash', () => {
    const wrong: Hex = `0x${'00'.repeat(64)}`;
    expect(() => attachSignature('testnet', xdr, address, wrong)).toThrow();
  });
});
