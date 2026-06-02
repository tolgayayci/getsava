import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { signWidgetUrl, verifyCallbackSignature } from './signing';

describe('signWidgetUrl', () => {
  it('produces v2: + SHA512(address+secret+ip+merchantTxId)', () => {
    const input = {
      address: 'GTEST',
      secret: 'sekret',
      ip: '1.2.3.4',
      merchantTransactionId: 'tx_1',
    };
    const expected = `v2:${createHash('sha512').update('GTESTsekret1.2.3.4tx_1').digest('hex')}`;
    expect(signWidgetUrl(input)).toBe(expected);
  });

  it('is deterministic and changes when any field changes', () => {
    const base = { address: 'A', secret: 'S', ip: 'I', merchantTransactionId: 'M' };
    const sig = signWidgetUrl(base);
    expect(signWidgetUrl(base)).toBe(sig);
    expect(signWidgetUrl({ ...base, ip: 'X' })).not.toBe(sig);
  });
});

describe('verifyCallbackSignature', () => {
  const signKey = 'callback_key';
  const body = '{"type":"buy","status":"completed","merchant_transaction_id":"tx_1"}';
  const valid = createHmac('sha256', signKey).update(body).digest('hex');

  it('accepts a correct HMAC-SHA256 of the raw body', () => {
    expect(verifyCallbackSignature(body, valid, signKey)).toBe(true);
  });

  it('rejects a tampered body', () => {
    expect(verifyCallbackSignature(`${body} `, valid, signKey)).toBe(false);
  });

  it('rejects a wrong signature', () => {
    expect(verifyCallbackSignature(body, `${valid.slice(0, -1)}0`, signKey)).toBe(false);
  });

  it('rejects a length mismatch without throwing', () => {
    expect(verifyCallbackSignature(body, 'short', signKey)).toBe(false);
  });
});
