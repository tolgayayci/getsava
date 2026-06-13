import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { vaultStorage } from './vault-storage';

/** Money-timeline event kinds (Activity screen / D4). */
export type ActivityType = 'supplied' | 'withdrew' | 'added' | 'yield' | 'sent';

/** Where a money event came from — drives the Activity badge (e.g. Mercuryo). */
export type ActivitySource = 'mercuryo' | 'wallet';

export interface ActivityRecord {
  readonly id: string;
  readonly type: ActivityType;
  readonly usdc: number;
  /** ₺ value captured at time-of-transaction from the live FX feed (CoinGecko/Binance). */
  readonly tryAtTx: number;
  readonly hash?: string;
  readonly source?: ActivitySource;
  /** epoch ms */
  readonly ts: number;
}

/** A real APY observation, recorded each time the app reads the live pool rate. */
export interface RateSample {
  /** epoch ms */
  readonly ts: number;
  /** supply APY percent observed at that time */
  readonly apy: number;
}

/** Don't record more than one sample per this interval (keeps the series sane). */
const RATE_SAMPLE_INTERVAL_MS = 10 * 60_000;
const RATE_HISTORY_CAP = 2000;

/** Portfolio-value samples: at most one per 6h, capped — feeds the 90-day chart (D4). */
const PORTFOLIO_SAMPLE_INTERVAL_MS = 6 * 60 * 60_000;
const PORTFOLIO_HISTORY_CAP = 400;

/** One portfolio observation: on-chain position value + tracked principal at a time. */
export interface PortfolioSample {
  readonly ts: number;
  /** On-chain underlying USDC value of the position (matches Stellar/Blend state). */
  readonly valueUsdc: number;
  /** Tracked cost basis at that time (value − principal ≈ yield). */
  readonly principalUsdc: number;
}

interface VaultStoreState {
  /**
   * Off-chain principal tracking. The chain stores only bTokens, not cost basis,
   * so yield = currentUnderlying − netPrincipalUsdc (D4). Updated at each tx.
   */
  netPrincipalUsdc: number;
  activity: ActivityRecord[];
  /** REAL observed APY history (the chart's source of truth; grows as it samples). */
  rateHistory: RateSample[];
  /** REAL portfolio-value history (feeds the 90-day portfolio chart). */
  portfolioHistory: PortfolioSample[];
  addSupply: (usdc: number, tryAtTx: number, hash: string, ts: number) => void;
  addWithdraw: (usdc: number, tryAtTx: number, hash: string, ts: number, full: boolean) => void;
  /** Record a card/wallet deposit (USDC in). Deduped by id (e.g. order id). */
  addDeposit: (
    id: string,
    usdc: number,
    tryAtTx: number,
    hash: string | undefined,
    ts: number,
    source: ActivitySource,
  ) => void;
  /** Record an external send (USDC out to an address). Deduped by tx hash. */
  addSend: (usdc: number, tryAtTx: number, hash: string, ts: number) => void;
  addRecord: (rec: ActivityRecord) => void;
  /** Append a real APY sample (throttled + capped). */
  recordRate: (apy: number, ts: number) => void;
  /** Append a real portfolio-value sample (throttled + capped). */
  recordPortfolio: (valueUsdc: number, principalUsdc: number, ts: number) => void;
  reset: () => void;
}

/** Persisted vault bookkeeping: principal basis + the money timeline. */
export const useVaultStore = create<VaultStoreState>()(
  persist(
    (set) => ({
      netPrincipalUsdc: 0,
      activity: [],
      rateHistory: [],
      portfolioHistory: [],
      recordPortfolio: (valueUsdc, principalUsdc, ts) =>
        set((s) => {
          const last = s.portfolioHistory[s.portfolioHistory.length - 1];
          if (last && ts - last.ts < PORTFOLIO_SAMPLE_INTERVAL_MS) {
            return s;
          }
          return {
            portfolioHistory: [...s.portfolioHistory, { ts, valueUsdc, principalUsdc }].slice(
              -PORTFOLIO_HISTORY_CAP,
            ),
          };
        }),
      recordRate: (apy, ts) =>
        set((s) => {
          const last = s.rateHistory[s.rateHistory.length - 1];
          if (last && ts - last.ts < RATE_SAMPLE_INTERVAL_MS) {
            return s;
          }
          return { rateHistory: [...s.rateHistory, { ts, apy }].slice(-RATE_HISTORY_CAP) };
        }),
      addSupply: (usdc, tryAtTx, hash, ts) =>
        set((s) => ({
          netPrincipalUsdc: s.netPrincipalUsdc + usdc,
          activity: [{ id: hash, type: 'supplied', usdc, tryAtTx, hash, ts }, ...s.activity],
        })),
      addWithdraw: (usdc, tryAtTx, hash, ts, full) =>
        set((s) => ({
          netPrincipalUsdc: full ? 0 : Math.max(0, s.netPrincipalUsdc - usdc),
          activity: [{ id: hash, type: 'withdrew', usdc, tryAtTx, hash, ts }, ...s.activity],
        })),
      addDeposit: (id, usdc, tryAtTx, hash, ts, source) =>
        set((s) => {
          if (s.activity.some((a) => a.id === id)) {
            return s;
          }
          const rec: ActivityRecord = {
            id,
            type: 'added',
            usdc,
            tryAtTx,
            ts,
            source,
            ...(hash ? { hash } : {}),
          };
          return { activity: [rec, ...s.activity] };
        }),
      addSend: (usdc, tryAtTx, hash, ts) =>
        set((s) => {
          if (s.activity.some((a) => a.id === hash)) {
            return s;
          }
          return {
            activity: [{ id: hash, type: 'sent', usdc, tryAtTx, hash, ts }, ...s.activity],
          };
        }),
      addRecord: (rec) => set((s) => ({ activity: [rec, ...s.activity] })),
      reset: () =>
        set({ netPrincipalUsdc: 0, activity: [], rateHistory: [], portfolioHistory: [] }),
    }),
    { name: 'sava-vault', storage: createJSONStorage(() => vaultStorage) },
  ),
);
