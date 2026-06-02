import type { Network } from '@getsava/types';

/**
 * Mercuryo environment hosts (from the official widget docs). The "exchange"
 * host is the redirect/WebView widget URL we build and sign.
 */
export interface MercuryoHosts {
  readonly widget: string;
  readonly api: string;
}

export const MERCURYO_HOSTS: Record<'sandbox' | 'production', MercuryoHosts> = {
  sandbox: {
    widget: 'https://sandbox-exchange.mrcr.io',
    api: 'https://sandbox-api.mrcr.io',
  },
  production: {
    widget: 'https://exchange.mercuryo.io',
    api: 'https://api.mercuryo.io',
  },
};

/**
 * Which Mercuryo crypto/network the widget targets.
 *
 * IMPORTANT (verified against Mercuryo's live currencies API): USDC-on-STELLAR
 * on-ramp IS supported in PRODUCTION, but the SANDBOX has no Stellar testnet —
 * its testnet addresses are BTC/ETH only. So on testnet we exercise the real
 * widget on an ETH-testnet currency and bridge testnet USDC to the user's
 * Stellar wallet out-of-band (see @getsava/sdk-stellar treasury transfer);
 * production switches to currency=USDC, network=STELLAR with direct settlement.
 */
export interface WidgetCurrency {
  readonly currency: string;
  readonly network: string;
}

export function widgetCurrency(network: Network): WidgetCurrency {
  // Production: real USDC on Stellar. Testnet: sandbox can't settle Stellar, so
  // the widget runs on ETH (USDC) and the treasury bridge delivers Stellar USDC.
  return network === 'mainnet'
    ? { currency: 'USDC', network: 'STELLAR' }
    : { currency: 'USDC', network: 'ETHEREUM' };
}

/** Maps our app network to the Mercuryo environment we sign URLs against. */
export function mercuryoEnv(network: Network): 'sandbox' | 'production' {
  return network === 'mainnet' ? 'production' : 'sandbox';
}
