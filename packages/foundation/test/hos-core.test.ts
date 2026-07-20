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

const unverifiedUser = Object.freeze({
  origin: 'USER_ENTERED' as const,
  verification: 'UNVERIFIED' as const,
  sourceName: 'stage 05 test fixture',
  explanation: 'Test-only input.',
});

const provenance = Object.freeze({
  driver: unverifiedUser,
  departure: unverifiedUser,
  dutyStatus: unverifiedUser,
  clocks: unverifiedUser,
  dutyHistory: unverifiedUser,
  sleeper: unverifiedUser,
  carrierPolicy: unverifiedUser,
  restPreference: unverifiedUser,
});

function priorDays(): readonly unknown[] {
  return Array.from({ length: 8 }, (_, index) => ({
    date: `2026-07-${String(12 + index).padStart(2, '0')}`,
    onDutyTime: { value: 0, unit: 'minute' },
  }));
}

function departureState(
  overrides: Readonly<Record<string, unknown>> = {},
): DriverHosDepartureState {
  return validateDriverHosDepartureState({
    driver: { id: 'driver-stage-05', nameOrIdentifier: 'Driver Stage 05' },
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
    priorDutyDays: priorDays(),
    recapReturns: [],
    sleeperBerthEligible: true,
    existingSleeperPeriods: [],
    splitSleeperEnabled: false,
    restart34HourPlanned: false,
    carrierMaxDailyDriving: { value: 660, unit: 'minute' },
    carrierMaxDuty: { value: 840, unit: 'minute' },
    provenance,
    ...overrides,
  });
}

interface EventOptions {
  readonly id?: string;
  readonly startAt?: string;
  readonly minutes: number;
  readonly dutyStatus: HosDutyStatus;
  readonly eventType?:
    | 'STATUS_CHANGE'
    | 'FUEL'
    | 'LOADING'
    | 'BREAK'
    | 'REST'
    | 'OTHER';
  readonly qualifiesForThirtyMinuteInterruption?: boolean;
}

function event(options: EventOptions): DutyEvent {
  const startAt = options.startAt ?? '2026-07-20T12:00:00.000Z';
  const endAt = new Date(
    Date.parse(startAt) + options.minutes * 60_000,
  ).toISOString();
  const onDuty =
    options.dutyStatus === 'DRIVING' ||
    options.dutyStatus === 'ON_DUTY_NOT_DRIVING';
  const driving = options.dutyStatus === 'DRIVING';

  return validateDutyEvent({
    id: options.id ?? `event-${options.dutyStatus}-${String(options.minutes)}`,
    startAt,
    endAt,
    duration: { value: options.minutes, unit: 'minute' },
    dutyStatus: options.dutyStatus,
    eventType: options.eventType ?? (driving ? 'STATUS_CHANGE' : 'OTHER'),
    location: { description: 'Stage 05 test location', timeZone: 'America/Boise' },
    source: 'USER_ENTERED',
    explanation: 'Stage 05 deterministic test event.',
    clockEffects: {
      driving: driving ? 'CONSUMES' : 'DOES_NOT_CONSUME',
      shift:
        options.dutyStatus === 'SLEEPER_BERTH'
          ? 'RULE_DEPENDENT'
          : 'ADVANCES_WINDOW',
      cycle: onDuty ? 'CONSUMES' : 'DOES_NOT_CONSUME',
    },
    qualifiesForThirtyMinuteInterruption:
      options.qualifiesForThirtyMinuteInterruption ??
      (!driving && options.minutes >= 30),
    sleeperPair: { participates: false },
    provenance: unverifiedUser,
  });
}

function violationCodes(result: ReturnType<typeof calculateHosCore>): readonly string[] {
  return result.violations.map((violation) => violation.code);
}

