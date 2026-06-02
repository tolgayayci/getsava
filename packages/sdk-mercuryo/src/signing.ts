import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Mercuryo widget URL signature (verified against the official docs).
 *
 * signature = "v2:" + SHA512( address + secret + ip + merchant_transaction_id )
 *
 * The `secret` is the widget Secret key and is SERVER-SIDE ONLY — this function
 * must never run in the client bundle. `address` and `merchantTransactionId`
 * must also appear as URL params or Mercuryo rejects the signature.
 */
export interface SignWidgetInput {
  readonly address: string;
  readonly secret: string;
  readonly ip: string;
  readonly merchantTransactionId: string;
}

export function signWidgetUrl(input: SignWidgetInput): string {
  const data = `${input.address}${input.secret}${input.ip}${input.merchantTransactionId}`;
  const hash = createHash('sha512').update(data, 'utf8').digest('hex');
  return `v2:${hash}`;
}

/**
 * Verify a Mercuryo callback. Each callback carries an `X-Signature` header that
 * is HMAC-SHA256(rawBody, signKey). The RAW body must be used verbatim — never
 * re-serialize the parsed JSON, or the hash won't match. Constant-time compare.
 */
export function verifyCallbackSignature(
  rawBody: string,
  signature: string,
  signKey: string,
): boolean {
  const expected = createHmac('sha256', signKey).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
