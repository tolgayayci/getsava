import { describe, expect, it } from 'vitest';
import { dueMilestones, MILESTONES } from './goal-milestones';

describe('dueMilestones', () => {
  it('returns nothing below 25%', () => {
    expect(dueMilestones(0, [])).toEqual([]);
    expect(dueMilestones(0.2, [])).toEqual([]);
  });

  it('fires 25 once the bar reaches a quarter', () => {
    expect(dueMilestones(0.25, [])).toEqual([25]);
    expect(dueMilestones(0.49, [])).toEqual([25]);
  });

  it('returns every newly-crossed milestone on a big jump', () => {
    expect(dueMilestones(0.8, [])).toEqual([25, 50, 75]);
    expect(dueMilestones(1, [])).toEqual([25, 50, 75, 100]);
  });

  it('never re-fires an already-reached milestone', () => {
    expect(dueMilestones(0.6, [25, 50])).toEqual([]);
    expect(dueMilestones(0.8, [25, 50])).toEqual([75]);
    expect(dueMilestones(1, [25, 50, 75])).toEqual([100]);
    expect(dueMilestones(1, [25, 50, 75, 100])).toEqual([]);
  });

  it('caps at 100 even past the target', () => {
    expect(dueMilestones(1.5, [])).toEqual(MILESTONES.slice());
  });
});
