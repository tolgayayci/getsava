import { Keypair, Networks, Transaction } from '@stellar/stellar-base';
import { describe, expect, it } from 'vitest';
import { buildUsdcTrustlineXdr, DEFAULT_FEE } from './trustline';

describe('buildUsdcTrustlineXdr', () => {
  const address = Keypair.random().publicKey();

  it('builds a single changeTrust op for USDC', () => {
    const xdr = buildUsdcTrustlineXdr('testnet', address, '123456789');
    const tx = new Transaction(xdr, Networks.TESTNET);

    expect(tx.operations).toHaveLength(1);
    const op = tx.operations[0];
    expect(op?.type).toBe('changeTrust');
    expect(tx.source).toBe(address);
  });

  it('uses the default fee and is unsigned', () => {
    const xdr = buildUsdcTrustlineXdr('testnet', address, '1');
    const tx = new Transaction(xdr, Networks.TESTNET);
    // fee is per-op * ops; one op → equals DEFAULT_FEE.
    expect(tx.fee).toBe(DEFAULT_FEE);
    expect(tx.signatures).toHaveLength(0);
  });
});
