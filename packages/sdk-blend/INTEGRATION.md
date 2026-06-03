# Blend v2 Integration Spec — Sava Earn (`@getsava/sdk-blend`)

**Status:** AUTHORITATIVE, implementation-ready. Supply-only.
**SDK target:** `@blend-capital/blend-sdk@3.2.2` (latest stable on npm, published 2025-12-30; locally installed copy matches — no version drift).
**Network:** Stellar TESTNET for the grant demo. All addresses below are testnet.
**Reconciliation rule applied:** official docs + live RPC + installed SDK source override the reference MVP (`reference-mvp/stellarkasa`) wherever they disagree. The MVP is treated as example-only and several of its pieces are explicitly rejected (see §11).

---

## 1. TL;DR — call sequences

### Supply (deposit USDC → bTokens)
```ts
// 0. assertSafeRequestType(RequestType.SupplyCollateral)   // guardrail, throws on anything else
const op = xdr.Operation.fromXDR(
  new PoolContractV2(POOL_ID).submit({                       // V2 class, not abstract PoolContract
    from: user, spender: user, to: user,                    // all = user's Privy G-address
    requests: [{ request_type: RequestType.SupplyCollateral /*=2*/, address: USDC_SAC,
                 amount: BigInt(Math.round(human * 1e7)) }], // USDC = 7 decimals
  }), 'base64');
const src = new Account(user, (await fetchAccount(NETWORK, user)).sequence);   // reuse sdk-stellar
const tx  = new TransactionBuilder(src, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
              .addOperation(op).setTimeout(300).build();
const prepared = await rpc.prepareTransaction(tx);          // simulate + assemble (footprint, fee, auth)
const signed   = await signTransaction(NETWORK, prepared.toXDR(), user, signRawHash); // sdk-stellar, unchanged
const { hash } = await rpc.sendTransaction(signed);
await rpc.pollTransaction(hash, { attempts: 15 });          // SUCCESS / FAILED; NOT_FOUND = keep polling
// → stellarExpertTxUrl(NETWORK, hash)
```
**Source-account auth suffices** (`from === source === signer`): signing `tx.hash()` once authorizes the whole invocation. NO separate `authorizeEntry` / auth-entry signing.

### Withdraw (bTokens → USDC)
Identical pipeline; only the request changes:
```ts
requests: [{ request_type: RequestType.WithdrawCollateral /*=3*/, address: USDC_SAC,
             amount: PARTIAL ? BigInt(Math.round(human * 1e7)) : I128MAX }]   // I128MAX = full exit
```
`I128MAX` (exported by the SDK) is clamped on-chain to the user's actual position → clean "withdraw all" with no dust. Withdraw can **fail at simulate-time** if the reserve lacks unborrowed liquidity (high utilization) — surface "insufficient pool liquidity, try smaller / later", do not assume it always succeeds.

---

## 2. Dependencies & versions

### Packages to add to `@getsava/sdk-blend`
| Package | Version | Why |
|---|---|---|
| `@blend-capital/blend-sdk` | `3.2.2` (latest stable; pin exact) | `PoolContractV2.submit`, `PoolV2.load`, `ReserveV2`, `RequestType`, `I128MAX`, estimators |
| `@stellar/stellar-sdk` | `^14.4.3` | Soroban RPC (`rpc.Server`, `prepareTransaction`, `assembleTransaction`, `simulateTransaction`, `sendTransaction`, `pollTransaction`). **Import the `/rpc` subpath only.** |
| `@getsava/sdk-stellar` | workspace | config, `fetchAccount`, `signTransaction`/`attachSignature`, `SignRawHashFn`, `stellarExpertTxUrl` |
| `@getsava/types` | workspace | `Network` |
| `buffer` | `^6.0.3` (already in mobile) | XDR `Buffer` under Hermes |

