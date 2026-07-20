import { describe, expect, it } from 'vitest';

import {
  HosValidationError,
  deserializeDriverHosDepartureState,
  driverHosDepartureStateFromApi,
  driverHosDepartureStateToApi,
  serializeDriverHosDepartureState,
  validateDriverHosDepartureState,
  validateDutyEvent,
  validateDutyEventHistory,
} from '../src/hos.js';

const unverifiedUser = Object.freeze({
  origin: 'USER_ENTERED' as const,
  verification: 'UNVERIFIED' as const,
  sourceName: 'dispatcher form',
  explanation: 'Entered by the planner and not independently verified.',
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
    onDutyTime: { value: 480, unit: 'minute' },
  }));
}

function validState(overrides: Readonly<Record<string, unknown>> = {}): unknown {
  return {
    driver: { id: 'driver-1', nameOrIdentifier: 'Driver 42' },
    departureAt: '2026-07-20T12:00:00.000Z',
    departureTimeZone: 'America/Boise',
    currentDutyStatus: 'ON_DUTY_NOT_DRIVING',
    currentDutyStatusStartedAt: '2026-07-20T11:30:00.000Z',
    drivingTimeRemaining: { value: 570, unit: 'minute' },
    shiftTimeRemaining: { value: 405, unit: 'minute' },
    cycleTimeRemaining: { value: 1320, unit: 'minute' },
    cycleType: 'SEVENTY_HOURS_EIGHT_DAYS',
    drivenSinceLastQualifyingInterruption: { value: 90, unit: 'minute' },
    onDutyTimeCurrentShift: { value: 120, unit: 'minute' },
    offDutyTimeImmediatelyBeforeDeparture: { value: 600, unit: 'minute' },
    qualifyingTenHourBreakCompleted: true,
    priorDutyDays: priorDays(),
    recapReturns: [
      {
        sourceDate: '2026-07-12',
        availableAt: '2026-07-21T07:00:00.000Z',
        returnedTime: { value: 480, unit: 'minute' },
      },
    ],
    sleeperBerthEligible: true,
    existingSleeperPeriods: [
      {
        id: 'sleep-1',
        startAt: '2026-07-19T03:00:00.000Z',
        endAt: '2026-07-19T10:00:00.000Z',
        duration: { value: 420, unit: 'minute' },
        candidateRole: 'LONG_PERIOD',
        pairId: 'pair-1',
        source: 'ELD_PROVIDER',
        explanation: 'Seven-hour sleeper candidate imported from duty-status evidence.',
      },
    ],
    splitSleeperEnabled: false,
    restart34HourPlanned: false,
    carrierMaxDailyDriving: { value: 630, unit: 'minute' },
    carrierMaxDuty: { value: 780, unit: 'minute' },
    nightlyRestPreference: {
      startLocalTime: '21:00',
      endLocalTime: '07:00',
      timeZone: 'America/Boise',
    },
    provenance,
    ...overrides,
  };
}

function dutyEvent(overrides: Readonly<Record<string, unknown>> = {}): unknown {
  return {
    id: 'event-1',
    startAt: '2026-07-20T12:00:00.000Z',
    endAt: '2026-07-20T12:30:00.000Z',
    duration: { value: 30, unit: 'minute' },
    dutyStatus: 'ON_DUTY_NOT_DRIVING',
    eventType: 'PRE_TRIP_INSPECTION',
    location: { description: 'Boise terminal', timeZone: 'America/Boise' },
    source: 'USER_ENTERED',
    explanation: 'Driver performs a pre-trip inspection.',
    clockEffects: {
      driving: 'DOES_NOT_CONSUME',
      shift: 'ADVANCES_WINDOW',
      cycle: 'CONSUMES',
    },
    qualifiesForThirtyMinuteInterruption: true,
    sleeperPair: { participates: false },
    provenance: unverifiedUser,
    ...overrides,
  };
}

function expectIssue(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error('Expected validation to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(HosValidationError);
    if (!(error instanceof HosValidationError)) return;
    expect(error.issues.some((issue) => issue.code === code)).toBe(true);
  }
}

