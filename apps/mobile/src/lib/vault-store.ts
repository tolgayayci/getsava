import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Money-timeline event kinds (Activity screen / D4). */
export type ActivityType = 'supplied' | 'withdrew' | 'added' | 'yield';

export interface ActivityRecord {
  readonly id: string;
  readonly type: ActivityType;
  readonly usdc: number;
  /** ₺ value at time-of-transaction (D4 — placeholder flat FX until the feed lands). */
  readonly tryAtTx: number;
  readonly hash?: string;
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

interface VaultStoreState {
  /**
   * Off-chain principal tracking. The chain stores only bTokens, not cost basis,
   * so yield = currentUnderlying − netPrincipalUsdc (D4). Updated at each tx.
   */
  netPrincipalUsdc: number;
  activity: ActivityRecord[];
  /** REAL observed APY history (the chart's source of truth; grows as it samples). */
  rateHistory: RateSample[];
  addSupply: (usdc: number, tryAtTx: number, hash: string, ts: number) => void;
  addWithdraw: (usdc: number, tryAtTx: number, hash: string, ts: number, full: boolean) => void;
  addRecord: (rec: ActivityRecord) => void;
  /** Append a real APY sample (throttled + capped). */
  recordRate: (apy: number, ts: number) => void;
  reset: () => void;
}

/** Persisted vault bookkeeping: principal basis + the money timeline. */
export const useVaultStore = create<VaultStoreState>()(
  persist(
    (set) => ({
      netPrincipalUsdc: 0,
      activity: [],
      rateHistory: [],
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
      addRecord: (rec) => set((s) => ({ activity: [rec, ...s.activity] })),
      reset: () => set({ netPrincipalUsdc: 0, activity: [], rateHistory: [] }),
    }),
    { name: 'sava-vault', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
