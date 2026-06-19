import { useEffect } from 'react';
import { useTranslation } from '../i18n';
import { dueMilestones } from './goal-milestones';
import { fireMilestoneNotification } from './goal-notify';
import { goalProgress, goalValue, useGoalsStore } from './goals-store';
import { useVault } from './useVault';

/**
 * Watches every goal's progress (on-chain principal + its real yield share) and
 * fires a single OS notification the moment a goal crosses a new 25/50/75/100%
 * milestone, recording it so it never re-fires. Mounted once in the app shell, so
 * it catches both deposit-driven and yield-driven crossings. Respects each goal's
 * `notify` toggle.
 */
export function useGoalMilestones(): void {
  const { t } = useTranslation();
  const goals = useGoalsStore((s) => s.goals);
  const recordMilestones = useGoalsStore((s) => s.recordMilestones);
  const { vault } = useVault();
  const vy = vault?.yieldUsdc ?? 0;

  useEffect(() => {
    for (const g of goals) {
      if (!g.notify) {
        continue;
      }
      const pct = goalProgress(goalValue(g, goals, vy), g.target);
      const due = dueMilestones(pct, g.reachedMilestones ?? []);
      if (due.length === 0) {
        continue;
      }
      // Fire one notification for the highest newly-crossed milestone, but record
      // all of them so a big jump doesn't re-fire the lower ones later.
      const top = due[due.length - 1] as number;
      const reached = top >= 100;
      void fireMilestoneNotification(
        reached ? t('goals.pushReached') : t('goals.pushMilestone'),
        reached
          ? t('goals.pushReachedBody', { name: g.name })
          : t('goals.pushMilestoneBody', { pct: String(top), name: g.name }),
      );
      recordMilestones(g.id, due);
    }
  }, [goals, vy, recordMilestones, t]);
}