describe('driver HOS departure state', () => {
  it('keeps driving, shift, and cycle clocks independent', () => {
    const state = validateDriverHosDepartureState(validState());
    expect(state.drivingTimeRemaining.value).toBe(570);
    expect(state.shiftTimeRemaining.value).toBe(405);
    expect(state.cycleTimeRemaining.value).toBe(1320);
  });

  it('keeps carrier targets separate from the entered legal clocks', () => {
    const state = validateDriverHosDepartureState(validState({
      drivingTimeRemaining: { value: 660, unit: 'minute' },
      shiftTimeRemaining: { value: 840, unit: 'minute' },
      carrierMaxDailyDriving: { value: 600, unit: 'minute' },
      carrierMaxDuty: { value: 720, unit: 'minute' },
    }));
    expect(state.drivingTimeRemaining.value).toBe(660);
    expect(state.carrierMaxDailyDriving.value).toBe(600);
    expect(state.shiftTimeRemaining.value).toBe(840);
    expect(state.carrierMaxDuty.value).toBe(720);
  });

  it('rejects contradictions and clocks above their configured maxima', () => {
    expectIssue(
      () => validateDriverHosDepartureState(validState({
        currentDutyStatusStartedAt: '2026-07-20T12:01:00.000Z',
      })),
      'CONTRADICTORY_STATE',
    );
    expectIssue(
      () => validateDriverHosDepartureState(validState({
        drivingTimeRemaining: { value: 661, unit: 'minute' },
      })),
      'CLOCK_EXCEEDS_MAXIMUM',
    );
    expectIssue(
      () => validateDriverHosDepartureState(validState({
        qualifyingTenHourBreakCompleted: true,
        offDutyTimeImmediatelyBeforeDeparture: { value: 599, unit: 'minute' },
      })),
      'CONTRADICTORY_STATE',
    );
  });

  it('requires consecutive prior-day history and valid IANA time zones', () => {
    const days = [...priorDays()];
    days[3] = { date: '2026-07-14', onDutyTime: { value: 480, unit: 'minute' } };
    expectIssue(
      () => validateDriverHosDepartureState(validState({ priorDutyDays: days })),
      'INVALID_PRIOR_DAY_HISTORY',
    );
    expectIssue(
      () => validateDriverHosDepartureState(validState({ departureTimeZone: 'Mountain-ish' })),
      'INVALID_TIME_ZONE',
    );
  });

  it('round-trips through API and JSON serialization without losing minutes', () => {
    const state = validateDriverHosDepartureState(validState());
    const api = driverHosDepartureStateToApi(state);
    const fromApi = driverHosDepartureStateFromApi(api);
    const restored = deserializeDriverHosDepartureState(
      serializeDriverHosDepartureState(fromApi),
    );
    expect(driverHosDepartureStateToApi(restored)).toEqual(api);
  });

  it('rejects malformed serialized API payloads with structured issues', () => {
    expectIssue(
      () => deserializeDriverHosDepartureState('{"driverNameOrIdentifier":"only one field"}'),
      'MISSING_FIELD',
    );
  });
});

describe('timestamped duty events', () => {
  it('validates duration, explicit clock effects, interruption qualification, and zone', () => {
    expect(validateDutyEvent(dutyEvent()).duration.value).toBe(30);
    expectIssue(
      () => validateDutyEvent(dutyEvent({ duration: { value: 29, unit: 'minute' } })),
      'EVENT_DURATION_MISMATCH',
    );
    expectIssue(
      () => validateDutyEvent(dutyEvent({
        dutyStatus: 'DRIVING',
        clockEffects: {
          driving: 'CONSUMES',
          shift: 'ADVANCES_WINDOW',
          cycle: 'CONSUMES',
        },
        qualifiesForThirtyMinuteInterruption: true,
      })),
      'CONTRADICTORY_STATE',
    );
    expectIssue(
      () => validateDutyEvent(dutyEvent({
        location: { description: 'Somewhere', timeZone: 'Not/AZone' },
      })),
      'INVALID_TIME_ZONE',
    );
  });

  it('rejects unordered, overlapping, and gapped histories without silently sorting', () => {
    const first = dutyEvent();
    const contiguous = dutyEvent({
      id: 'event-2',
      startAt: '2026-07-20T12:30:00.000Z',
      endAt: '2026-07-20T13:00:00.000Z',
    });
    expect(validateDutyEventHistory([first, contiguous])).toHaveLength(2);

    const overlap = dutyEvent({
      id: 'event-overlap',
      startAt: '2026-07-20T12:20:00.000Z',
      endAt: '2026-07-20T12:50:00.000Z',
    });
    expectIssue(() => validateDutyEventHistory([first, overlap]), 'EVENT_OVERLAP');

    const gap = dutyEvent({
      id: 'event-gap',
      startAt: '2026-07-20T12:31:00.000Z',
      endAt: '2026-07-20T13:01:00.000Z',
    });
    expectIssue(() => validateDutyEventHistory([first, gap]), 'EVENT_GAP');
    expectIssue(() => validateDutyEventHistory([contiguous, first]), 'EVENT_ORDER');
    expect(validateDutyEventHistory([first, gap], { allowGaps: true })).toHaveLength(2);
  });

  it('records sleeper participation as candidate evidence without validating a pair', () => {
    const sleeper = dutyEvent({
      id: 'sleeper-1',
      startAt: '2026-07-20T12:00:00.000Z',
      endAt: '2026-07-20T19:00:00.000Z',
      duration: { value: 420, unit: 'minute' },
      dutyStatus: 'SLEEPER_BERTH',
      eventType: 'REST',
      clockEffects: {
        driving: 'DOES_NOT_CONSUME',
        shift: 'RULE_DEPENDENT',
        cycle: 'DOES_NOT_CONSUME',
      },
      sleeperPair: {
        participates: true,
        pairId: 'pair-7-3',
        candidateRole: 'LONG_PERIOD',
      },
    });
    expect(validateDutyEvent(sleeper).sleeperPair.candidateRole).toBe('LONG_PERIOD');
  });
});
