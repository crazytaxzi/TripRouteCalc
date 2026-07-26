import { describe, expect, it } from 'vitest';

import {
  renderCycleRecapRows,
  renderHosRepeatingRows,
  renderPriorDutyRows,
  renderSleeperPeriodRows,
} from '../src/hos-row-editor.js';
import { createInitialTripSetupState } from '../src/model.js';

describe('Stage 18 accessible HOS row editor', () => {
  it('renders explicit empty states and add controls without relying on color', () => {
    const html = renderHosRepeatingRows(createInitialTripSetupState().hos);

    expect(html).toContain('Add day');
    expect(html).toContain('Add recap');
    expect(html).toContain('Add period');
    expect(html).toContain('No prior-duty rows entered.');
    expect(html).toContain('No cycle recaps entered.');
    expect(html).toContain('No sleeper periods entered.');
    expect(html).toContain('Choose a cycle before entering prior-day history.');
  });

  it('renders labelled remove controls and escaped row values', () => {
    const initial = createInitialTripSetupState();
    const hos = {
      ...initial.hos,
      priorDutyTotals: [{ date: '2026-07-22', onDutyMinutes: 540 }],
      cycleRecaps: [
        { availableAt: '2026-07-24T00:00<bad>', minutesReturning: 480 },
      ],
      existingSleeperPeriods: [
        { startAt: '2026-07-22T22:00', endAt: '2026-07-23T06:00' },
      ],
    };

    expect(renderPriorDutyRows(hos)).toContain(
      'aria-label="Remove prior-duty row 1"',
    );
    expect(renderCycleRecapRows(hos)).toContain(
      '2026-07-24T00:00&lt;bad&gt;',
    );
    expect(renderSleeperPeriodRows(hos)).toContain(
      'aria-label="Remove sleeper period 1"',
    );
  });

  it('disables adding prior-duty rows at the selected-cycle limit', () => {
    const initial = createInitialTripSetupState();
    const hos = {
      ...initial.hos,
      cycleType: '60_in_7' as const,
      priorDutyTotals: Array.from({ length: 7 }, (_value, index) => ({
        date: `2026-07-${String(index + 10).padStart(2, '0')}`,
        onDutyMinutes: 480,
      })),
    };

    const html = renderPriorDutyRows(hos);
    expect(html).toContain('data-hos-row-kind="prior-duty" disabled');
    expect(html).toContain('Enter 7 prior days');
    expect(html).toContain('max="1440"');
  });
});
