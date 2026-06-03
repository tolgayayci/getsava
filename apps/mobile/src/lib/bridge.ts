import { ensureUsdcTrustline, type SignRawHashFn, sendUsdcViaXlm } from '@getsava/sdk-stellar';
import { NETWORK } from './network';

const BRIDGE_SECRET = process.env.EXPO_PUBLIC_BRIDGE_SECRET;

/** XLM the treasury may spend per 1 USDC (generous cap; live DEX ≈ 1.5 XLM/USDC). */
const XLM_PER_USDC_MAX = 20;

/** True when the testnet treasury bridge is configured (testnet + secret present). */
export function bridgeEnabled(): boolean {
  return NETWORK === 'testnet' && Boolean(BRIDGE_SECRET);
}

/**
 * TESTNET deposit bridge (BRIDGE_TESTNET). Stands in for Mercuryo settlement
 * until the sandbox is live: ensure the user holds the USDC trustline
 * (Privy-signed), then the Sava TREASURY buys `amountUsdc` of real Circle testnet
 * USDC with its XLM on the Stellar DEX and delivers it to the user in one atomic
 * path payment — the same asset Blend's pool accepts. Returns the real Stellar tx
 * hash (links to Stellar Expert). Removed at mainnet, where Mercuryo settles
 * Circle USDC directly.
 */
export async function deliverDeposit(input: {
  userAddress: string;
  amountUsdc: string;
  signRawHash: SignRawHashFn;
  orderId: string;
}): Promise<string> {
  if (!BRIDGE_SECRET) {
    throw new Error('Deposit bridge not configured (EXPO_PUBLIC_BRIDGE_SECRET)');
  }
  // 1. The user must hold the USDC trustline to receive (no-op if it exists).
  await ensureUsdcTrustline(NETWORK, input.userAddress, input.signRawHash);
  // 2. The treasury buys exact USDC with XLM on the DEX and delivers it.
  const sendMaxXlm = (Number(input.amountUsdc) * XLM_PER_USDC_MAX).toFixed(7);
  const { hash } = await sendUsdcViaXlm({
    network: NETWORK,
    sourceSecret: BRIDGE_SECRET,
    destination: input.userAddress,
    usdcAmount: input.amountUsdc,
    sendMaxXlm,
    memo: `deposit ${input.orderId.slice(0, 8)}`,
  });
  return hash;
}
