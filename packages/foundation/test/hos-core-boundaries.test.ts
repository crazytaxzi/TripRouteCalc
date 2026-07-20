import { describe, expect, it } from 'vitest';

import { calculateHosCore } from '../src/hos-core.js';
import {
  validateDriverHosDepartureState,
  validateDutyEvent,
} from '../src/hos.js';
import type {
  DriverHosDepartureState,
  DutyEvent,
  HosDutyStatus,
} from '../src/hos.js';

const testProvenance = Object.freeze({
  origin: 'USER_ENTERED' as const,
  verification: 'UNVERIFIED' as const,
  sourceName: 'stage 05 boundary fixture',
  explanation: 'Test-only boundary input.',
});

function state(
  overrides: Readonly<Record<string, unknown>> = {},
): DriverHosDepartureState {
  return validateDriverHosDepartureState({
    driver: { nameOrIdentifier: 'Boundary Driver' },
    departureAt: '2026-07-20T12:00:00.000Z',
    departureTimeZone: 'America/Boise',
    currentDutyStatus: 'ON_DUTY_NOT_DRIVING',
    currentDutyStatusStartedAt: '2026-07-20T12:00:00.000Z',
    drivingTimeRemaining: { value: 660, unit: 'minute' },
    shiftTimeRemaining: { value: 840, unit: 'minute' },
    cycleTimeRemaining: { value: 4200, unit: 'minute' },
    cycleType: 'SEVENTY_HOURS_EIGHT_DAYS',
    drivenSinceLastQualifyingInterruption: { value: 0, unit: 'minute' },
    onDutyTimeCurrentShift: { value: 0, unit: 'minute' },
    offDutyTimeImmediatelyBeforeDeparture: { value: 600, unit: 'minute' },
    qualifyingTenHourBreakCompleted: true,
    priorDutyDays: Array.from({ length: 8 }, (_, index) => ({
      date: `2026-07-${String(12 + index).padStart(2, '0')}`,
      onDutyTime: { value: 0, unit: 'minute' },
    })),
    recapReturns: [],
    sleeperBerthEligible: true,
    existingSleeperPeriods: [],
    splitSleeperEnabled: false,
    restart34HourPlanned: false,
    carrierMaxDailyDriving: { value: 660, unit: 'minute' },
    carrierMaxDuty: { value: 840, unit: 'minute' },
    provenance: {
      driver: testProvenance,
      departure: testProvenance,
      dutyStatus: testProvenance,
      clocks: testProvenance,
      dutyHistory: testProvenance,
      sleeper: testProvenance,
      carrierPolicy: testProvenance,
      restPreference: testProvenance,
    },
    ...overrides,
  });
}

function dutyEvent(
  id: string,
  startAt: string,
  minutes: number,
  dutyStatus: HosDutyStatus,
): DutyEvent {
  const driving = dutyStatus === 'DRIVING';
  const onDuty = driving || dutyStatus === 'ON_DUTY_NOT_DRIVING';
  return validateDutyEvent({
    id,
    startAt,
    endAt: new Date(Date.parse(startAt) + minutes * 60_000).toISOString(),
    duration: { value: minutes, unit: 'minute' },
    dutyStatus,
    eventType: driving ? 'STATUS_CHANGE' : 'OTHER',
    location: { description: 'Boundary test', timeZone: 'America/Boise' },
    source: 'USER_ENTERED',
    explanation: 'Minute-exact boundary fixture.',
    clockEffects: {
      driving: driving ? 'CONSUMES' : 'DOES_NOT_CONSUME',
      shift: dutyStatus === 'SLEEPER_BERTH'
        ? 'RULE_DEPENDENT'
        : 'ADVANCES_WINDOW',
      cycle: onDuty ? 'CONSUMES' : 'DOES_NOT_CONSUME',
    },
    qualifiesForThirtyMinuteInterruption: !driving && minutes >= 30,
    sleeperPair: { participates: false },
    provenance: testProvenance,
  });
}

