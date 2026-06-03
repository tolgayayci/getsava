/**
 * Live testnet proof for Deliverable 3 — supply → yield → withdraw round-trip.
 *
 * Manual script (NOT part of CI). Uses a fresh Friendbot-funded testnet keypair,
 * signing locally with that keypair via a SignRawHashFn shim that mirrors Privy's
 * raw-hash signer. Each on-chain leg prints a real Stellar Expert tx hash.
 *
 *   pnpm --filter @getsava/sdk-blend exec tsx scripts/roundtrip.ts
 */
import {
  blendConfig,
  buildSupplyTx,
  buildWithdrawTx,
  loadPool,
  readReserveSnapshot,
  readUserPosition,
  signAndSubmit,
} from '@getsava/sdk-blend';
import {
  ensureUsdcTrustline,
  getBalances,
  type SignRawHashFn,
  sendUsdcViaXlm,
  stellarExpertTxUrl,
} from '@getsava/sdk-stellar';
import { Keypair } from '@stellar/stellar-base';

const NETWORK = 'testnet' as const;

/** Local raw-hash signer mirroring Privy's useSignRawHash (raw Ed25519 over the 32-byte tx hash). */
function localSigner(kp: Keypair): SignRawHashFn {
  return async ({ hash }) => {
    const sig = kp.sign(Buffer.from(hash.slice(2), 'hex'));
    return { signature: `0x${sig.toString('hex')}` };
  };
}

function log(step: string, detail = '') {
  console.log(`\n▶ ${step}${detail ? `  ${detail}` : ''}`);
}

async function main() {
  const cfg = blendConfig(NETWORK);
  const kp = Keypair.random();
  const user = kp.publicKey();
  const sign = localSigner(kp);
  console.log('Test wallet:', user);
  console.log('Pool:', cfg.poolId, '| USDC SAC:', cfg.usdcSac);

  log('1) Fund + USDC trustline (Friendbot)');
  await ensureUsdcTrustline(NETWORK, user, sign);

  log('2) Buy 30 USDC via XLM→USDC DEX path payment');
  const buy = await sendUsdcViaXlm({
    network: NETWORK,
    sourceSecret: kp.secret(),
    destination: user,
    usdcAmount: '30.0000000',
    sendMaxXlm: '900.0000000',
  });
  console.log('  DEX buy tx:', stellarExpertTxUrl(NETWORK, buy.hash));
  let bal = await getBalances(NETWORK, user);
  console.log('  balances:', bal);

  log('3) SUPPLY 20 USDC to Blend');
  const supplyBuild = await buildSupplyTx(cfg, user, 20);
  const supply = await signAndSubmit(NETWORK, supplyBuild.preparedXdr, user, sign);
  console.log(`  supply ${supply.status}:`, stellarExpertTxUrl(NETWORK, supply.hash));

  log('4) Read position + APY');
  let pool = await loadPool(cfg);
  const snap = readReserveSnapshot(pool, cfg.usdcSac);
  console.log(
    `  supply APY: ${(snap.supplyApy * 100).toFixed(4)}%  | util: ${(snap.utilization * 100).toFixed(2)}%  | TVL: ${snap.totalSupply.toFixed(2)} USDC | status: ${snap.status}`,
  );
  let pos = await readUserPosition(pool, user, cfg.usdcSac);
  console.log(`  position: ${pos.suppliedUsdc.toFixed(7)} USDC (${pos.bTokens} bTokens)`);

  log('5) WITHDRAW 50% (10 USDC, partial)');
  const w1Build = await buildWithdrawTx(cfg, user, { kind: 'partial', humanUsdc: 10 });
  const w1 = await signAndSubmit(NETWORK, w1Build.preparedXdr, user, sign);
  console.log(`  withdraw ${w1.status}:`, stellarExpertTxUrl(NETWORK, w1.hash));
  pool = await loadPool(cfg);
  pos = await readUserPosition(pool, user, cfg.usdcSac);
  console.log(`  position after 50%: ${pos.suppliedUsdc.toFixed(7)} USDC`);

  log('6) WITHDRAW ALL (I128MAX, full exit)');
  const w2Build = await buildWithdrawTx(cfg, user, { kind: 'all' });
  const w2 = await signAndSubmit(NETWORK, w2Build.preparedXdr, user, sign);
  console.log(`  withdraw ${w2.status}:`, stellarExpertTxUrl(NETWORK, w2.hash));
  pool = await loadPool(cfg);
  pos = await readUserPosition(pool, user, cfg.usdcSac);
  console.log(`  position after full: ${pos.suppliedUsdc.toFixed(7)} USDC`);
  bal = await getBalances(NETWORK, user);
  console.log('  final wallet balances:', bal);

  console.log('\n✅ ROUND-TRIP COMPLETE');
  console.log('  supply   :', supply.status, supply.hash);
  console.log('  wd 50%   :', w1.status, w1.hash);
  console.log('  wd full  :', w2.status, w2.hash);
}

main().catch((e) => {
  console.error('\n❌ ROUND-TRIP FAILED:', e?.message ?? e);
  if (e?.stack) console.error(e.stack);
  process.exit(1);
});
