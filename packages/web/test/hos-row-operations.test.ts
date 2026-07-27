import { describe, expect, it } from 'vitest';

import {
  addCycleRecap,
  addPriorDutyTotal,
  addSleeperPeriod,
  removeCycleRecap,
  removePriorDutyTotal,
  removeSleeperPeriod,
  updateCycleRecap,
  updatePriorDutyTotal,
  updateSleeperPeriod,
} from '../src/hos-row-operations.js';
import { createInitialTripSetupState } from '../src/model.js';

describe('Stage 18 HOS repeating-row operations', () => {
  it('adds, updates, and removes prior-duty rows immutably', () => {
    const initial = createInitialTripSetupState();
    const withCycle = {
      ...initial,
      hos: { ...initial.hos, cycleType: '60_in_7' as const },
    };
    const added = addPriorDutyTotal(withCycle);
    const updated = updatePriorDutyTotal(added, 0, {
      date: '2026-07-22',
      onDutyMinutes: 540,
    });
    const removed = removePriorDutyTotal(updated, 0);

    expect(initial.hos.priorDutyTotals).toEqual([]);
    expect(added).not.toBe(withCycle);
    expect(added.dirty).toBe(true);
    expect(updated.hos.priorDutyTotals).toEqual([
      { date: '2026-07-22', onDutyMinutes: 540 },
    ]);
    expect(removed.hos.priorDutyTotals).toEqual([]);
  });

  it('enforces seven prior days for 60-in-7 and eight for 70-in-8', () => {
    let sixty = createInitialTripSetupState();
    sixty = { ...sixty, hos: { ...sixty.hos, cycleType: '60_in_7' } };
    for (let index = 0; index < 7; index += 1) {
      sixty = addPriorDutyTotal(sixty);
    }

    let seventy = createInitialTripSetupState();
    seventy = { ...seventy, hos: { ...seventy.hos, cycleType: '70_in_8' } };
    for (let index = 0; index < 8; index += 1) {
      seventy = addPriorDutyTotal(seventy);
    }

    expect(sixty.hos.priorDutyTotals).toHaveLength(7);
    expect(addPriorDutyTotal(sixty)).toBe(sixty);
    expect(seventy.hos.priorDutyTotals).toHaveLength(8);
    expect(addPriorDutyTotal(seventy)).toBe(seventy);
  });

  it('does not add prior-duty rows until a cycle is selected', () => {
    const initial = createInitialTripSetupState();
    expect(addPriorDutyTotal(initial)).toBe(initial);
  });

  it('adds, updates, and removes recap rows', () => {
    const initial = createInitialTripSetupState();
    const added = addCycleRecap(initial);
    const updated = updateCycleRecap(added, 0, {
      availableAt: '2026-07-24T00:00:00-06:00',
      minutesReturning: 480,
    });
    const removed = removeCycleRecap(updated, 0);

    expect(updated.hos.cycleRecaps).toEqual([
      {
        availableAt: '2026-07-24T00:00:00-06:00',
        minutesReturning: 480,
      },
    ]);
    expect(removed.hos.cycleRecaps).toEqual([]);
  });

  it('adds, updates, and removes sleeper rows', () => {
    const initial = createInitialTripSetupState();
    const added = addSleeperPeriod(initial);
    const updated = updateSleeperPeriod(added, 0, {
      startAt: '2026-07-22T22:00:00-06:00',
      endAt: '2026-07-23T06:00:00-06:00',
    });
    const removed = removeSleeperPeriod(updated, 0);

    expect(updated.hos.existingSleeperPeriods).toEqual([
      {
        startAt: '2026-07-22T22:00:00-06:00',
        endAt: '2026-07-23T06:00:00-06:00',
      },
    ]);
    expect(removed.hos.existingSleeperPeriods).toEqual([]);
  });

  it('returns the original state for invalid row indexes', () => {
    const initial = createInitialTripSetupState();

    expect(updatePriorDutyTotal(initial, 0, { onDutyMinutes: 1 })).toBe(initial);
    expect(removePriorDutyTotal(initial, -1)).toBe(initial);
    expect(updateCycleRecap(initial, 0, { minutesReturning: 1 })).toBe(initial);
    expect(removeCycleRecap(initial, 2)).toBe(initial);
    expect(updateSleeperPeriod(initial, 0, { startAt: 'x' })).toBe(initial);
    expect(removeSleeperPeriod(initial, 4)).toBe(initial);
  });
});
