import { loadNotifications } from './notifications';

/**
 * Goal milestone notifications (T2.D3). Fires a REAL OS local notification when a
 * goal crosses 25 / 50 / 75 / 100% — not the in-app preview overlay. Uses the
 * shared foreground handler, so it shows as a banner even in the foreground.
 * Fully defensive via {@link loadNotifications}: no-op on web / without permission
 * / when the native module is absent; never throws.
 */

export { dueMilestones, MILESTONES, type Milestone } from './goal-milestones';

/** Fire an immediate local notification. Returns true if it was scheduled. */
export async function fireMilestoneNotification(title: string, body: string): Promise<boolean> {
  try {
    const N = await loadNotifications();
    if (!N) {
      return false;
    }
    const existing = await N.getPermissionsAsync();
    const status =
      existing.status === 'granted' ? 'granted' : (await N.requestPermissionsAsync()).status;
    if (status !== 'granted') {
      return false;
    }
    await N.scheduleNotificationAsync({
      content: { title, body, sound: 'default', data: { type: 'goal_milestone' } },
      trigger: null,
    });
    return true;
  } catch {
    return false;
  }
}
