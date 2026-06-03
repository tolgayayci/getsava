/**
 * Mercuryo widget config for the IN-APP preview.
 *
 * Loads the REAL Mercuryo widget so the UI is visible/testable WITHOUT a
 * signature: we omit `address`, so Mercuryo does not require a signature and no
 * secret ever touches the client (guardrail respected). Pre-filling the user's
 * Stellar address — and thus completing a real purchase — needs the backend to
 * sign the URL (T1.D6) and a real partner widget_id (YK-461).
 *
 * Defaults to Mercuryo's published TEST widget_id on the publicly-loadable
 * production host. Override via env once the sandbox account + IP allowlist land:
 *   EXPO_PUBLIC_MERCURYO_WIDGET_ID=<your sandbox widget id>
 *   EXPO_PUBLIC_MERCURYO_SANDBOX=true   (uses sandbox host; needs IP allowlist)
 */

const TEST_WIDGET_ID = '625376b4-cf28-43b8-b836-550cd558c431';

export const MERCURYO_WIDGET_ID = process.env.EXPO_PUBLIC_MERCURYO_WIDGET_ID ?? TEST_WIDGET_ID;

const MERCURYO_HOST =
  process.env.EXPO_PUBLIC_MERCURYO_SANDBOX === 'true'
    ? 'https://sandbox-exchange.mrcr.io'
    : 'https://exchange.mercuryo.io';

/** Build the (unsigned, address-less) widget URL for the preview. */
export function buildMercuryoPreviewUrl(input: { amountTry: string; orderId: string }): string {
  const params = [
    `widget_id=${encodeURIComponent(MERCURYO_WIDGET_ID)}`,
    'type=buy',
    'fiat_currency=TRY',
    `fiat_amount=${encodeURIComponent(input.amountTry)}`,
    'currency=USDC',
    'network=STELLAR',
    'fix_currency=true',
    `merchant_transaction_id=${encodeURIComponent(input.orderId)}`,
  ].join('&');
  return `${MERCURYO_HOST}/?${params}`;
}
