import { describe, expect, it } from 'vitest';

import { calculateHosCycle } from '../src/hos-cycle.js';
import {
  validateDriverHosDepartureState,
  validateDutyEvent,
} from '../src/hos.js';
import { ianaTimeZone, utcInstant } from '../src/time.js';
import type {
  DriverHosDepartureState,
  DutyEvent,
  HosCycleType,
  HosDutyStatus,
} from '../src/hos.js';

const unverifiedUser = Object.freeze({
  origin: 'USER_ENTERED' as const,
  verification: 'UNVERIFIED' as const,
  sourceName: 'stage 06 test fixture',
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

function localDateAt(instant: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant));
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function addCalendarDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function priorDays(
  departureAt: string,
  timeZone: string,
  count: number,
): readonly unknown[] {
  const departureDate = localDateAt(departureAt, timeZone);
  return Array.from({ length: count }, (_, index) => ({
    date: addCalendarDays(departureDate, index - count),
    onDutyTime: { value: 0, unit: 'minute' },
  }));
}

function departureState(
  overrides: Readonly<Record<string, unknown>> = {},
): DriverHosDepartureState {
  const departureAt = typeof overrides.departureAt === 'string'
    ? overrides.departureAt
    : '2026-07-20T12:00:00.000Z';
  const departureTimeZone = typeof overrides.departureTimeZone === 'string'
    ? overrides.departureTimeZone
    : 'UTC';
  const cycleType = (
    overrides.cycleType ?? 'SEVENTY_HOURS_EIGHT_DAYS'
  ) as HosCycleType;
  const priorDayCount = cycleType === 'SEVENTY_HOURS_EIGHT_DAYS' ? 8 : 7;
  return validateDriverHosDepartureState({
    driver: { id: 'driver-stage-06', nameOrIdentifier: 'Driver Stage 06' },
    departureAt,
    departureTimeZone,
    currentDutyStatus: 'ON_DUTY_NOT_DRIVING',
    currentDutyStatusStartedAt: departureAt,
    drivingTimeRemaining: { value: 660, unit: 'minute' },
    shiftTimeRemaining: { value: 840, unit: 'minute' },
    cycleTimeRemaining: {
      value: cycleType === 'SEVENTY_HOURS_EIGHT_DAYS' ? 4200 : 3600,
      unit: 'minute',
    },
    cycleType,
    drivenSinceLastQualifyingInterruption: { value: 0, unit: 'minute' },
    onDutyTimeCurrentShift: { value: 0, unit: 'minute' },
    offDutyTimeImmediatelyBeforeDeparture: { value: 600, unit: 'minute' },
    qualifyingTenHourBreakCompleted: true,
    priorDutyDays: priorDays(departureAt, departureTimeZone, priorDayCount),
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

interface EventInput {
  readonly id: string;
  readonly startAt: string;
  readonly endAt: string;
  readonly dutyStatus: HosDutyStatus;
  readonly locationTimeZone?: string;
}

function event(input: EventInput): DutyEvent {
  const minutes = (Date.parse(input.endAt) - Date.parse(input.startAt)) / 60_000;
  const onDuty = input.dutyStatus === 'DRIVING'
    || input.dutyStatus === 'ON_DUTY_NOT_DRIVING';
  return validateDutyEvent({
    id: input.id,
    startAt: input.startAt,
    endAt: input.endAt,
    duration: { value: minutes, unit: 'minute' },
    dutyStatus: input.dutyStatus,
    eventType: input.dutyStatus === 'DRIVING'
      ? 'STATUS_CHANGE'
      : isRestartEligible(input.dutyStatus) ? 'REST' : 'OTHER',
    location: {
      description: 'Stage 06 test location',
      timeZone: input.locationTimeZone ?? 'UTC',
    },
    source: 'USER_ENTERED',
    explanation: 'Stage 06 deterministic test event.',
    clockEffects: {
      driving: input.dutyStatus === 'DRIVING'
        ? 'CONSUMES'
        : 'DOES_NOT_CONSUME',
      shift: input.dutyStatus === 'SLEEPER_BERTH'
        ? 'RULE_DEPENDENT'
        : 'ADVANCES_WINDOW',
      cycle: onDuty ? 'CONSUMES' : 'DOES_NOT_CONSUME',
    },
    qualifiesForThirtyMinuteInterruption:
      input.dutyStatus !== 'DRIVING' && minutes >= 30,
    sleeperPair: { participates: false },
    provenance: unverifiedUser,
  });
}

function isRestartEligible(status: HosDutyStatus): boolean {
  return status === 'OFF_DUTY' || status === 'SLEEPER_BERTH';
}

interface OnDutyInterval {
  readonly startAt: string;
  readonly endAt: string;
  readonly dutyStatus?: 'DRIVING' | 'ON_DUTY_NOT_DRIVING';
  readonly locationTimeZone?: string;
}

function history(
  startAt: string,
  endAt: string,
  intervals: readonly OnDutyInterval[],
): readonly DutyEvent[] {
  const result: DutyEvent[] = [];
  let cursor = startAt;
  intervals.forEach((interval, index) => {
    if (Date.parse(interval.startAt) > Date.parse(cursor)) {
      result.push(event({
        id: `history-off-${String(index)}`,
        startAt: cursor,
        endAt: interval.startAt,
        dutyStatus: 'OFF_DUTY',
      }));
    }
    result.push(event({
      id: `history-on-${String(index)}`,
      startAt: interval.startAt,
      endAt: interval.endAt,
      dutyStatus: interval.dutyStatus ?? 'ON_DUTY_NOT_DRIVING',
      ...(interval.locationTimeZone === undefined
        ? {}
        : { locationTimeZone: interval.locationTimeZone }),
    }));
    cursor = interval.endAt;
  });
  if (Date.parse(cursor) < Date.parse(endAt)) {
    result.push(event({
      id: 'history-final-off',
      startAt: cursor,
      endAt,
      dutyStatus: 'OFF_DUTY',
    }));
  }
  return Object.freeze(result);
}

function dailyIntervals(
  firstDate: string,
  count: number,
  minutes: number,
  boundaryHour = 0,
): readonly OnDutyInterval[] {
  return Object.freeze(Array.from({ length: count }, (_, index) => {
    const date = addCalendarDays(firstDate, index);
    const start = new Date(`${date}T00:00:00.000Z`);
    start.setUTCHours(boundaryHour);
    const end = new Date(start.getTime() + minutes * 60_000);
    return Object.freeze({
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    });
  }));
}

const utcBoundary = Object.freeze({
  timeZone: ianaTimeZone('UTC'),
  localStartTime: '00:00',
  repeatedTimeChoice: 'earlier' as const,
  gapResolution: 'NEXT_VALID_INSTANT' as const,
});

describe('Stage 06 rolling HOS cycle calculation', () => {
  it('derives a 70-hour/8-day clock from timestamped history and reports entered discrepancies', () => {
    const departure = departureState({
      cycleTimeRemaining: { value: 4000, unit: 'minute' },
    });
    const result = calculateHosCycle({
      departureState: departure,
      historicalDutyEvents: history(
        '2026-07-13T00:00:00.000Z',
        departure.departureAt,
        dailyIntervals('2026-07-13', 8, 60),
      ),
      dutyEvents: [],
      regulatoryDayBoundary: utcBoundary,
    });

    expect(result.regulatoryWindow).toHaveLength(8);
    expect(result.regulatoryWindow.reduce(
      (total, day) => total + day.onDutyTime.value,
      0,
    )).toBe(480);
    expect(result.initial.cycleTimeRemaining.value).toBe(3720);
    expect(result.cycleReconciliation.status).toBe('DISCREPANCY');
    expect(result.cycleReconciliation.enteredMinusDerived).toBe(280);
  });

  it('supports the 60-hour/7-day cycle without inferring it from another clock', () => {
    const departure = departureState({
      cycleType: 'SIXTY_HOURS_SEVEN_DAYS',
      cycleTimeRemaining: { value: 3180, unit: 'minute' },
    });
    const result = calculateHosCycle({
      departureState: departure,
      historicalDutyEvents: history(
        '2026-07-14T00:00:00.000Z',
        departure.departureAt,
        dailyIntervals('2026-07-14', 7, 60),
      ),
      dutyEvents: [],
      regulatoryDayBoundary: utcBoundary,
    });

    expect(result.regulatoryWindow).toHaveLength(7);
    expect(result.initial.cycleTimeRemaining.value).toBe(3180);
    expect(result.cycleReconciliation.status).toBe('MATCH');
  });

  it('blocks driving and on-duty planning at the exact zero-cycle boundary', () => {
    const departure = departureState({
      cycleTimeRemaining: { value: 0, unit: 'minute' },
    });
    const fullCycleHistory = history(
      '2026-07-13T00:00:00.000Z',
      departure.departureAt,
      dailyIntervals('2026-07-13', 7, 600),
    );
    const drive = event({
      id: 'drive-with-zero-cycle',
      startAt: departure.departureAt,
      endAt: '2026-07-20T12:01:00.000Z',
      dutyStatus: 'DRIVING',
    });
    const result = calculateHosCycle({
      departureState: departure,
      historicalDutyEvents: fullCycleHistory,
      dutyEvents: [drive],
      regulatoryDayBoundary: utcBoundary,
    });

    expect(result.initial.canPerformOnDutyWork).toBe(false);
    expect(result.transitions[0]?.legalOnDutyTime.value).toBe(0);
    expect(result.transitions[0]?.prohibitedOnDutyTime.value).toBe(1);
    expect(result.violations[0]?.code).toBe('CYCLE_DRIVING_LIMIT_EXCEEDED');
    expect(result.violations[0]?.occurredAt).toBe(departure.departureAt);
  });

  it('returns recap hours at the configured home-terminal boundary instead of arbitrary midnight', () => {
    const departure = departureState({
      cycleTimeRemaining: { value: 4140, unit: 'minute' },
    });
    const boundary = Object.freeze({
      ...utcBoundary,
      localStartTime: '04:00',
    });
    const result = calculateHosCycle({
      departureState: departure,
      historicalDutyEvents: history(
        '2026-07-13T04:00:00.000Z',
        departure.departureAt,
        [{
          startAt: '2026-07-13T04:00:00.000Z',
          endAt: '2026-07-13T05:00:00.000Z',
        }],
      ),
      dutyEvents: [],
      regulatoryDayBoundary: boundary,
    });

    const firstRecap = result.availabilityEvents.find(
      (value) => value.kind === 'RECAP',
    );
    expect(firstRecap?.sourceDate).toBe('2026-07-13');
    expect(firstRecap?.availableAt).toBe('2026-07-21T04:00:00.000Z');
    expect(firstRecap?.availableTime.value).toBe(60);
  });

  it('applies a qualifying future restart only when it was explicitly planned', () => {
    const recentIntervals: readonly OnDutyInterval[] = [
      {
        startAt: '2026-07-17T00:00:00.000Z',
        endAt: '2026-07-17T23:20:00.000Z',
      },
      {
        startAt: '2026-07-18T00:00:00.000Z',
        endAt: '2026-07-18T23:20:00.000Z',
      },
      {
        startAt: '2026-07-19T12:40:00.000Z',
        endAt: '2026-07-20T12:00:00.000Z',
      },
    ];
    const plannedDeparture = departureState({
      cycleTimeRemaining: { value: 0, unit: 'minute' },
      restart34HourPlanned: true,
    });
    const historical = history(
      '2026-07-13T00:00:00.000Z',
      plannedDeparture.departureAt,
      recentIntervals,
    );
    const rest = event({
      id: 'planned-restart-2040',
      startAt: plannedDeparture.departureAt,
      endAt: '2026-07-21T22:00:00.000Z',
      dutyStatus: 'OFF_DUTY',
    });
    const drive = event({
      id: 'drive-after-restart',
      startAt: rest.endAt,
      endAt: '2026-07-21T23:00:00.000Z',
      dutyStatus: 'DRIVING',
    });
    const planned = calculateHosCycle({
      departureState: plannedDeparture,
      historicalDutyEvents: historical,
      dutyEvents: [rest, drive],
      regulatoryDayBoundary: utcBoundary,
    });
    const notPlanned = calculateHosCycle({
      departureState: departureState({
        cycleTimeRemaining: { value: 0, unit: 'minute' },
        restart34HourPlanned: false,
      }),
      historicalDutyEvents: historical,
      dutyEvents: [rest, drive],
      regulatoryDayBoundary: utcBoundary,
    });

    expect(planned.availabilityEvents.find(
      (value) => value.kind === 'THIRTY_FOUR_HOUR_RESTART',
    )?.availableAt).toBe('2026-07-21T22:00:00.000Z');
    expect(planned.violations).toHaveLength(0);
    expect(planned.final.cycleTimeRemaining.value).toBe(4140);
    expect(notPlanned.violations[0]?.code).toBe(
      'CYCLE_DRIVING_LIMIT_EXCEEDED',
    );
  });

  it.each([
    [2039, false],
    [2040, true],
    [2041, true],
  ])('handles the 34-hour restart boundary at %i minutes', (minutes: number, qualifies: boolean) => {
    const departure = departureState({
      cycleTimeRemaining: { value: 0, unit: 'minute' },
      restart34HourPlanned: true,
    });
    const historical = history(
      '2026-07-13T00:00:00.000Z',
      departure.departureAt,
      [
        {
          startAt: '2026-07-17T00:00:00.000Z',
          endAt: '2026-07-17T23:20:00.000Z',
        },
        {
          startAt: '2026-07-18T00:00:00.000Z',
          endAt: '2026-07-18T23:20:00.000Z',
        },
        {
          startAt: '2026-07-19T12:40:00.000Z',
          endAt: '2026-07-20T12:00:00.000Z',
        },
      ],
    );
    const restEnd = new Date(
      Date.parse(departure.departureAt) + minutes * 60_000,
    ).toISOString();
    const result = calculateHosCycle({
      departureState: departure,
      historicalDutyEvents: historical,
      dutyEvents: [event({
        id: `restart-boundary-${String(minutes)}`,
        startAt: departure.departureAt,
        endAt: restEnd,
        dutyStatus: 'OFF_DUTY',
      })],
      regulatoryDayBoundary: utcBoundary,
    });

    expect(result.availabilityEvents.some(
      (value) => value.kind === 'THIRTY_FOUR_HOUR_RESTART',
    )).toBe(qualifies);
  });

  it('chooses a sooner recap instead of an unnecessary planned restart', () => {
    const departure = departureState({
      cycleTimeRemaining: { value: 0, unit: 'minute' },
      restart34HourPlanned: true,
    });
    const result = calculateHosCycle({
      departureState: departure,
      historicalDutyEvents: history(
        '2026-07-13T00:00:00.000Z',
        departure.departureAt,
        dailyIntervals('2026-07-13', 7, 600),
      ),
      dutyEvents: [],
      regulatoryDayBoundary: utcBoundary,
    });

    expect(result.nextCycleAvailability.code).toBe('WAIT_FOR_RECAP');
    expect(result.nextCycleAvailability.availableAt).toBe(
      '2026-07-21T00:00:00.000Z',
    );
  });

  it('uses an explicitly selected historical restart without mutating earlier duty evidence', () => {
    const departure = departureState({
      cycleTimeRemaining: { value: 3600, unit: 'minute' },
    });
    const historical = history(
      '2026-07-13T00:00:00.000Z',
      departure.departureAt,
      [
        {
          startAt: '2026-07-13T00:00:00.000Z',
          endAt: '2026-07-14T00:00:00.000Z',
        },
        {
          startAt: '2026-07-14T00:00:00.000Z',
          endAt: '2026-07-15T00:00:00.000Z',
        },
        {
          startAt: '2026-07-15T00:00:00.000Z',
          endAt: '2026-07-15T02:00:00.000Z',
        },
        {
          startAt: '2026-07-17T10:00:00.000Z',
          endAt: '2026-07-17T20:00:00.000Z',
        },
      ],
    );
    const withoutRestart = calculateHosCycle({
      departureState: departureState({
        cycleTimeRemaining: { value: 600, unit: 'minute' },
      }),
      historicalDutyEvents: historical,
      dutyEvents: [],
      regulatoryDayBoundary: utcBoundary,
    });
    const withRestart = calculateHosCycle({
      departureState: departure,
      historicalDutyEvents: historical,
      dutyEvents: [],
      regulatoryDayBoundary: utcBoundary,
      selectedHistoricalRestart: {
        startAt: utcInstant('2026-07-16T00:00:00.000Z'),
        endAt: utcInstant('2026-07-17T10:00:00.000Z'),
        explanation: 'Carrier and driver explicitly selected the evidenced restart.',
      },
    });

    expect(withoutRestart.initial.cycleTimeRemaining.value).toBe(600);
    expect(withRestart.initial.cycleTimeRemaining.value).toBe(3600);
    expect(withRestart.selectedHistoricalRestart?.completedAt).toBe(
      '2026-07-17T10:00:00.000Z',
    );
    expect(historical[0]?.startAt).toBe('2026-07-13T00:00:00.000Z');
  });
});

describe('Stage 06 regulatory boundary DST handling', () => {
  it('resolves a nonexistent spring boundary only through the configured gap policy', () => {
    const departure = departureState({
      departureAt: '2026-03-09T12:00:00.000Z',
      departureTimeZone: 'America/Los_Angeles',
      cycleType: 'SIXTY_HOURS_SEVEN_DAYS',
      cycleTimeRemaining: { value: 3600, unit: 'minute' },
    });
    const result = calculateHosCycle({
      departureState: departure,
      historicalDutyEvents: history(
        '2026-03-03T10:30:00.000Z',
        departure.departureAt,
        [],
      ),
      dutyEvents: [],
      regulatoryDayBoundary: {
        timeZone: ianaTimeZone('America/Los_Angeles'),
        localStartTime: '02:30',
        repeatedTimeChoice: 'earlier',
        gapResolution: 'NEXT_VALID_INSTANT',
      },
    });
    const transitionDay = result.regulatoryWindow.find(
      (day) => day.date === '2026-03-08',
    );

    expect(transitionDay?.startResolution).toBe('GAP_NEXT');
    expect(transitionDay?.startAt).toBe('2026-03-08T10:30:00.000Z');
  });

  it('distinguishes the earlier and later repeated fall boundary', () => {
    const departure = departureState({
      departureAt: '2026-11-02T12:00:00.000Z',
      departureTimeZone: 'America/Los_Angeles',
      cycleType: 'SIXTY_HOURS_SEVEN_DAYS',
      cycleTimeRemaining: { value: 3600, unit: 'minute' },
    });
    const historical = history(
      '2026-10-27T08:30:00.000Z',
      departure.departureAt,
      [],
    );
    const earlier = calculateHosCycle({
      departureState: departure,
      historicalDutyEvents: historical,
      dutyEvents: [],
      regulatoryDayBoundary: {
        timeZone: ianaTimeZone('America/Los_Angeles'),
        localStartTime: '01:30',
        repeatedTimeChoice: 'earlier',
        gapResolution: 'NEXT_VALID_INSTANT',
      },
    });
    const later = calculateHosCycle({
      departureState: departure,
      historicalDutyEvents: historical,
      dutyEvents: [],
      regulatoryDayBoundary: {
        timeZone: ianaTimeZone('America/Los_Angeles'),
        localStartTime: '01:30',
        repeatedTimeChoice: 'later',
        gapResolution: 'NEXT_VALID_INSTANT',
      },
    });

    expect(earlier.regulatoryWindow.find(
      (day) => day.date === '2026-11-01',
    )?.startAt).toBe('2026-11-01T08:30:00.000Z');
    expect(later.regulatoryWindow.find(
      (day) => day.date === '2026-11-01',
    )?.startAt).toBe('2026-11-01T09:30:00.000Z');
  });

  it('uses the home-terminal boundary instead of each event location time zone', () => {
    const departure = departureState({
      cycleTimeRemaining: { value: 4140, unit: 'minute' },
    });
    const result = calculateHosCycle({
      departureState: departure,
      historicalDutyEvents: history(
        '2026-07-13T00:00:00.000Z',
        departure.departureAt,
        [{
          startAt: '2026-07-13T00:00:00.000Z',
          endAt: '2026-07-13T01:00:00.000Z',
          locationTimeZone: 'America/New_York',
        }],
      ),
      dutyEvents: [],
      regulatoryDayBoundary: utcBoundary,
    });

    expect(result.availabilityEvents.find(
      (value) => value.kind === 'RECAP',
    )?.availableAt).toBe('2026-07-21T00:00:00.000Z');
  });
});
