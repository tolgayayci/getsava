import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type GoalIcon = 'plane' | 'home' | 'shield' | 'gift' | 'earn' | 'globe';
export type GoalColor = 'purple' | 'green' | 'blue' | 'amber';

/** One "set aside" event toward a goal (drives the contributions feed). */
export interface Contribution {
  readonly ts: number;
  readonly usdc: number;
}

export interface Goal {
  readonly id: string;
  readonly name: string;
  readonly desc?: string;
  readonly icon: GoalIcon;
  readonly color: GoalColor;
  /** USDC target. */
  readonly target: number;
  /** USDC principal the user has earmarked toward this goal. */
  readonly current: number;
  /** Milestone push alerts (25/50/75/100%). */
  readonly notify: boolean;
  readonly createdAt: number;
  /** Newest-first log of set-aside events. */
  readonly contribs: readonly Contribution[];
}

export type NewGoal = Pick<Goal, 'name' | 'icon' | 'color' | 'target' | 'notify'> &
  Partial<Pick<Goal, 'desc'>>;

interface GoalsStoreState {
  goals: Goal[];
  /** Append a goal (starts at current 0); returns its id so the caller can open it. */
  addGoal: (g: NewGoal) => string;
  /** Earmark more USDC principal toward a goal. */
  addToGoal: (id: string, usdc: number) => void;
  removeGoal: (id: string) => void;
  toggleNotify: (id: string) => void;
  reset: () => void;
}

let seq = 0;
function newId(): string {
  seq += 1;
  return `g${Date.now()}${seq}`;
}

/** Persisted goals (survive reinstall). */
export const useGoalsStore = create<GoalsStoreState>()(
  persist(
    (set) => ({
      goals: [],
      addGoal: (g) => {
        const id = newId();
        const goal: Goal = {
          id,
          name: g.name,
          icon: g.icon,
          color: g.color,
          target: g.target,
          notify: g.notify,
          current: 0,
          createdAt: Date.now(),
          contribs: [],
          ...(g.desc ? { desc: g.desc } : {}),
        };
        set((s) => ({ goals: [goal, ...s.goals] }));
        return id;
      },
      addToGoal: (id, usdc) =>
        set((s) => ({
          goals: s.goals.map((x) =>
            x.id === id
              ? {
                  ...x,
                  current: x.current + usdc,
                  contribs: [{ ts: Date.now(), usdc }, ...x.contribs],
                }
              : x,
          ),
        })),
      removeGoal: (id) => set((s) => ({ goals: s.goals.filter((x) => x.id !== id) })),
      toggleNotify: (id) =>
        set((s) => ({
          goals: s.goals.map((x) => (x.id === id ? { ...x, notify: !x.notify } : x)),
        })),
      reset: () => set({ goals: [] }),
    }),
    { name: 'sava-goals', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/**
 * A goal's share of the vault's REAL yield, split proportionally by earmarked
 * principal so the per-goal shares SUM to the vault's actual yield (no
 * double-counting). Sava has one USDC vault today, so every goal is a peer.
 *   share(g) = vaultYield × current(g) / Σ current(peers)
 */
export function goalYield(goal: Goal, goals: Goal[], vaultYieldUsdc: number): number {
  const total = goals.reduce((sum, g) => sum + (g.current || 0), 0) || 1;
  return vaultYieldUsdc * ((goal.current || 0) / total);
}

/** Displayed value of a goal = earmarked principal + its attributed yield share. */
export function goalValue(goal: Goal, goals: Goal[], vaultYieldUsdc: number): number {
  return goal.current + goalYield(goal, goals, vaultYieldUsdc);
}

/** Progress 0..1 (capped). */
export function goalProgress(value: number, target: number): number {
  return target > 0 ? Math.min(1, value / target) : 0;
}
