# Sava — Blend v2 Mainnet Pool Whitelist & Launch Selection (T2.D6)

> Which Blend v2 mainnet pool Sava supplies USDC into at Tranche-3 launch, the 5 rules it had to pass, the scored candidates (real on-chain data), and the founders' go/no-go attestation.
> Network: **Stellar mainnet** (Public). Selection data captured **2026-06-13** from live mainnet RPC.

---

## The 5-rule whitelist

A pool may receive Sava deposits **only if it passes all five rules**. Rules 1–2 are structural (enforced in code + CI); rules 3–5 are live-data thresholds shared with the runtime **circuit breaker** (T2.D1), so the same bars that gate selection also halt deposits in production if a live pool degrades.

| # | Rule | Threshold | Enforced by |
|---|---|---|---|
| 1 | **Identity** — pool is on the explicit allow-list | committed in `POOL_WHITELIST.mainnet` + `apps/mobile/src/config/mainnet.ts` | App startup (`assertPoolWhitelisted`) — refuses any non-listed pool |
| 2 | **Supply-only** — no borrow/auction exposure | `RequestType` narrowed to SupplyCollateral/WithdrawCollateral | SDK guardrail + CI `blend:check` |
| 3 | **Backstop coverage** — first-loss capital (size-aware) | coverage **ratio ≥ 8%** _or_ **absolute backstop ≥ $1M** | `minBackstopCoverage` + `minBackstopUsd` (live monitor halts only when ratio is low **and** the absolute backstop is small) |
| 4 | **Pool status** — Active/Admin, not Frozen/On-Ice/Setup | **status < 4** | `CIRCUIT_THRESHOLDS.haltAtStatus = 4` |
| 5 | **Oracle on-peg** — pool oracle USDC price vs $1 | **≤ ±0.5%** | `CIRCUIT_THRESHOLDS.maxOracleDivergence = 0.005` |

The breaker additionally monitors **bRate drift (≤ ±2% / 5 min)** continuously in production; it isn't a point-in-time selection rule but is part of the same defense.

---

## Candidate pools — scoring matrix (real mainnet data)

Method (reproducible): loaded the **Blend v2 backstop reward zone** (`CAQQR5SW…`, 5 pools), kept the **USDC-bearing** pools (Sava supplies USDC only → 3 candidates), and read each pool's live USDC-reserve TVL, backstop coverage, oracle price, and status via `@getsava/sdk-blend` over mainnet Soroban RPC (`https://mainnet.sorobanrpc.com`).

| Pool | Contract | USDC TVL | (3) Backstop coverage — ratio · absolute | (4) Status | (5) Oracle Δ | q4w | Verdict |
|---|---|---:|---|---|---|---|---|
| **Fixed V2** | `CAJJZSGM…BXBD` | **$53,466,365** | 6.3% ratio · **$3.39M abs ✅** | 1 ✅ | 0.016% ✅ | 11.6% | 🟢 **SELECT** — passes on absolute backstop |
| YieldBlox V2 | `CCCCIQSD…GYFS` | $568,713 | 58.7% ✅ · $0.33M | 0 (Active) ✅ | 0.000% ✅ | 0.08% | 🟡 passes, but ~94× smaller |
| CDMAVJ… | `CDMAVJPF…` | $34,698 | 95.4% ✅ · $0.03M | 1 ✅ | 0.016% ✅ | 0.00% | 🟡 passes, but tiny |
| (2 reward-zone pools) | — | — | — | — | — | — | ⚪ skipped — no USDC reserve |

Rule 3 is **size-aware**: a pool passes on a healthy *ratio* (≥ 8%) **or** a large *absolute* backstop (≥ $1M). A low ratio on a huge pool is not a red flag — Fixed V2's **$3.39M** of first-loss capital is ~10× YieldBlox's $0.33M; the ratio is only "low" because the pool is ~94× larger. Rules 1 (identity) and 2 (supply-only) are constant: rule 2 is always satisfied (Sava is structurally supply-only); rule 1 is the *outcome* of this selection.

