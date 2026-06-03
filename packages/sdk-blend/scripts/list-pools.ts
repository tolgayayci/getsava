/**
 * Diagnostic: discover Blend v2 pools on testnet and rank them by USD liquidity.
 *
 *   pnpm --filter @getsava/sdk-blend exec tsx scripts/list-pools.ts
 *
 * Pools are discovered from the pool-factory's deploy events (best-effort over the
 * RPC's retained ledger window) plus a couple of known addresses, then each pool
 * is loaded and its reserves priced via the pool oracle.
 */
import { BackstopConfig, PoolV2 } from '@blend-capital/blend-sdk';

const RPC = 'https://soroban-testnet.stellar.org';
const PASSPHRASE = 'Test SDF Network ; September 2015';
const BACKSTOP = 'CBDVWXT433PRVTUNM56C3JREF3HIZHRBA64NB2C3B2UNCKIS65ZYCLZA';
const KNOWN = [
  'CAPBMXIQTICKWFPWFDJWMAKBXBPJZUKLNONQH3MLPLLBKQ643CYN5PRW', // Sava — Circle USDC
  'CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF', // canonical TestnetV2
];
const net = { rpc: RPC, passphrase: PASSPHRASE };

/** Discover pools from the backstop reward-zone (the on-chain registry of blessed pools). */
async function discoverPools(): Promise<Set<string>> {
  const pools = new Set<string>(KNOWN);
  try {
    const cfg = await BackstopConfig.load(net, BACKSTOP);
    for (const p of cfg.rewardZone) pools.add(p);
    console.log(`Backstop reward-zone lists ${cfg.rewardZone.length} pool(s).`);
  } catch (e) {
    console.error('reward-zone load failed (using known pools only):', (e as Error)?.message);
  }
  return pools;
}

interface PoolRow {
  id: string;
  status: number;
  totalUsd: number;
  reserves: Array<{ asset: string; tvl: number; priceUsd: number; usd: number }>;
}

async function main() {
  const ids = await discoverPools();
  console.log(`Discovered ${ids.size} candidate pool(s). Loading + pricing…\n`);

  const rows: PoolRow[] = [];
  for (const id of ids) {
    try {
      const pool = await PoolV2.load(net, id);
      let oracle: Awaited<ReturnType<PoolV2['loadOracle']>> | null = null;
      try {
        oracle = await pool.loadOracle();
      } catch {
        /* oracle undecodable on some testnet pools — fall back to raw TVL */
      }
      const reserves: PoolRow['reserves'] = [];
      let totalUsd = 0;
      for (const [asset, reserve] of pool.reserves) {
        const tvl = reserve.totalSupplyFloat();
        let priceUsd = 0;
        try {
          priceUsd = oracle?.getPriceFloat(asset) ?? 0;
        } catch {
          /* asset not in oracle */
        }
        const usd = tvl * priceUsd;
        totalUsd += usd;
        reserves.push({ asset, tvl, priceUsd, usd });
      }
      rows.push({ id, status: pool.metadata.status, totalUsd, reserves });
    } catch (e) {
      console.error(`  — ${id.slice(0, 10)}… failed to load:`, (e as Error)?.message?.slice(0, 70));
    }
  }

  rows.sort((a, b) => b.totalUsd - a.totalUsd);

  console.log('Blend v2 testnet pools — highest → lowest liquidity (USD, oracle-priced):\n');
  for (const r of rows) {
    const sava = r.id === KNOWN[0] ? '  ← Sava uses this' : '';
    console.log(
      `$${r.totalUsd.toLocaleString('en-US', { maximumFractionDigits: 0 }).padStart(14)}  ${r.id}  status ${r.status}${sava}`,
    );
    const top = [...r.reserves].sort((a, b) => b.usd - a.usd).slice(0, 4);
    for (const rv of top) {
      console.log(
        `                 ${rv.tvl.toLocaleString('en-US', { maximumFractionDigits: 0 }).padStart(14)} units  @ $${rv.priceUsd.toFixed(2)}  = $${rv.usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}   ${rv.asset.slice(0, 8)}…`,
      );
    }
    console.log('');
  }
}

main().catch((e) => {
  console.error('FAILED:', e?.message ?? e);
  process.exit(1);
});
