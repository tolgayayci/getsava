import { Keypair, Networks, Transaction } from '@stellar/stellar-base';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildUsdcPaymentXdr, sendUsdc, sendUsdcViaXlm } from './payment';

const TREASURY = Keypair.fromSecret(
  // Throwaway fixed testnet secret — used only to make the test deterministic.
  'SBMDIRB3TUXGKE5EVPFH2K2ISFORDDDTALFBUBFES46CD4UH7DRKK5N2',
);
const DEST = 'GACDILM5EHIRK6ODP7N4ICW7SWJ4PPEBVBKNE5ONPRHJT6OPADHI2VBG';
const ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Mock: account lookup returns a sequence, then the POST returns a hash. */
function mockHorizon(captured: { body?: string }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: { body?: string }) => {
      if (init?.body) {
        captured.body = init.body;
        return { ok: true, json: async () => ({ hash: 'submitted_hash' }) };
      }
      return { ok: true, status: 200, json: async () => ({ sequence: '42' }) };
    }),
  );
}

function decodeSubmitted(body: string) {
  const xdr = decodeURIComponent(body.replace(/^tx=/, ''));
  return new Transaction(xdr, Networks.TESTNET);
}

describe('sendUsdc', () => {
  it('builds, signs, and submits a USDC payment with the right asset and amount', async () => {
    const captured: { body?: string } = {};
    mockHorizon(captured);

    const res = await sendUsdc({
      network: 'testnet',
      sourceSecret: TREASURY.secret(),
      destination: DEST,
      amount: '500.0000000',
      memo: 'order:tx_abc',
    });

    expect(res.hash).toBe('submitted_hash');
    const tx = decodeSubmitted(captured.body ?? '');
    // biome-ignore lint/suspicious/noExplicitAny: parsed operation is loosely typed
    const op = tx.operations[0] as any;
    expect(op.type).toBe('payment');
    expect(op.destination).toBe(DEST);
    expect(op.amount).toBe('500.0000000');
    expect(op.asset.code).toBe('USDC');
    expect(op.asset.issuer).toBe(ISSUER);
    expect(tx.memo.value?.toString()).toBe('order:tx_abc');
    // Signed by the treasury keypair.
    expect(tx.signatures.length).toBe(1);
  });

  it('throws when the treasury account does not exist', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })),
    );
    await expect(
      sendUsdc({
        network: 'testnet',
        sourceSecret: TREASURY.secret(),
        destination: DEST,
        amount: '500',
      }),
    ).rejects.toThrow(/not found/);
  });
});

describe('buildUsdcPaymentXdr', () => {
  const SOURCE = TREASURY.publicKey();

  it('builds an unsigned USDC payment with the right op, memo, and no signatures', () => {
    const xdr = buildUsdcPaymentXdr('testnet', SOURCE, '100', DEST, '12.5000000', {
      memo: 'sava-send',
    });
    const tx = new Transaction(xdr, Networks.TESTNET);
    // biome-ignore lint/suspicious/noExplicitAny: parsed operation is loosely typed
    const op = tx.operations[0] as any;
    expect(op.type).toBe('payment');
    expect(op.destination).toBe(DEST);
    expect(op.amount).toBe('12.5000000');
    expect(op.asset.code).toBe('USDC');
    expect(op.asset.issuer).toBe(ISSUER);
    expect(tx.memo.value?.toString()).toBe('sava-send');
    expect(tx.signatures.length).toBe(0); // unsigned — Privy signs client-side
  });

  it('omits the memo when none is given', () => {
    const xdr = buildUsdcPaymentXdr('testnet', SOURCE, '100', DEST, '1.0000000');
    const tx = new Transaction(xdr, Networks.TESTNET);
    expect(tx.memo.type).toBe('none');
  });
});

describe('sendUsdcViaXlm', () => {
  it('builds a path payment that spends XLM and delivers exact USDC', async () => {
    const captured: { body?: string } = {};
    mockHorizon(captured);

    const res = await sendUsdcViaXlm({
      network: 'testnet',
      sourceSecret: TREASURY.secret(),
      destination: DEST,
      usdcAmount: '12.0000000',
      sendMaxXlm: '240.0000000',
      memo: 'deposit abc',
    });

    expect(res.hash).toBe('submitted_hash');
    const tx = decodeSubmitted(captured.body ?? '');
    // biome-ignore lint/suspicious/noExplicitAny: parsed operation is loosely typed
    const op = tx.operations[0] as any;
    expect(op.type).toBe('pathPaymentStrictReceive');
    expect(op.sendAsset.isNative()).toBe(true);
    expect(op.sendMax).toBe('240.0000000');
    expect(op.destination).toBe(DEST);
    expect(op.destAsset.code).toBe('USDC');
    expect(op.destAsset.issuer).toBe(ISSUER);
    expect(op.destAmount).toBe('12.0000000');
    expect(tx.signatures.length).toBe(1);
  });
});
