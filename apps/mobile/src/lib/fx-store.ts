import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { FxSource } from './fx-feed';

/**
 * The app's live USDC/TRY rate (T2.D4). Fed by useFxFeed (CoinGecko/Binance) and
 * read everywhere ₺ is shown. Before the first successful fetch it holds a clearly
 * flagged BOOTSTRAP placeholder (live=false); once a real quote lands, `live` is
 * true and the rate persists, so later launches start from the last real rate.
 */

/** Cold-start placeholder only — replaced within seconds by the real feed. */
export const FX_BOOTSTRAP_RATE = 41;

export interface FxState {
  /** Current USDC/TRY. Real once `live` is true; the bootstrap placeholder before. */
  readonly rate: number;
  readonly source: FxSource | 'bootstrap';
  /** True once a real CoinGecko/Binance quote has been applied. */
  readonly live: boolean;
  /** Epoch ms of the last real quote (0 before any). */
  readonly ts: number;
  setQuote: (rate: number, source: FxSource, ts: number) => void;
}

export const useFxStore = create<FxState>()(
  persist(
    (set) => ({
      rate: FX_BOOTSTRAP_RATE,
      source: 'bootstrap',
      live: false,
      ts: 0,
      setQuote: (rate, source, ts) => set({ rate, source, live: true, ts }),
    }),
    { name: 'sava-fx', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/** Read the current rate outside React (e.g. when stamping a tx's time-of-tx ₺). */
export function currentFxRate(): number {
  return useFxStore.getState().rate;
}
