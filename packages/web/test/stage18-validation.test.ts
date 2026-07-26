import { describe, expect, it } from 'vitest';

import {
  createInitialTripSetupState,
  type TripSetupState,
} from '../src/model.js';
import { validateStage18TripSetup } from '../src/stage18-validation.js';

function stateWithHistory(
  cycleType: '60_in_7' | '70_in_8',
  count: number,
): TripSetupState {
  const initial = createInitialTripSetupState();
  const startDay = cycleType === '60_in_7' ? 16 : 15;
  return {
    ...initial,
    departureAt: '2026-07-23T08:00',
    hos: {
      ...initial.hos,
      cycleType,
      provenance: 'user_entered' as const,
      priorDutyTotals: Array.from({ length: count }, (_value, index) => ({
        date: `2026-07-${String(startDay + index).padStart(2, '0')}`,
        onDutyMinutes: 480,
      })),
    },
  };
}

describe('Stage 18 corrected HOS validation', () => {
  it('requires seven days for 60-in-7', () => {
    const six = validateStage18TripSetup(stateWithHistory('60_in_7', 6));
    const seven = validateStage18TripSetup(stateWithHistory('60_in_7', 7));

    expect(six.map((issue) => issue.message)).toContain(
      'Enter 7 prior daily on-duty totals for the selected cycle.',
    );
    expect(seven.some((issue) => issue.path === 'hos.priorDutyTotals')).toBe(
      false,
    );
  });

  it('requires eight days for 70-in-8', () => {
    const seven = validateStage18TripSetup(stateWithHistory('70_in_8', 7));
    const eight = validateStage18TripSetup(stateWithHistory('70_in_8', 8));

    expect(seven.map((issue) => issue.message)).toContain(
      'Enter 8 prior daily on-duty totals for the selected cycle.',
    );
    expect(eight.some((issue) => issue.path === 'hos.priorDutyTotals')).toBe(
      false,
    );
  });

  it('requires consecutive prior dates and caps daily totals at 1,440 minutes', () => {
    const state = stateWithHistory('60_in_7', 7);
    const priorDutyTotals = state.hos.priorDutyTotals.map((entry, index) =>
      index === 0
        ? { date: '2026-07-01', onDutyMinutes: 1_441 }
        : entry,
    );
    const issues = validateStage18TripSetup({
      ...state,
      hos: { ...state.hos, priorDutyTotals },
    });

    expect(issues.map((issue) => issue.path)).toContain(
      'hos.priorDutyTotals.0.date',
    );
    expect(issues.map((issue) => issue.path)).toContain(
      'hos.priorDutyTotals.0.onDutyMinutes',
    );
  });
});