---

## Selection: **Blend v2 "Fixed V2"**

`CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD`

**Rationale — the deepest pool, passing the security defense on absolute backstop.**
- **Fixed V2** is by far the **largest USDC pool ($53.4M)** — ~94× the next candidate — which matters for launch: depth lets users supply and withdraw without slippage or liquidity crunch, and it's Blend's most established USDC market.
- Its coverage **ratio** (6.3%) sits below the 8% bar, but its **absolute first-loss capital is ~$3.39M** — ~10× YieldBlox's $0.33M. Under the **size-aware rule** (ratio ≥ 8% _or_ absolute ≥ $1M), that large absolute backstop is the truer measure of protection for a pool this size, so Fixed V2 passes. It is **Active (status 0… 1 admin-active)**, **on-peg (0.016%)**, and supply-only by construction.
- The runner-up, **YieldBlox V2**, is safe (58.7% coverage) but ~94× smaller ($568K) — too thin for launch liquidity. It stays a documented fallback.

Live values drift; this matrix is the decision record. The runtime circuit breaker (T2.D1) re-checks rules 3–5 every minute and **halts new deposits** if the pool degrades — and because the coverage check is size-aware, Fixed V2 would only halt if its **absolute** backstop fell below $1M (≈ a 94% drop) while the ratio stayed thin. Re-confirm before the T3 flip.

### Committed configuration (gated behind a feature flag)
- `apps/mobile/src/config/mainnet.ts` — `MAINNET_POOL` + `MAINNET_CONTRACTS` + `MAINNET_CANDIDATES`, behind `MAINNET_ENABLED` (`EXPO_PUBLIC_MAINNET_ENABLED`, default **false**).
- `packages/sdk-blend/src/config.ts` — `MAINNET` Blend addresses; `blendConfig('mainnet')` returns them.
- `packages/sdk-blend/src/whitelist.ts` — `POOL_WHITELIST.mainnet = ['CAJJZSGM…']`.
- `apps/mobile/src/lib/network.ts` — `NETWORK = MAINNET_ENABLED ? 'mainnet' : 'testnet'`.

The app **stays on testnet** until the flag flips at **Tranche-3 launch**. Mainnet contract source: `blend-utils/mainnet.contracts.json`. Mainnet USDC issuer (`GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`) / SAC (`CCW67TSZ…`) per Circle + blend-utils.

---

## Go / No-Go Attestation (v7.0 final-tranche bars)

We, the founders of Sava, attest that the following Tranche-2 final-tranche bars are met and that the pool above is the chosen mainnet launch pool, to be activated at Tranche-3 launch behind the feature flag.

- [ ] **D1** — 3-source circuit breaker live on staging; deposits halt + alerts on trip within 30s; supply-only CI-tested every commit; read-only dashboard with 7+ days of metrics.
- [ ] **D2** — Yield calculator live; output matches Blend testnet APY within ±0.1%; TCMB bank-rate comparison from published data; Turkish-localized.
- [ ] **D3** — Savings goals: creation, on-chain-deposit progress, milestone push (device-verified), reinstall-durable.
- [ ] **D4** — Transaction history < 500ms; time-of-tx ₺ from a live FX feed (CoinGecko + Binance); 90-day portfolio chart + principal-vs-yield; reconciles with on-chain state.
- [ ] **D6** — This pool-whitelist (5 rules + ≥3 scored candidates) published; selected pool committed behind a feature flag; this attestation signed.

| Founder | Signature | Date |
|---|---|---|
| _________________________ | _________________________ | __________ |
| _________________________ | _________________________ | __________ |

> Sign by either a git-signed commit referencing this file (`git commit -S`) or an e-signed PDF attached to the submission. Re-confirm each box against the live deployment before signing.
