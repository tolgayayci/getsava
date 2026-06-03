import { ensureUsdcTrustline, type SignRawHashFn, sendUsdc } from '@getsava/sdk-stellar';
import { NETWORK } from './network';

const BRIDGE_SECRET = process.env.EXPO_PUBLIC_BRIDGE_SECRET;

/** True when the testnet treasury bridge is configured (testnet + secret present). */
export function bridgeEnabled(): boolean {
  return NETWORK === 'testnet' && Boolean(BRIDGE_SECRET);
}

/**
 * TESTNET deposit bridge (BRIDGE_TESTNET). Stands in for Mercuryo settlement
 * until the sandbox is live: ensure the user holds the USDC trustline
 * (Privy-signed), then the Sava TREASURY TRANSFERS `amountUsdc` of real Circle
 * testnet USDC (topped up from faucet.circle.com — the same asset Blend's pool
 * accepts) to the user, returning the real Stellar tx hash (links to Stellar
 * Expert). Removed at mainnet, where Mercuryo settles Circle USDC directly.
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
  // 1. The user must trust the issuer before it can mint to them (no-op if the
  //    trustline already exists).
  await ensureUsdcTrustline(NETWORK, input.userAddress, input.signRawHash);
  // 2. The issuer mints USDC to the user.
  const { hash } = await sendUsdc({
    network: NETWORK,
    sourceSecret: BRIDGE_SECRET,
    destination: input.userAddress,
    amount: input.amountUsdc,
    memo: `deposit ${input.orderId.slice(0, 8)}`,
  });
  return hash;
}
