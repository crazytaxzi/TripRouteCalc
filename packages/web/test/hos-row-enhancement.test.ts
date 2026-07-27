import { describe, expect, it } from 'vitest';

import {
  addHosRow,
  parseHosRowText,
  removeHosRow,
  serializeHosRowText,
} from '../src/hos-row-enhancement.js';

describe('Stage 18 HOS row enhancement transforms', () => {
  it('round-trips the accepted textarea draft format', () => {
    const parsed = parseHosRowText(
      '2026-07-20,480\n2026-07-21,540',
      '2026-07-24T00:00,420',
      '2026-07-22T21:00,2026-07-23T05:00',
    );

    expect(serializeHosRowText(parsed)).toEqual({
      priorDutyText: '2026-07-20,480\n2026-07-21,540',
      recapText: '2026-07-24T00:00,420',
      sleeperText: '2026-07-22T21:00,2026-07-23T05:00',
    });
  });

  it('adds rows without mutating the parsed input', () => {
    const parsed = parseHosRowText('', '', '');
    const withDuty = addHosRow(parsed, 'prior-duty', '60_in_7');
    const withRecap = addHosRow(withDuty, 'cycle-recap', '60_in_7');
    const withSleeper = addHosRow(withRecap, 'sleeper-period', '60_in_7');

    expect(parsed.priorDutyTotals).toEqual([]);
    expect(withSleeper).toEqual({
      priorDutyTotals: [{ date: '', onDutyMinutes: 0 }],
      cycleRecaps: [{ availableAt: '', minutesReturning: 0 }],
      existingSleeperPeriods: [{ startAt: '', endAt: '' }],
    });
  });

  it('enforces the seven-day prior-duty limit for a 60-in-7 cycle', () => {
    let rows = parseHosRowText('', '', '');
    for (let index = 0; index < 7; index += 1) {
      rows = addHosRow(rows, 'prior-duty', '60_in_7');
    }

    expect(rows.priorDutyTotals).toHaveLength(7);
    expect(addHosRow(rows, 'prior-duty', '60_in_7')).toBe(rows);
  });

  it('requires a selected cycle before adding prior-duty rows', () => {
    const rows = parseHosRowText('', '', '');
    expect(addHosRow(rows, 'prior-duty', '')).toBe(rows);
  });

  it('removes only the requested row and ignores invalid indexes', () => {
    const parsed = parseHosRowText(
      '2026-07-20,480\n2026-07-21,540',
      '2026-07-24T00:00,420',
      '',
    );
    const removed = removeHosRow(parsed, 'prior-duty', 0);

    expect(removed.priorDutyTotals).toEqual([
      { date: '2026-07-21', onDutyMinutes: 540 },
    ]);
    expect(removeHosRow(parsed, 'cycle-recap', 5)).toBe(parsed);
    expect(removeHosRow(parsed, 'sleeper-period', -1)).toBe(parsed);
  });
});
