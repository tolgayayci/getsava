import type { Network } from '@getsava/types';
import { MERCURYO_HOSTS, mercuryoEnv, widgetCurrency } from './config';
import { signWidgetUrl } from './signing';

/**
 * Everything the backend needs to build one signed on-ramp widget URL.
 * `secret` and `ip` are used only for signing and never appear in the URL.
 */
export interface BuildWidgetUrlInput {
  readonly network: Network;
  readonly widgetId: string;
  readonly secret: string;
  /** The user's Stellar address (where USDC settles in production). */
  readonly address: string;
  /** The user's IP, captured by the backend from the request. */
  readonly ip: string;
  /** UUID we generate per order; ties the widget, callback, and settlement. */
  readonly merchantTransactionId: string;
  /** Fiat to pre-select + lock. Sava is TRY. */
  readonly fiatCurrency?: string;
  /** Pre-filled fiat amount (e.g. '500'). */
  readonly fiatAmount?: string;
  /** Deep link back into the app after the widget completes. */
  readonly returnUrl?: string;
  readonly lang?: string;
}

export interface BuiltWidgetUrl {
  readonly url: string;
  readonly merchantTransactionId: string;
  /** The currency/network the widget was built for (Stellar in prod, ETH in sandbox). */
  readonly currency: string;
  readonly cryptoNetwork: string;
}

/**
 * Build a signed Mercuryo on-ramp widget URL. Pure function — the backend route
 * supplies the secret/ip; the result URL is safe to hand to the client.
 */
export function buildWidgetUrl(input: BuildWidgetUrlInput): BuiltWidgetUrl {
  const env = mercuryoEnv(input.network);
  const { currency, network: cryptoNetwork } = widgetCurrency(input.network);

  const signature = signWidgetUrl({
    address: input.address,
    secret: input.secret,
    ip: input.ip,
    merchantTransactionId: input.merchantTransactionId,
  });

  const params = new URLSearchParams({
    widget_id: input.widgetId,
    type: 'buy',
    currency,
    network: cryptoNetwork,
    fix_currency: 'true',
    address: input.address,
    merchant_transaction_id: input.merchantTransactionId,
    signature,
  });
  params.set('fiat_currency', input.fiatCurrency ?? 'TRY');
  params.set('fix_fiat_currency', 'true');
  if (input.fiatAmount !== undefined) {
    params.set('fiat_amount', input.fiatAmount);
  }
  if (input.returnUrl !== undefined) {
    params.set('redirect_url', input.returnUrl);
  }
  if (input.lang !== undefined) {
    params.set('lang', input.lang);
  }

  return {
    url: `${MERCURYO_HOSTS[env].widget}/?${params.toString()}`,
    merchantTransactionId: input.merchantTransactionId,
    currency,
    cryptoNetwork,
  };
}
