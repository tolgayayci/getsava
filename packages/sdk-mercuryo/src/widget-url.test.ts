import { describe, expect, it } from 'vitest';
import { buildWidgetUrl } from './widget-url';

const base = {
  widgetId: 'wid_123',
  secret: 'sekret',
  address: 'GUSERADDRESS',
  ip: '9.9.9.9',
  merchantTransactionId: 'tx_abc',
  fiatAmount: '500',
  returnUrl: 'sava://order/tx_abc',
} as const;

describe('buildWidgetUrl', () => {
  it('builds a sandbox URL with ETH USDC on testnet', () => {
    const built = buildWidgetUrl({ ...base, network: 'testnet' });
    const u = new URL(built.url);
    expect(u.origin).toBe('https://sandbox-exchange.mrcr.io');
    expect(u.searchParams.get('type')).toBe('buy');
    expect(u.searchParams.get('currency')).toBe('USDC');
    expect(u.searchParams.get('network')).toBe('ETHEREUM');
    expect(u.searchParams.get('fiat_currency')).toBe('TRY');
    expect(u.searchParams.get('fiat_amount')).toBe('500');
    expect(u.searchParams.get('address')).toBe('GUSERADDRESS');
    expect(u.searchParams.get('merchant_transaction_id')).toBe('tx_abc');
    expect(u.searchParams.get('signature')).toMatch(/^v2:[0-9a-f]{128}$/);
    expect(u.searchParams.get('redirect_url')).toBe('sava://order/tx_abc');
  });

  it('builds a production URL with USDC on STELLAR', () => {
    const built = buildWidgetUrl({ ...base, network: 'mainnet' });
    const u = new URL(built.url);
    expect(u.origin).toBe('https://exchange.mercuryo.io');
    expect(u.searchParams.get('currency')).toBe('USDC');
    expect(u.searchParams.get('network')).toBe('STELLAR');
    expect(built.cryptoNetwork).toBe('STELLAR');
  });

  it('never leaks the secret or ip into the URL', () => {
    const built = buildWidgetUrl({ ...base, network: 'testnet' });
    expect(built.url).not.toContain('sekret');
    expect(built.url).not.toContain('9.9.9.9');
  });
});