function codes(
  result: ReturnType<typeof calculateHosCore>,
): readonly string[] {
  return result.violations.map((violation) => violation.code);
}

describe('one minute before, at, and after core HOS limits', () => {
  it.each([
    { totalDrivingMinutes: 659, exceeds: false },
    { totalDrivingMinutes: 660, exceeds: false },
    { totalDrivingMinutes: 661, exceeds: true },
  ])(
    'evaluates the 11-hour driving limit at $totalDrivingMinutes minutes',
    ({ totalDrivingMinutes, exceeds }) => {
      const result = calculateHosCore({
        departureState: state(),
        dutyEvents: [
          dutyEvent(
            'drive-first-eight',
            '2026-07-20T12:00:00.000Z',
            480,
            'DRIVING',
          ),
          dutyEvent(
            'break-thirty',
            '2026-07-20T20:00:00.000Z',
            30,
            'OFF_DUTY',
          ),
          dutyEvent(
            'drive-final-leg',
            '2026-07-20T20:30:00.000Z',
            totalDrivingMinutes - 480,
            'DRIVING',
          ),
        ],
      });

      expect(codes(result).includes('DRIVING_LIMIT_EXCEEDED')).toBe(exceeds);
      expect(result.final.drivingTimeRemaining.value).toBe(
        Math.max(0, 660 - totalDrivingMinutes),
      );
    },
  );

  it.each([
    { elapsedMinutes: 839, remainingMinutes: 1, canDrive: true },
    { elapsedMinutes: 840, remainingMinutes: 0, canDrive: false },
    { elapsedMinutes: 841, remainingMinutes: 0, canDrive: false },
  ])(
    'evaluates the 14-hour window at $elapsedMinutes elapsed minutes',
    ({ elapsedMinutes, remainingMinutes, canDrive }) => {
      const result = calculateHosCore({
        departureState: state(),
        dutyEvents: [dutyEvent(
          'on-duty-window',
          '2026-07-20T12:00:00.000Z',
          elapsedMinutes,
          'ON_DUTY_NOT_DRIVING',
        )],
      });

      expect(result.final.shiftTimeRemaining.value).toBe(remainingMinutes);
      expect(result.final.canDrive).toBe(canDrive);
    },
  );

  it('allows the final cycle minute and rejects the first driving minute after zero', () => {
    const before = calculateHosCore({
      departureState: state({
        cycleTimeRemaining: { value: 1, unit: 'minute' },
      }),
      dutyEvents: [],
    });
    expect(before.final.canDrive).toBe(true);

    const at = calculateHosCore({
      departureState: state({
        cycleTimeRemaining: { value: 1, unit: 'minute' },
      }),
      dutyEvents: [dutyEvent(
        'consume-final-cycle-minute',
        '2026-07-20T12:00:00.000Z',
        1,
        'ON_DUTY_NOT_DRIVING',
      )],
    });
    expect(at.final.cycleTimeRemaining.value).toBe(0);
    expect(at.violations).toHaveLength(0);

    const after = calculateHosCore({
      departureState: state({
        cycleTimeRemaining: { value: 1, unit: 'minute' },
      }),
      dutyEvents: [
        dutyEvent(
          'consume-final-cycle-minute',
          '2026-07-20T12:00:00.000Z',
          1,
          'ON_DUTY_NOT_DRIVING',
        ),
        dutyEvent(
          'drive-after-cycle-zero',
          '2026-07-20T12:01:00.000Z',
          1,
          'DRIVING',
        ),
      ],
    });
    expect(codes(after)).toContain('CYCLE_LIMIT_EXCEEDED');
    expect(after.violations.find(
      (violation) => violation.code === 'CYCLE_LIMIT_EXCEEDED',
    )?.occurredAt).toBe('2026-07-20T12:01:00.000Z');
  });
});
