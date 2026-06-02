import type { Network } from '@getsava/types';
import { networkConfig } from './config';

/**
 * Settlement detection (YK-466): the source of truth for "USDC arrived" is
 * Stellar, not Mercuryo's callback. Query Horizon's payments for the user's
 * address and look for an incoming USDC credit that matches the order.
 */
interface HorizonPaymentRecord {
  readonly id: string;
  readonly type: string;
  readonly transaction_hash: string;
  readonly asset_type?: string;
  readonly asset_code?: string;
  readonly asset_issuer?: string;
  readonly from?: string;
  readonly to?: string;
  readonly amount?: string;
}

export interface SettlementMatch {
  readonly transactionHash: string;
  readonly amount: string;
}

/**
 * Look for an incoming USDC payment to `address` of at least `minAmount`,
 * optionally restricted to those after `cursorId`. Returns the first match or
 * null. Pure HTTP via fetch — no Horizon SDK (keeps RN/Workers light).
 */
export async function findUsdcSettlement(
  network: Network,
  address: string,
  minAmount: string,
  options: { limit?: number; order?: 'asc' | 'desc' } = {},
): Promise<SettlementMatch | null> {
  const cfg = networkConfig(network);
  const limit = options.limit ?? 50;
  const order = options.order ?? 'desc';
  const url = `${cfg.horizonUrl}/accounts/${address}/payments?limit=${limit}&order=${order}`;

  const res = await fetch(url);
  if (!res.ok) {
    return null;
  }
  const body = (await res.json()) as { _embedded?: { records?: HorizonPaymentRecord[] } };
  const records = body._embedded?.records ?? [];
  const min = Number.parseFloat(minAmount);

  for (const r of records) {
    if (
      r.type === 'payment' &&
      r.to === address &&
      r.asset_code === cfg.usdc.code &&
      r.asset_issuer === cfg.usdc.issuer &&
      r.amount !== undefined &&
      Number.parseFloat(r.amount) + 1e-7 >= min
    ) {
      return { transactionHash: r.transaction_hash, amount: r.amount };
    }
  }
  return null;
}

/** Stellar Expert explorer URL for a tx hash (receipt link in the SCF evidence). */
export function stellarExpertTxUrl(network: Network, hash: string): string {
  const net = network === 'mainnet' ? 'public' : 'testnet';
  return `https://stellar.expert/explorer/${net}/tx/${hash}`;
}