describe('Stage 05 standard property-carrying HOS core', () => {
  it('uses fresh 11-hour, 14-hour, and cycle clocks independently', () => {
    const result = calculateHosCore({
      departureState: departureState(),
      dutyEvents: [
        event({
          id: 'drive-first-eight',
          minutes: 480,
          dutyStatus: 'DRIVING',
        }),
        event({
          id: 'break-30',
          startAt: '2026-07-20T20:00:00.000Z',
          minutes: 30,
          dutyStatus: 'OFF_DUTY',
          eventType: 'BREAK',
        }),
        event({
          id: 'drive-final-three',
          startAt: '2026-07-20T20:30:00.000Z',
          minutes: 180,
          dutyStatus: 'DRIVING',
        }),
      ],
    });

    expect(result.violations).toHaveLength(0);
    expect(result.final.drivingTimeRemaining.value).toBe(0);
    expect(result.final.shiftTimeRemaining.value).toBe(150);
    expect(result.final.cycleTimeRemaining.value).toBe(3540);
    expect(result.nextRequiredAction.code).toBe(
      'TAKE_TEN_CONSECUTIVE_HOURS_OFF_DUTY',
    );
  });

  it('stops legal driving at the shift limit when more driving time remains', () => {
    const result = calculateHosCore({
      departureState: departureState({
        drivingTimeRemaining: { value: 600, unit: 'minute' },
        shiftTimeRemaining: { value: 300, unit: 'minute' },
        cycleTimeRemaining: { value: 1000, unit: 'minute' },
      }),
      dutyEvents: [event({ minutes: 301, dutyStatus: 'DRIVING' })],
    });

    expect(result.transitions[0]?.legalDrivingTime.value).toBe(300);
    expect(result.transitions[0]?.prohibitedDrivingTime.value).toBe(1);
    expect(violationCodes(result)).toContain('SHIFT_WINDOW_EXCEEDED');
    expect(result.violations.find(
      (violation) => violation.code === 'SHIFT_WINDOW_EXCEEDED',
    )?.occurredAt).toBe('2026-07-20T17:00:00.000Z');
  });

  it('requires an interruption after exactly eight cumulative driving hours', () => {
    const atEightHours = calculateHosCore({
      departureState: departureState(),
      dutyEvents: [event({ minutes: 480, dutyStatus: 'DRIVING' })],
    });
    expect(atEightHours.violations).toHaveLength(0);
    expect(atEightHours.final.canDrive).toBe(false);
    expect(atEightHours.nextRequiredAction.code).toBe(
      'TAKE_THIRTY_MINUTE_INTERRUPTION',
    );

    const oneMinuteOver = calculateHosCore({
      departureState: departureState(),
      dutyEvents: [event({ minutes: 481, dutyStatus: 'DRIVING' })],
    });
    expect(violationCodes(oneMinuteOver)).toContain(
      'THIRTY_MINUTE_INTERRUPTION_VIOLATION',
    );
    expect(oneMinuteOver.violations.find(
      (violation) =>
        violation.code === 'THIRTY_MINUTE_INTERRUPTION_VIOLATION',
    )?.occurredAt).toBe('2026-07-20T20:00:00.000Z');
  });

  it('accepts a 45-minute non-driving shipper stop as an interruption', () => {
    const result = calculateHosCore({
      departureState: departureState({
        drivenSinceLastQualifyingInterruption: {
          value: 480,
          unit: 'minute',
        },
      }),
      dutyEvents: [event({
        minutes: 45,
        dutyStatus: 'ON_DUTY_NOT_DRIVING',
        eventType: 'LOADING',
      })],
    });

    expect(result.final.drivenSinceLastQualifyingInterruption.value).toBe(0);
    expect(result.final.canDrive).toBe(true);
    expect(
      result.transitions[0]?.milestones.qualifyingInterruptionCompletedAt,
    ).toBe('2026-07-20T12:30:00.000Z');
  });

  it('does not accept a 20-minute stop as an interruption', () => {
    const result = calculateHosCore({
      departureState: departureState({
        drivenSinceLastQualifyingInterruption: {
          value: 480,
          unit: 'minute',
        },
      }),
      dutyEvents: [event({
        minutes: 20,
        dutyStatus: 'ON_DUTY_NOT_DRIVING',
        eventType: 'LOADING',
        qualifiesForThirtyMinuteInterruption: false,
      })],
    });

    expect(result.final.drivenSinceLastQualifyingInterruption.value).toBe(480);
    expect(result.final.canDrive).toBe(false);
    expect(result.nextRequiredAction.code).toBe(
      'TAKE_THIRTY_MINUTE_INTERRUPTION',
    );
  });

  it('combines consecutive eligible non-driving statuses into one interruption', () => {
    const result = calculateHosCore({
      departureState: departureState({
        drivenSinceLastQualifyingInterruption: {
          value: 480,
          unit: 'minute',
        },
      }),
      dutyEvents: [
        event({
          id: 'off-20',
          minutes: 20,
          dutyStatus: 'OFF_DUTY',
          eventType: 'BREAK',
          qualifiesForThirtyMinuteInterruption: false,
        }),
        event({
          id: 'onduty-10',
          startAt: '2026-07-20T12:20:00.000Z',
          minutes: 10,
          dutyStatus: 'ON_DUTY_NOT_DRIVING',
          eventType: 'OTHER',
          qualifiesForThirtyMinuteInterruption: false,
        }),
      ],
    });

    expect(result.final.drivenSinceLastQualifyingInterruption.value).toBe(0);
    expect(
      result.transitions[1]?.milestones.qualifyingInterruptionCompletedAt,
    ).toBe('2026-07-20T12:30:00.000Z');
  });

  it('treats fuel as on-duty-not-driving time', () => {
    const result = calculateHosCore({
      departureState: departureState(),
      dutyEvents: [event({
        minutes: 15,
        dutyStatus: 'ON_DUTY_NOT_DRIVING',
        eventType: 'FUEL',
        qualifiesForThirtyMinuteInterruption: false,
      })],
    });

    expect(result.final.drivingTimeRemaining.value).toBe(660);
    expect(result.final.shiftTimeRemaining.value).toBe(825);
    expect(result.final.cycleTimeRemaining.value).toBe(4185);
    expect(result.final.onDutyTimeCurrentShift.value).toBe(15);
  });

  it('does not pause an active 14-hour window during ordinary waiting', () => {
    const result = calculateHosCore({
      departureState: departureState({
        shiftTimeRemaining: { value: 600, unit: 'minute' },
        onDutyTimeCurrentShift: { value: 240, unit: 'minute' },
      }),
      dutyEvents: [event({
        minutes: 120,
        dutyStatus: 'OFF_DUTY',
        eventType: 'BREAK',
      })],
    });

    expect(result.final.shiftTimeRemaining.value).toBe(480);
    expect(result.final.cycleTimeRemaining.value).toBe(4200);
  });

  it('resets the driving and shift clocks after ten consecutive off-duty hours', () => {
    const result = calculateHosCore({
      departureState: departureState({
        drivingTimeRemaining: { value: 0, unit: 'minute' },
        shiftTimeRemaining: { value: 0, unit: 'minute' },
        cycleTimeRemaining: { value: 500, unit: 'minute' },
        drivenSinceLastQualifyingInterruption: {
          value: 480,
          unit: 'minute',
        },
        onDutyTimeCurrentShift: { value: 840, unit: 'minute' },
        offDutyTimeImmediatelyBeforeDeparture: { value: 0, unit: 'minute' },
        qualifyingTenHourBreakCompleted: false,
      }),
      dutyEvents: [
        event({
          id: 'reset-600',
          minutes: 600,
          dutyStatus: 'OFF_DUTY',
          eventType: 'REST',
        }),
        event({
          id: 'drive-after-reset',
          startAt: '2026-07-20T22:00:00.000Z',
          minutes: 60,
          dutyStatus: 'DRIVING',
        }),
      ],
    });

    expect(
      result.transitions[0]?.milestones.tenHourResetCompletedAt,
    ).toBe('2026-07-20T22:00:00.000Z');
    expect(result.transitions[0]?.after.shiftWindowActive).toBe(false);
    expect(result.final.drivingTimeRemaining.value).toBe(600);
    expect(result.final.shiftTimeRemaining.value).toBe(780);
    expect(result.final.cycleTimeRemaining.value).toBe(440);
    expect(result.violations).toHaveLength(0);
  });

  it('blocks departure when current cycle availability is zero', () => {
    const result = calculateHosCore({
      departureState: departureState({
        cycleTimeRemaining: { value: 0, unit: 'minute' },
      }),
      dutyEvents: [],
    });

    expect(result.initial.canDrive).toBe(false);
    expect(result.initial.blockingReasons.map((reason) => reason.code)).toContain(
      'CYCLE_LIMIT_REACHED',
    );
    expect(result.nextRequiredAction.code).toBe(
      'WAIT_FOR_CYCLE_AVAILABILITY',
    );
  });
});

