import { networkConfig } from '@getsava/sdk-stellar';
import type { Network } from '@getsava/types';

/**
 * Reconstruct the USDC cost basis of the wallet's Blend position from on-chain
 * history — the provable source of truth that survives reinstalls and supplies
 * made outside the app (the off-chain counter drifts; this doesn't).
 *
 * USDC is conserved: everything ever RECEIVED either sits in the wallet, was
 * SENT out, or was supplied into the pool. So
 *   basis (cost of the pool position) = receivedUSDC − sentUSDC − walletUSDC
 * and earned = poolValueNow − basis. Verified against a live account:
 * 112.195 received − 0 sent − 52.195 wallet = 60.000 basis; pool 60.012 → +0.012.
 *
 * Returns null on any read failure → the caller keeps its current basis.
 */
interface PaymentRecord {
  readonly to?: string;
  readonly from?: string;
  readonly asset_code?: string;
  readonly asset_issuer?: string;
  readonly amount?: string;
}

export async function reconstructBasisUsdc(
  network: Network,
  address: string,
): Promise<number | null> {
  const cfg = networkConfig(network);
  const isUsdc = (r: { asset_code?: string; asset_issuer?: string }) =>
    r.asset_code === cfg.usdc.code && r.asset_issuer === cfg.usdc.issuer;
  try {
    const acct = await fetch(`${cfg.horizonUrl}/accounts/${address}`).then((r) =>
      r.ok
        ? (r.json() as Promise<{
            balances?: { asset_code?: string; asset_issuer?: string; balance?: string }[];
          }>)
        : null,
    );
    if (!acct) {
      return null;
    }
    const walletUsdc = Number((acct.balances ?? []).find(isUsdc)?.balance ?? 0);

    let credits = 0;
    let debits = 0;
    let url: string | null = `${cfg.horizonUrl}/accounts/${address}/payments?limit=200&order=asc`;
    for (let page = 0; url && page < 6; page++) {
      const body: {
        _embedded?: { records?: PaymentRecord[] };
        _links?: { next?: { href?: string } };
      } | null = await fetch(url).then((r) => (r.ok ? r.json() : null));
      const recs: PaymentRecord[] = body?._embedded?.records ?? [];
      for (const r of recs) {
        if (!isUsdc(r) || r.amount == null) {
          continue;
        }
        const a = Number(r.amount);
        if (r.to === address) {
          credits += a;
        }
        if (r.from === address) {
          debits += a;
        }
      }
      // Only follow pagination when the page was full (more may remain).
      url = recs.length === 200 ? (body?._links?.next?.href ?? null) : null;
    }

    const basis = credits - debits - walletUsdc;
    return basis > 0 ? basis : 0;
  } catch {
    return null;
  }
}