> The reference MVP avoids `@stellar/stellar-sdk` entirely and hand-rolls JSON-RPC over `fetch`. We do **not** do that — we use `@stellar/stellar-sdk/rpc` for simulate/assemble/send/poll so footprint + resource-fee + auth-entry assembly is handled by the SDK, not re-implemented (the MVP's hand-rolled `simulateAndPrepare` is a known source of fee/auth bugs).

### The stellar-base@13 vs stellar-sdk@14 conflict — CHOSEN RESOLUTION
- `@getsava/sdk-stellar` currently depends on **`@stellar/stellar-base@13.1.0`** (no Soroban RPC; capability-probed: `Operation.invokeHostFunction`, `Contract`, `Address`, `xdr`, `scValToNative` ✅, but `rpc`/`Server`/`SorobanRpc` = `undefined`).
- `@blend-capital/blend-sdk@3.2.2` declares **`@stellar/stellar-sdk@14.4.3`** as a dependency (verified from blend-sdk's `package.json`), and `@stellar/stellar-sdk@14` **bundles** `@stellar/stellar-base@14`.
- Two stellar-base majors in one tree (13 vs 14) means `Transaction`/`xdr.*` objects from one fail `instanceof`/XDR-identity checks in the other → silent `tx.hash()`/`addSignature`/`assembleTransaction` cross-package failures.

**RESOLUTION (do this):**
1. **Bump `@getsava/sdk-stellar` to `@stellar/stellar-base@^14`** (and matching `@stellar/js-xdr`) to align with what `@stellar/stellar-sdk@14.4.3` bundles.
2. Add a root **`pnpm.overrides` forcing a single `@stellar/stellar-base@14.x`** across the whole tree (blend-sdk, stellar-sdk, sdk-stellar, sdk-blend, Privy).
3. Cross the package boundary with **base64 XDR strings only** (wire-format, version-stable) — never pass live `Transaction`/`xdr.*` objects between packages. Practical rule: take `prepared.toXDR()` and feed the string into sdk-stellar's `signTransaction`.
4. ⚠️ Before bumping, grep for any other 13.x pin (Privy SDK) and re-verify there is exactly one resolved stellar-base after `pnpm install`.

> NOTE on a cross-section conflict: one research stream read `^15.0.1` (the reference-MVP's own `package.json` pin / a newer stellar-sdk it installed), another read `14.4.3` from blend-sdk's declared dependency. We pin to **blend-sdk's declared `@stellar/stellar-sdk@14.4.3`** because that is the version blend-sdk@3.2.2 is built against; going to 15 would require overriding blend-sdk's own dep. (⚠️ verify at install time that 14.4.3 resolves cleanly with blend-sdk; if blend-sdk's range actually permits 15, align everything to one of 14 or 15 — the invariant is *one* stellar-base, not which major.)

### RN / Expo / Hermes polyfills (mobile)
- **Buffer:** `global.Buffer = require('buffer').Buffer` at the very top of the app entry, before any stellar/blend import — `xdr.Operation.fromXDR` / `tx.hash()` use Node `Buffer`; Hermes lacks it.
- **Randomness:** `import 'react-native-get-random-values'` as the first line of the entry file — stellar-sdk/blend-sdk need `crypto.getRandomValues`. (Already shipped: `react-native-get-random-values`, `expo-crypto`.)
- **Metro package exports:** set `resolver.unstable_enablePackageExports = true` in `metro.config.js` so the `@stellar/stellar-sdk/rpc` subpath resolves under Hermes.
- Import RPC subpath only (`import { rpc } from '@stellar/stellar-sdk'` resolves the bundle; prefer `import { Server } from '@stellar/stellar-sdk/rpc'`) to avoid pulling Horizon (`eventsource`→Node `http/https`) into the bundle.

---

## 3. `@getsava/sdk-blend` — public API design (supply-only surface)

All `@blend-capital/blend-sdk` imports live **only** inside this package (lint rule bans direct imports elsewhere). Network values come from `networkConfig(network)` in `@getsava/sdk-stellar`.

### Types
```ts
import type { Network } from '@getsava/types';
import type { SignRawHashFn } from '@getsava/sdk-stellar';

export interface BlendNetworkConfig {           // extends sdk-stellar config with Blend addresses
  readonly poolId: string;                      // POOL_ID (see §8)
  readonly usdcSac: string;                     // USDC Soroban SAC contract id (C…)
  readonly backstopId: string;
  readonly oracleId: string;
}

export interface ReserveSnapshot {
  readonly assetId: string;            // USDC SAC
  readonly index: number;              // reserve index in the pool (DO NOT hardcode; read from pool)
  readonly decimals: number;           // 7 for USDC
  readonly supplyApr: number;          // decimal fraction, e.g. 0.0345
  readonly supplyApy: number;          // estSupplyApy, weekly-compounded — HEADLINE base APY
  readonly emissionsApy: number | null;// null when supplyEmissions undefined or no BLND price
  readonly totalSupply: number;        // underlying USDC (TVL leg)
  readonly totalBorrowed: number;
  readonly utilization: number;        // 0..1
  readonly bRate: bigint;              // V2: scaled by 1e12
  readonly status: number;             // pool status integer 0..6
}

export interface UserPosition {
  readonly bTokens: bigint;
  readonly suppliedUsdc: number;       // toAssetFromBTokenFloat(bTokens)
}

export interface BackstopHealth {
  readonly totalSpotValueUsd: number;  // backstop coverage size
  readonly q4wPercentage: number;      // fraction queued-for-withdrawal (0..1)
}
```

### Read surface
```ts
export async function loadPool(net: Network, cfg: BlendNetworkConfig): Promise<PoolV2>;        // PoolV2.load
export function getReserve(pool: PoolV2, usdcSac: string): ReserveV2;                           // pool.reserves.get
export function getSupplyApy(reserve: ReserveV2): number;                                       // reserve.estSupplyApy
export function readReserveSnapshot(pool: PoolV2, usdcSac: string): ReserveSnapshot;
export async function readUserPosition(pool: PoolV2, user: string, usdcSac: string): Promise<UserPosition>;
export async function readBackstopHealth(net: Network, cfg: BlendNetworkConfig): Promise<BackstopHealth>;
```

### Write surface (build → prepare → sign → submit)
```ts
export interface BuildResult { readonly preparedXdr: string; }   // post-simulation, ready to sign

export async function buildSupplyTx(
  net: Network, cfg: BlendNetworkConfig, user: string, humanUsdc: number,
): Promise<BuildResult>;

export async function buildWithdrawTx(
  net: Network, cfg: BlendNetworkConfig, user: string,
  mode: { kind: 'partial'; humanUsdc: number } | { kind: 'all' },     // 'all' → I128MAX
): Promise<BuildResult>;

export async function signAndSubmit(
  net: Network, preparedXdr: string, user: string, signRawHash: SignRawHashFn,
): Promise<{ hash: string; status: 'SUCCESS' | 'FAILED' }>;

export function parseSubmitResult(resultXdr: string): Positions;     // PoolContractV2.parsers.submit
```

### The RequestType narrowing guardrail (D1 supply-only invariant, enforced in code)
```ts
import { RequestType } from '@blend-capital/blend-sdk';

export const ALLOWED_REQUEST_TYPES = [
  RequestType.SupplyCollateral,    // = 2
  RequestType.WithdrawCollateral,  // = 3
] as const;

export type SafeRequestType = (typeof ALLOWED_REQUEST_TYPES)[number];

export function assertSafeRequestType(rt: RequestType): asserts rt is SafeRequestType {
  if (rt !== RequestType.SupplyCollateral && rt !== RequestType.WithdrawCollateral) {
    throw new Error(`[sdk-blend] forbidden request_type ${rt}; supply-only allows 2/3 only`);
  }
}
```
Every `Request` built inside `buildSupplyTx`/`buildWithdrawTx` is run through `assertSafeRequestType` before the op is constructed. `Borrow(4)`, `Repay(5)`, and all auction fills (`6/7/8/9`) are unreachable.

**Decision — SupplyCollateral (2/3), not Supply (0/1):** both earn the same supply APY (docs-confirmed: borrower interest is distributed to all lenders regardless of collateral designation); collateral-marking is harmless because Sava never borrows. The MVP and the official README both use the Collateral variants. CONSEQUENCE: the user's bTokens land in the **collateral** map → read positions via `getCollateral`/`getCollateralFloat`/`getCollateralBTokens`, NOT `getSupply*`. This must be consistent across deposit, withdraw, and balance reads or D4 reads 0.

### What it imports vs. builds new
- **From `@getsava/sdk-stellar` (reuse, do not duplicate):** `networkConfig` (rpcUrl/passphrase/usdc), `fetchAccount` (source sequence), `signTransaction`/`transactionHashHex`/`attachSignature` (Privy raw-hash, unchanged), `SignRawHashFn`/`Hex` types, `getBalances`/`findUsdcSettlement` (pre/post checks), `stellarExpertTxUrl` (receipts).
- **New Soroban-RPC plumbing (sdk-stellar's stellar-base@13/14 has no RPC; its `submitTransaction` is Horizon-only and WRONG for Soroban):** a thin wrapper over `@stellar/stellar-sdk/rpc` `Server` exposing `prepareTransaction`, `sendTransaction`, `pollTransaction`, keyed off `networkConfig(net).rpcUrl`. Do **not** reuse `@getsava/sdk-stellar`'s `submitTransaction` (Horizon `POST /transactions`).

---

## 4. Supply flow — every step with real SDK calls

1. **Guardrail:** `assertSafeRequestType(RequestType.SupplyCollateral)`.
2. **Build op:** `new PoolContractV2(POOL_ID).submit({ from:user, spender:user, to:user, requests:[{ request_type: RequestType.SupplyCollateral, address: USDC_SAC, amount: BigInt(Math.round(human*1e7)) }] })` → base64 op XDR. `from`=position owner, `spender`=token sender, `to`=token receiver — all the user's G-address.
3. **Decode:** `op = xdr.Operation.fromXDR(opB64, 'base64')` (invokeHostFunction op).
4. **Source account:** `src = new Account(user, (await fetchAccount(NETWORK, user)).sequence)`. Source MUST be the user's Privy wallet — this is what makes source-account auth work (step 7).
5. **TransactionBuilder:** `new TransactionBuilder(src, { fee: BASE_FEE /* "100" */, networkPassphrase: PASSPHRASE }).addOperation(op).setTimeout(300).build()`.
6. **Simulate + assemble/prepare:** `const prepared = await server.prepareTransaction(tx)`. This runs `simulateTransaction` (returns footprint = R/W ledger keys, `minResourceFee` + `SorobanTransactionData`, and auth trees) then `assembleTransaction` internally, returning a **new unsigned** `Transaction` with footprint + resource fee baked in and the final fee = inclusion fee + `minResourceFee`. This IS the project-mandated **simulate-before-submit** guardrail. Surface `restorePreamble` (archived-entry restore) and sim errors here, before asking the user to sign.
7. **Auth — source-account suffices, NO separate auth-entry signing:** Blend's `submit` calls `from.require_auth()`. Because `from === source === the signer`, Soroban `SorobanCredentials::SourceAccount` applies: the transaction envelope signature implicitly authorizes the contract invocation. No `authorizeEntry`, no second simulation, no per-entry signature. (This holds ONLY while source = user. If a server ever becomes fee-payer/source while user is `from`, you'd need `SorobanAddressCredentials` + `authorizeEntry` — explicitly out of scope; keep source = user.)
8. **Hash the PREPARED tx:** `transactionHashHex(NETWORK, prepared.toXDR())` → `0x…`. MUST hash post-prepare: preparation changes fee + adds `SorobanTransactionData`, so the envelope bytes and `tx.hash()` change. Order is **build → prepare → hash → sign → attach → submit**; never hash before preparing.
9. **Privy raw-hash sign:** `signRawHash({ address: user, chainType: 'stellar', hash })` → `{ signature: 0x… }` (raw Ed25519 over the 32-byte hash). Identical to the classic-payment signer; no signer code change.
10. **Attach:** `attachSignature(NETWORK, prepared.toXDR(), user, signatureHex)` → decodes hex→base64→`tx.addSignature(user, sigB64)` → signed envelope XDR. (Or call `prepared.addSignature(user, sigB64)` directly on the prepared object — same stellar-base version required.)
11. **Submit:** `const sent = await server.sendTransaction(signed)`. `sent.status ∈ PENDING|DUPLICATE|TRY_AGAIN_LATER|ERROR`; on ERROR inspect `errorResult`/`diagnosticEvents` and throw. `sent.hash` = the Stellar Expert tx hash.
12. **Poll:** `await server.pollTransaction(sent.hash, { attempts: 15 })`. Terminal = `SUCCESS` / `FAILED`; `NOT_FOUND` = still pending, keep polling.
13. **Receipt:** `stellarExpertTxUrl(NETWORK, hash)` → `https://stellar.expert/explorer/testnet/tx/{hash}` (use Stellar Expert; the MVP linked stellarchain.io — replace it).
14. **Post:** optionally re-read balance/position (Horizon lags Soroban RPC — retry a couple of times) and `parseSubmitResult` to confirm the new on-chain `Positions`.

---

## 5. Withdraw flow

Pipeline identical to §4 with `request_type: RequestType.WithdrawCollateral (=3)`; only the amount differs.

- **Partial (e.g. 50%):** read current `suppliedUsdc` via `readUserPosition`, compute `human = suppliedUsdc * 0.5`, `amount = BigInt(Math.round(human * 1e7))`. (For exact bToken sizing use `reserve.toBTokensFromAssetFloor(asset)` to avoid burning more than held.)
- **Full ("withdraw all"):** `amount = I128MAX` (SDK export = `170141183460469231731687303715884105727`). The contract clamps it to the user's actual position → entire balance withdrawn in one tx with no dust and no race against interest accrual. **Do NOT** snapshot the balance with `.toFixed(2)` (the MVP's approach) — it strands accrued-interest dust and is racy.
- **Liquidity gating:** withdraw is gated by available (unborrowed) liquidity, not just pool status. If utilization is near 100%, a large withdraw can be **blocked at simulate-time**. Catch the sim failure and show "insufficient pool liquidity — try a smaller amount or try again later". Withdrawals remain allowed in every pool status except `Setup(6)` (see §6), so the circuit breaker never traps user funds.

---

## 6. Reading pool / reserve / backstop state

Load once with `PoolV2.load(network, poolId)` (network = `{ rpc, passphrase, opts? }`). `Pool.load` is **not** a static on the abstract base — use `PoolV2.load`. Loading auto-runs `reserve.accrue()` → `setRates()`, so APY/APR/rate fields are already populated and projected to load-time.

```ts
const pool = await PoolV2.load(network, POOL_ID);          // Map<assetId, ReserveV2>, metadata, timestamp
const reserve = pool.reserves.get(USDC_SAC) as ReserveV2;
```

| Datum | Exact field / method | Units / notes |
|---|---|---|
| **Supply APY (base)** | `reserve.estSupplyApy` | decimal; **weekly-compounded** `(1+supplyApr/52)^52−1`. HEADLINE. Do not hand-roll. |
| Supply APR | `reserve.supplyApr` | decimal, not compounded |
| Borrow APR / APY | `reserve.borrowApr` / `reserve.estBorrowApy` | APY uses daily comp `/365` |
| **TVL** | `reserve.totalSupplyFloat()` (or `.totalSupply(): bigint`) | underlying USDC supplied = `bSupply×bRate` |
| Total borrowed | `reserve.totalLiabilitiesFloat()` | |
| **Utilization** | `reserve.getUtilizationFloat()` (`.getUtilization(): bigint`, 7-dec) | `totalLiabilities/totalSupply` |
| **bRate** | `reserve.data.bRate: bigint` | **V2 scaled by 1e12** (`rateDecimals=12`); V1 was 1e9 — get this from the typed `ReserveV2`, never magnitude-guess |
| dRate / supplies | `reserve.data.dRate`, `.bSupply`, `.dSupply`, `.backstopCredit`, `.interestRateModifier` | V2 `irmodDecimals=7` |
| Config | `reserve.config` (`ReserveConfigV2`) | `decimals`(7), `util`(target,7-dec), `max_util`, `r_base/r_one/r_two/r_three`, `reactivity`, V2-only `supply_cap`, `enabled` |
| bToken↔asset | `reserve.toAssetFromBTokenFloat(bTokens)`, `reserve.toBTokensFromAssetFloor(asset)` | use these, not manual math |
| Emissions | `reserve.supplyEmissions?: Emissions` (V2: `EmissionsV2`) | `undefined` if none; `emissionsPerYearPerToken(bSupply, decimals)` |
| **Pool status** | `pool.metadata.status` / `PoolConfig.status` (integer) | ground truth (see enum below) |
| Backstop take rate | `pool.metadata.backstopRate` (7-dec) | feeds `supplyApr`; pass to `Reserve.load`/`setRates` |
| Oracle | `await pool.loadOracle()` → `PoolOracle`; `.getPriceFloat(assetId)` | systemic-risk only for supply-only |
| **Backstop coverage** | `BackstopPoolV2.load(net, backstopId, poolId)` → `.poolBalance{shares,tokens,q4w}`; `BackstopPoolEst.build(backstop.backstopToken, pool.poolBalance)` → `.totalSpotValue`, `.q4wPercentage` | coverage size + fraction queued |
| User position | `pool.loadUser(user)` → `PoolUser`; `.getCollateralFloat(reserve)` / `.getCollateralBTokens(reserve)` | use **collateral** map (we use SupplyCollateral) |
| Net APY incl. emissions | `PositionsEstimate.build(pool, oracle, poolUser.positions).netApy` | only if emissions priced |

**Pool status integer enum** (ground truth; map for Sava):
| status | Name | Supply | Withdraw | Borrow |
|---|---|---|---|---|
| 0 | Admin_Active | ✓ | ✓ | ✓ |
| 1 | Active | ✓ | ✓ | ✓ |
| 2 | Admin_On_Ice | ✓ | ✓ | ✗ |
| 3 | On_Ice | ✓ | ✓ | ✗ |
| 4 | Admin_Frozen | ✗ | ✓ | ✗ |
| 5 | Frozen | ✗ | ✓ | ✗ |
| 6 | Setup | ✗ | ✗ | ✗ |

Sava mapping: `{0,1}` = supply+withdraw OK; `{2,3}` = supply OK but show warning; `{4,5}` = DO NOT SUPPLY (mint blocked on-chain) but withdraw still works; `6` = pool not live, block everything. **Withdrawals are open in every state except Setup.** ⚠️ The enum integer mapping (Admin_Active=0…Setup=6) was assembled from a docs page + SDK `setStatus` docstring (admin may set 0/2/4) but the raw 0–6 enum was not seen in SDK types — see §11.

---

## 7. APY & yield math

### Supply APR/APY (exact, matches on-chain within ±0.1% if you use the SDK fields)
With `U = utilization`, `U_T = config.util`, `RM = data.interestRateModifier` (V2: 7-dec), rates 7-dec:
```
U == 0        → borrowApr = r_base ;  supplyApr = 0           // empty reserve pays 0% supply
U ≤ U_T       → curIr = RM × ((U/U_T)·r_one + r_base)
U_T < U ≤ .95 → curIr = RM × (((U−U_T)/(.95−U_T))·r_two + r_one + r_base)
U > .95       → curIr = ((U−.95)/.05)·r_three + RM×(r_two + r_one + r_base)   // r_three NOT ×RM
```
Then the backstop skim the docs omit but the SDK applies:
```
supplyApr    = borrowApr × U × (1 − backstopTakeRate)        // backstopTakeRate = pool.metadata.backstopRate, 7-dec
estSupplyApy = (1 + supplyApr/52)^52 − 1                     // weekly compounding
```
**To match within ±0.1%: read `reserve.estSupplyApy` after `PoolV2.load` accrued to "now".** Do NOT use the MVP's `borrowApy × util × 0.5` (hardcoded 0.5 take rate, 2-piece linear IR, no IR modifier, no emissions) — it is wrong.

### Emissions (second leg, optional, off-chain price)
`estSupplyApy` is **interest-only**. Total = base + emissions APY:
```
blndPerYrPerBToken = reserve.supplyEmissions?.emissionsPerYearPerToken(reserve.data.bSupply, reserve.config.decimals) ?? 0
emissionsApy       = blndPerYrPerBToken × BLND_price_usd / (bRateFloat × USDC_price_usd)
```
BLND price is not in the lending oracle and often has no testnet market. **Show base `estSupplyApy` as the headline (provably matches chain); add emissions only if `reserve.supplyEmissions !== undefined` AND a BLND price exists**, else label "+ BLND rewards (variable)".

### bRate-based yield-earned (all-time)
A position is bTokens; value grows because bRate rises (monotonic):
```
currentUnderlying = reserve.toAssetFromBTokenFloat(bTokens)          // V2: ÷1e12 internally
yieldEarned       = currentUnderlying − netPrincipalUsdc            // netPrincipal = Σsupplied − Σwithdrawn (off-chain)
```
The chain stores only bTokens, not cost basis — Sava tracks `netPrincipalUsdc` off-chain at each tx. `toAssetFromBToken` uses `mulFloor` (rounds yield down — conservative). For "realized" APY use `(bRate_t2/bRate_t1)^(yr/Δt) − 1`.

### Historical series
The SDK has **no history/time-series API**; only current rates exist on-chain. Approach: a **backend cron samples `estSupplyApy` (+ emissions, + `bRate`) hourly/daily and stores `{ts, supplyApy, bRate}`**, serving that to the rate chart. Reconstruct realized yield from sampled `bRate`. No backfill is possible without prior sampling — **start the sampler early**. At demo time with no store, show current rate labeled "current rate", do not fabricate a curve.

### Precision
USDC = **7 decimals** (`1e7`), not 6. All on-chain values are i128→`bigint`; do bigint division first, widen to `Number` only at the display boundary (`Number((bTokens*bRate)/1e12n)/1e7`). Fixed-point: `SCALAR_7=1e7`, `SCALAR_12=1e12`.

---

## 8. Testnet addresses

Two pools exist on testnet and they take **different** USDC tokens — this is the most load-bearing decision in the spec. The canonical official `TestnetV2` pool does **not** accept Circle USDC, which is the asset getsava's on/off-ramp + balances pipeline already holds.

| Role | Address | ✅/⚠️ | Source |
|---|---|---|---|
| Soroban RPC URL | `https://soroban-testnet.stellar.org` | ✅ | sdk-stellar config + live RPC |
| Network passphrase | `Test SDF Network ; September 2015` (single spaces around `;`) | ✅ | sdk-stellar config; `Networks.TESTNET` |
| Horizon URL | `https://horizon-testnet.stellar.org` | ✅ | sdk-stellar config |
| **Pool — CHOSEN (Circle USDC)** | `CAPBMXIQTICKWFPWFDJWMAKBXBPJZUKLNONQH3MLPLLBKQ643CYN5PRW` | ⚠️ | ref-MVP; live `is_pool=true`, `status=0`; community/custom pool (not in blend-utils), reserve list `[0]XLM [1]USDC [2]… [3]…` |
| **USDC SAC — CHOSEN (Circle)** | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` | ✅ | live `name()=USDC:GBBD47…`; **= deterministic SAC of `new Asset('USDC','GBBD47IF…').contractId(TESTNET)`** → reconciled exactly; reserve **index 1** in chosen pool |
| USDC issuer (classic) | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` | ✅ | Circle testnet USDC; matches getsava `config.usdc.issuer` exactly |
| Oracle (chosen pool) | read at runtime via `pool.loadOracle()` (`get_config().oracle`, custom `CCBTMXJW…`) | ⚠️ | not hardcoded; discover at runtime |
| Backstop v2 (global) | `CBDVWXT433PRVTUNM56C3JREF3HIZHRBA64NB2C3B2UNCKIS65ZYCLZA` | ✅ | blend-utils `testnet.contracts.json` |
| BLND token (SAC) | `CB22KRA3YZVCNCQI64JQ5WE7UY2VAV7WFLK6A2JN3HEX56T2EDAFO7QF` | ✅ | blend-utils |
| Pool Factory v2 | `CDV6RX4CGPCOKGTBFS52V3LMWQGZN3LCQTXF5RVPOOCG4XVMHXQ4NTF6` | ✅ | blend-utils; use `is_pool(poolId)` to assert authenticity |

**Reference — canonical `TestnetV2` deployment (official, but takes Blend's OWN test USDC, NOT Circle's):**
| Role | Address | Source |
|---|---|---|
| Pool `TestnetV2` | `CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF` (status 0; reserves `[0]XLM [1]wETH [2]wBTC [3]USDC`) | blend-utils + live |
| USDC (Blend test) | `CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU` = `USDC:GATALTGT…` — **not Circle's**; reserve index 3, `enabled`, `decimals 7`, `b_rate 1.055…` (1e12 V2 scale) | blend-utils + live |
| Oracle (mock) | `CAZOKR2Y5E2OSWSIBRVZMJ47RUTQPIGVWSAQ2UISGAVC46XKPGDG5PKI` | blend-utils + live `get_config().oracle` |

**USDC reconciliation:** `CBIELTK6…` IS the deterministic SAC for Circle's `GBBD47…` USDC (verified `Asset.contractId`). The `submit` `address` field MUST be the **C… SAC contract id**, not the `G…` issuer and not the asset code.

**Pool choice — RECOMMENDATION:** ship the **ref-MVP pool `CAPBMXIQ…` with Circle USDC `CBIELTK6…`** because it accepts the exact USDC getsava's ramp/balance pipeline already delivers end-to-end (zero asset swap). Risk: it is a community/custom pool, not in `blend-utils`, so its address may rotate on testnet reset. **MUST confirm with product** whether the deposit pipeline can deliver Blend's `GATALTGT…` test USDC instead — if so, prefer the canonical `TestnetV2 CCEBVDYM…` (more reviewer-recognizable). Either way: at startup, **assert via `is_pool(poolId)` + read `get_reserve_list` + `get_reserve(USDC_SAC).config.enabled`** rather than trusting hardcoded values, because testnet resets wipe Soroban state.

---

## 9. Screen mapping (5 handoff screens + vault data model → SDK reads)

| Screen | SDK reads |
|---|---|
| **Earn list** | per pool: `readReserveSnapshot().supplyApy` (headline APY), `.totalSupply` (TVL), `pool.metadata.status`. Currently one pool (USDC). |
| **Vault detail** | `supplyApy` (+`emissionsApy` if priced), `totalSupply` (TVL), `utilization`, `status`, backstop `totalSpotValueUsd`/`q4wPercentage` (health), `pool.loadOracle()` price (risk), historical APY series from the sampler (§7). |
| **Supply flow** | pre: `getBalances` (wallet USDC), `readReserveSnapshot.supplyApy` for projected yield; build/prepare/sign/submit (§4); `prepared` resource fee for fee display; post: `readUserPosition`, `stellarExpertTxUrl`. |
| **Vault withdraw** | `readUserPosition().suppliedUsdc` (max + 50% presets); partial=human amount, full=`I128MAX` (§5); simulate-fail → liquidity error; receipt url. |
| **Activity** | per-tx records (D4, §10): `txHash`+`stellarExpertTxUrl`, type, `usdcAmount`, `bTokensDelta`, `bRateAtTx`, `tryAmountAtTx`. On-chain hashes are reviewer-verifiable on Stellar Expert. |

**Vault data-model fields → source:** `apy`→`estSupplyApy`; `tvl`→`totalSupplyFloat()`; `utilization`→`getUtilizationFloat()`; `status`→`pool.metadata.status`; `userSupplied`→`getCollateralFloat`; `userBTokens`→`getCollateralBTokens`; `yieldEarned`→`toAssetFromBTokenFloat(bTokens) − netPrincipal`; `backstopCoverage`→`BackstopPoolEst.totalSpotValue`; `q4w`→`BackstopPoolEst.q4wPercentage`.

---

## 10. Deliverable hooks

### D1 — pool whitelist + supply-only invariant + circuit breaker (data this layer must provide)
- **Pool whitelist at startup:** `Pool Factory.is_pool(poolId) → bool` (assert pool is factory-issued) + a hardcoded allowed `poolId` set; `get_reserve_list` to confirm USDC_SAC is a reserve; `get_reserve(USDC_SAC).config.enabled === true`. Block all flows if any fails.
- **Supply-only invariant:** `assertSafeRequestType` (§3) gates every `Request` to `{2,3}`; lint rule bans `@blend-capital/blend-sdk` imports outside sdk-blend. Borrow/repay/auction are structurally unreachable.
- **Circuit-breaker signals (read each cycle):**
  - **Backstop coverage < 8%:** `BackstopPoolEst.totalSpotValue` vs pool TVL → ratio < 0.08 trips. (Also watch `q4wPercentage`.)
  - **bRate drift ±2% / 5min:** sample `reserve.data.bRate` every cycle; flag if `|bRate_now/bRate_5min| − 1| > 0.02`. (bRate is monotonic up; a downward or huge jump signals anomaly.)
  - **Oracle divergence ±0.5%:** `pool.loadOracle().getPriceFloat(USDC_SAC)` vs an external USDC reference; flag if `|div| > 0.005`. Supply-only math is oracle-independent, but oracle divergence is an early bad-debt warning (mis-priced collateral → bad debt → status flip).
  - **Pool status:** `pool.metadata.status` ≥ 4 → block new supply (withdraw still allowed).

### D4 — per-tx ₺-at-time + 90-day yield series (data this layer must provide)
Per tx (store off-chain at tx time): `txHash`, `ledgerTime`, `type` (supply/withdraw), `usdcAmount` (op amount /1e7), `bTokensDelta` (from tx result or `amount/bRateAtTx`), `bRateAtTx` (`reserve.data.bRate` at that ledger), `tryAmountAtTx` (`usdcAmount × USDCTRY_at_tx` from FX feed — CoinGecko primary, Binance fallback), `fxRateAtTx`+`fxSource`, running `netPrincipalUsdc`.
Derived 90-day: `currentUnderlying = toAssetFromBTokenFloat(currentBTokens)`; `cumulativeYieldUsdc = currentUnderlying − netPrincipalUsdc`; principal-vs-yield split = `{principal: netPrincipalUsdc, yield: cumulativeYieldUsdc}`; ₺ chart joins daily-sampled `bRate`/APY with **daily-stored FX** (else FX moves contaminate the yield curve — also expose a USDC-denominated yield line). On-chain (reviewer-verifiable): everything USDC/bToken/bRate/APY. Off-chain (FX feed): everything ₺-denominated; cannot be reconstructed from chain.

---

## 11. Risks & gotchas

### Reference MVP — what must NOT be trusted (rejected)
1. **`new PoolContract(poolId)` throws in SDK 3.2.2** — `PoolContract` is abstract. Use `new PoolContractV2(poolId)` (Blend v2 pool). Same for `Pool.load` → `PoolV2.load`.
2. **Hand-rolled APY** (`borrowApy × util × 0.5`, hardcoded 0.5 take rate, 2-piece linear IR, no IR modifier, no emissions) — wrong, won't hit ±0.1%. Use `reserve.estSupplyApy`.
3. **Hardcoded `0.23%` APY** string on confirm/success screens and `0.23/0.53` catch-fallbacks — not live data; remove.
4. **`rateScalar` magnitude-guess** (`bRate>1e11?1e12:1e9`) — fragile. Use typed `ReserveV2` (rateDecimals=12 statically).
5. **Hardcoded reserve `index:1`** and `collateral['1']` keying — read index from the pool's reserve list; indices are pool-specific.
6. **"Withdraw all" via `.toFixed(2)` balance snapshot** — strands dust, racy. Use `I128MAX`.
7. **PnL/history scraped from Horizon USDC effects** — misclassifies P2P transfers / on-ramps as Blend supply/withdraw, capped at 20 ops, N+1 fetches. Unreliable; track principal off-chain at tx time instead.
8. **`Number((hi<<64n)|lo)/1e7` i128 reconstruction** — precision loss > 2^53. Keep bigint until the display boundary.
9. **Explorer = stellarchain.io** — reviewers use Stellar Expert; use `stellarExpertTxUrl`.
10. **Hand-rolled `simulateAndPrepare`** (manual auth re-bake, manual fee) — replace with `server.prepareTransaction`. The MVP also ignores `restorePreamble` (archived-entry restore) — handle it.
11. **Dual stellar libs** (signing on stellar-base, blend pulls stellar-sdk) — reconcile to one stellar-base via `pnpm.overrides` (§2).
12. **Fee `'10000000'` pre-sim then `100+minResourceFee`** — inconsistent/underpriced. Let `prepareTransaction` set it (inclusion fee + resource fee).
13. **`pool-mainnet.tsx` is a display-only stub** — no real mainnet IDs; do not treat as config.
14. **MVP pool/USDC may be stale/rotated** — testnet resets wipe Soroban state; discover via `is_pool`/`get_reserve_list` at startup.

### Consolidated ⚠️ UNVERIFIED list (for the verifier)
1. **Which pool/USDC Sava ships** — product decision: ref-MVP pool `CAPBMXIQ…`+Circle USDC `CBIELTK6…` (matches getsava pipeline, but community/custom, may rotate) vs canonical `TestnetV2 CCEBVDYM…`+Blend USDC `GATALTGT…` (official, but requires ramp to deliver Blend test USDC). Confirm the deposit pipeline's deliverable asset before hardcoding.
2. **Stability of ref-MVP pool `CAPBMXIQ…`** — not in `blend-utils`; no upstream guarantee across testnet resets.
3. **Pool status integer enum (0..6)** — Admin_Active=0…Setup=6 assembled from a docs-page summary + SDK `setStatus` docstring (admin sets 0/2/4); raw enum not seen in SDK types. Confirm against `PoolConfig.status` decoding / contract `status.rs`.
4. **q4w auto-transition thresholds conflict** — whitepaper says 25%→On-Ice/50%→Frozen; docs full-text says >50%→On-Ice/>75%→Frozen; another summary said 30/50/60/75. Resolve against `blend pool/src/pool/status.rs` before trusting any %. (Qualitative rule — below-threshold OR high-q4w⇒On-Ice; very-high⇒Frozen — is consistent.)
5. **`I128MAX`-as-full-withdraw clamping** — inferred from the SDK export + known idiom; not doc-confirmed. Validate on testnet (deposit then withdraw `I128MAX` → full exit, no error).
6. **`submit` vs `submitWithAllowance`** — assume plain `submit` (inline transfer auth, no prior SAC approve) works; docs example uses `submit` with no approval. Verify a failed sim doesn't demand an allowance.
7. **`@stellar/stellar-sdk` exact version** — pin per blend-sdk's declared `14.4.3`; one stream read `^15.0.1` from the MVP. Confirm at install which resolves with blend-sdk@3.2.2 and force a single stellar-base via overrides.
8. **`PoolContractV2.submit` runs against the chosen stellar-base** — it only builds scVals + returns base64 XDR (should be version-agnostic); validate after the overrides bump.
9. **Privy `signRawHash` end-to-end on a Soroban tx** — encoding (raw 64-byte Ed25519 hex) proven for classic payments; Soroban uses the identical `tx.hash()`, so it should be a drop-in, but no on-chain Soroban tx has been Privy-signed yet. Validate once.
10. **`tx.hash()` parity across the stellar-base@13↔14 boundary** — asserted from version reasoning; validate after the overrides bump with one live cross-version run.
11. **BLND emissions on the chosen USDC reserve** — `reserve.supplyEmissions !== undefined`? and is there a testnet BLND price? Unverified; check at runtime. `estSupplyApy` is interest-only (a lower bound).
12. **Live `backstopRate` on the chosen pool** — directly scales `supplyApr`; read `pool.metadata.backstopRate`, don't assume.
13. **`minResourceFee` headroom under load** for Blend `submit` (touches oracle+reserve+emissions entries) — consider a small CPU/fee leeway if SUCCESS is flaky.
14. **±0.1% APY parity** — confirm in-app `estSupplyApy` vs Stellar Expert / a direct `get_reserve` sim at display time; the SDK projects to "now" on load but the chain rate keeps moving.