describe('minute-exact boundaries', () => {
  it.each([
    { driven: 479, canDrive: true },
    { driven: 480, canDrive: false },
    { driven: 481, canDrive: false },
  ])('evaluates the interruption threshold at $driven minutes', ({ driven, canDrive }) => {
    const result = calculateHosCore({
      departureState: departureState({
        drivenSinceLastQualifyingInterruption: {
          value: driven,
          unit: 'minute',
        },
      }),
      dutyEvents: [],
    });
    expect(result.final.canDrive).toBe(canDrive);
  });

  it.each([
    { minutes: 29, qualifies: false },
    { minutes: 30, qualifies: true },
    { minutes: 31, qualifies: true },
  ])('evaluates a $minutes-minute non-driving period', ({ minutes, qualifies }) => {
    const result = calculateHosCore({
      departureState: departureState({
        drivenSinceLastQualifyingInterruption: {
          value: 480,
          unit: 'minute',
        },
      }),
      dutyEvents: [event({
        minutes,
        dutyStatus: 'OFF_DUTY',
        eventType: 'BREAK',
        qualifiesForThirtyMinuteInterruption: minutes >= 30,
      })],
    });
    expect(result.final.drivenSinceLastQualifyingInterruption.value === 0).toBe(
      qualifies,
    );
  });

  it.each([
    { minutes: 599, resets: false },
    { minutes: 600, resets: true },
    { minutes: 601, resets: true },
  ])('evaluates a $minutes-minute reset period', ({ minutes, resets }) => {
    const result = calculateHosCore({
      departureState: departureState({
        drivingTimeRemaining: { value: 0, unit: 'minute' },
        shiftTimeRemaining: { value: 0, unit: 'minute' },
        cycleTimeRemaining: { value: 500, unit: 'minute' },
        onDutyTimeCurrentShift: { value: 840, unit: 'minute' },
        offDutyTimeImmediatelyBeforeDeparture: { value: 0, unit: 'minute' },
        qualifyingTenHourBreakCompleted: false,
      }),
      dutyEvents: [event({
        minutes,
        dutyStatus: 'OFF_DUTY',
        eventType: 'REST',
      })],
    });
    expect(
      result.transitions[0]?.milestones.tenHourResetCompletedAt !== undefined,
    ).toBe(resets);
    expect(result.final.drivingTimeRemaining.value).toBe(resets ? 660 : 0);
  });

  it('allows the final legal minute and flags the first minute beyond a clock', () => {
    const exactlyAtShift = calculateHosCore({
      departureState: departureState({
        drivingTimeRemaining: { value: 10, unit: 'minute' },
        shiftTimeRemaining: { value: 1, unit: 'minute' },
        cycleTimeRemaining: { value: 10, unit: 'minute' },
      }),
      dutyEvents: [event({ minutes: 1, dutyStatus: 'DRIVING' })],
    });
    expect(exactlyAtShift.violations).toHaveLength(0);

    const oneMinutePastShift = calculateHosCore({
      departureState: departureState({
        drivingTimeRemaining: { value: 10, unit: 'minute' },
        shiftTimeRemaining: { value: 1, unit: 'minute' },
        cycleTimeRemaining: { value: 10, unit: 'minute' },
      }),
      dutyEvents: [event({ minutes: 2, dutyStatus: 'DRIVING' })],
    });
    expect(violationCodes(oneMinutePastShift)).toContain(
      'SHIFT_WINDOW_EXCEEDED',
    );
    expect(oneMinutePastShift.violations.find(
      (violation) => violation.code === 'SHIFT_WINDOW_EXCEEDED',
    )?.occurredAt).toBe('2026-07-20T12:01:00.000Z');
  });
});
