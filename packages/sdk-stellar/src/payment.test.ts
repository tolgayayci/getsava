import { Keypair, Networks, Transaction } from '@stellar/stellar-base';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendUsdc } from './payment';

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
    vi.fn(async (url: string, init?: { body?: string }) => {
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
