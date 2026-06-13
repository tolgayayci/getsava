/** Pure goal-milestone logic (no native imports — unit-testable). */

export const MILESTONES = [25, 50, 75, 100] as const;
export type Milestone = (typeof MILESTONES)[number];

/** Milestones at/below the current progress (0..1) that haven't fired yet. */
export function dueMilestones(pct: number, reached: readonly number[]): Milestone[] {
  return MILESTONES.filter((m) => pct >= m / 100 && !reached.includes(m));
}
