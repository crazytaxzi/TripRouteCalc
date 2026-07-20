import { describe, expect, it } from 'vitest';

import {
  StopMutationError,
  StopValidationError,
  changeStopType,
  createStopFromDefaults,
  duplicateStop,
  durationInMinutes,
  insertStop,
  localDateTime,
  processOrderedStops,
  processStop,
  reorderStop,
  setStopPositionLocked,
  suggestedStopDefaults,
  utcInstant,
  validateDriverHosDepartureState,
  validateDutyEvent,
  validateTripStopPlan,
} from '../src/index.js';
import type {
  DriverHosDepartureState,
  DutyEvent,
  HosDutyStatus,
  ResolvedStopLocation,
  StopHosContext,
  TripStopPlan,
} from '../src/index.js';

const unverifiedUser = Object.freeze({
  origin: 'USER_ENTERED' as const,
  verification: 'UNVERIFIED' as const,
  sourceName: 'Stage 10 test fixture',
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
    onDutyTime: durationInMinutes(0),
  }));
}

function departureState(
  at = '2026-07-20T12:00:00.000Z',
  overrides: Readonly<Record<string, unknown>> = {},
): DriverHosDepartureState {
  return validateDriverHosDepartureState({
    driver: { id: 'driver-stage-10', nameOrIdentifier: 'Driver Stage 10' },
    departureAt: at,
    departureTimeZone: 'UTC',
    currentDutyStatus: 'ON_DUTY_NOT_DRIVING',
    currentDutyStatusStartedAt: at,
    drivingTimeRemaining: durationInMinutes(660),
    shiftTimeRemaining: durationInMinutes(840),
    cycleTimeRemaining: durationInMinutes(4_200),
    cycleType: 'SEVENTY_HOURS_EIGHT_DAYS',
    drivenSinceLastQualifyingInterruption: durationInMinutes(0),
    onDutyTimeCurrentShift: durationInMinutes(0),
    offDutyTimeImmediatelyBeforeDeparture: durationInMinutes(600),
    qualifyingTenHourBreakCompleted: true,
    priorDutyDays: priorDays(),
    recapReturns: [],
    sleeperBerthEligible: true,
    existingSleeperPeriods: [],
    splitSleeperEnabled: false,
    restart34HourPlanned: false,
    carrierMaxDailyDriving: durationInMinutes(660),
    carrierMaxDuty: durationInMinutes(840),
    provenance,
    ...overrides,
  });
}

const location: ResolvedStopLocation = Object.freeze({
  description: 'Stage 10 facility',
  timeZone: 'UTC' as ResolvedStopLocation['timeZone'],
  addressText: '100 Test Way',
  resolutionStatus: 'user-confirmed',
});

function stop(
  id: string,
  sequence: number,
  type: TripStopPlan['type'] = 'shipper',
  overrides: Readonly<Partial<TripStopPlan>> = {},
): TripStopPlan {
  const created = createStopFromDefaults(
    {
      id,
      sequence,
      type,
      required: true,
      location,
      earlyParkingAllowed: true,
      overnightParkingAllowed: true,
    },
    suggestedStopDefaults(),
  );
  return validateTripStopPlan({ ...created, ...overrides });
}

function dutyEvent(
  id: string,
  startAt: string,
  minutes: number,
  dutyStatus: HosDutyStatus,
): DutyEvent {
  const endAt = new Date(Date.parse(startAt) + minutes * 60_000).toISOString();
  const onDuty =
    dutyStatus === 'DRIVING' || dutyStatus === 'ON_DUTY_NOT_DRIVING';
  return validateDutyEvent({
    id,
    startAt,
    endAt,
    duration: durationInMinutes(minutes),
    dutyStatus,
    eventType: dutyStatus === 'DRIVING' ? 'STATUS_CHANGE' : 'other',
    location: { description: 'Stage 10 route leg', timeZone: 'UTC' },
    source: 'CALCULATED',
    explanation: 'Stage 10 deterministic route-leg fixture.',
    clockEffects: {
      driving: dutyStatus === 'DRIVING' ? 'CONSUMES' : 'DOES_NOT_CONSUME',
      shift:
        dutyStatus === 'SLEEPER_BERTH'
          ? 'RULE_DEPENDENT'
          : 'ADVANCES_WINDOW',
      cycle: onDuty ? 'CONSUMES' : 'DOES_NOT_CONSUME',
    },
    qualifiesForThirtyMinuteInterruption:
      dutyStatus !== 'DRIVING' && minutes >= 30,
    sleeperPair: { participates: false },
    provenance: {
      origin: 'CALCULATED',
      verification: 'UNVERIFIED',
      sourceName: 'Stage 10 test fixture',
      explanation: 'Calculated test event.',
    },
  });
}

function context(state = departureState()): StopHosContext {
  return Object.freeze({ departureState: state, dutyEvents: Object.freeze([]) });
}

describe('Stage 10 ordered stop configuration', () => {
  it('adds, duplicates, reorders, changes type, and preserves contiguous sequence', () => {
    const first = stop('start', 1, 'start-location');
    const second = stop('shipper', 2, 'shipper');
    const third = stop('delivery', 3, 'final-consignee');

    const inserted = insertStop(
      [first, second, third],
      stop('scale', 4, 'scale'),
      2,
    );
    const duplicated = duplicateStop(inserted, 'shipper', 'shipper-copy');
    const reordered = reorderStop(duplicated, 'delivery', 1);
    const changed = changeStopType(reordered, 'shipper-copy', 'intermediate-pickup');

    expect(changed.map((item) => item.sequence)).toEqual([1, 2, 3, 4, 5]);
    expect(changed.find((item) => item.id === 'delivery')?.sequence).toBe(2);
    expect(changed.find((item) => item.id === 'shipper-copy')?.type).toBe(
      'intermediate-pickup',
    );
  });

  it('rejects operations that would move or remove a locked position', () => {
    const stops = setStopPositionLocked(
      [stop('start', 1, 'start-location'), stop('shipper', 2), stop('delivery', 3, 'final-consignee')],
      'shipper',
      true,
    );

    expect(() => reorderStop(stops, 'delivery', 0)).toThrow(StopMutationError);
    expect(() => insertStop(stops, stop('fuel', 4, 'fuel'), 0)).toThrow(
      StopMutationError,
    );
  });

  it('uses overridable defaults rather than hidden immutable delays', () => {
    const configuration = suggestedStopDefaults({
      byType: {
        fuel: {
          checkInDuration: durationInMinutes(5),
          serviceDuration: {
            mode: 'exact',
            duration: durationInMinutes(22),
          },
          waitingDutyStatus: 'OFF_DUTY',
          checkInDutyStatus: 'ON_DUTY_NOT_DRIVING',
          serviceDutyStatus: 'ON_DUTY_NOT_DRIVING',
        },
      },
    });
    const fuel = createStopFromDefaults(
      {
        id: 'fuel',
        sequence: 1,
        type: 'fuel',
        required: true,
        location,
      },
      configuration,
    );

    expect(fuel.checkInDuration.value).toBe(5);
    expect(fuel.serviceDuration.mode).toBe('exact');
    if (fuel.serviceDuration.mode === 'exact') {
      expect(fuel.serviceDuration.duration.value).toBe(22);
    }
  });
});

describe('Stage 10 appointment and service processing', () => {
  it('keeps arrival, waiting, check-in, service completion, and departure separate', () => {
    const configured = stop('shipper', 1, 'shipper', {
      appointment: {
        mode: 'fixed',
        at: { localDateTime: localDateTime('2026-07-20T12:30'), timeZone: location.timeZone },
        lateTolerance: durationInMinutes(15),
      },
      checkInDuration: durationInMinutes(10),
      serviceDuration: { mode: 'exact', duration: durationInMinutes(15) },
    });
    const state = departureState('2026-07-20T12:00:00.000Z', {
      drivenSinceLastQualifyingInterruption: durationInMinutes(480),
    });

    const result = processStop({
      stop: configured,
      arrivalAt: utcInstant('2026-07-20T12:00:00.000Z'),
      hosContext: context(state),
      projection: 'expected',
    });

    expect(result.status).toBe('ready');
    expect(result.appointmentOutcome).toBe('early');
    expect(result.waitingTime.value).toBe(30);
    expect(result.serviceStartAt).toBe('2026-07-20T12:40:00.000Z');
    expect(result.serviceCompletedAt).toBe('2026-07-20T12:55:00.000Z');
    expect(result.departureAt).toBe('2026-07-20T12:55:00.000Z');
    expect(result.hosHoldTime.value).toBe(0);
    expect(result.timeline.map((event) => event.type)).toEqual([
      'ARRIVAL',
      'APPOINTMENT_WAIT',
      'CHECK_IN',
      'SERVICE',
      'DEPARTURE',
    ]);
    expect(result.departureHosClocks.drivenSinceLastQualifyingInterruption.value).toBe(0);
  });

  it('overlaps a required 10-hour rest with a sleeper-rest stop when parking is allowed', () => {
    const rest = stop('rest', 1, 'sleeper-rest', {
      checkInDuration: durationInMinutes(0),
      serviceDuration: { mode: 'exact', duration: durationInMinutes(600) },
      serviceDutyStatus: 'SLEEPER_BERTH',
      overnightParkingAllowed: true,
    });
    const state = departureState('2026-07-20T12:00:00.000Z', {
      drivingTimeRemaining: durationInMinutes(0),
      shiftTimeRemaining: durationInMinutes(0),
      qualifyingTenHourBreakCompleted: false,
      offDutyTimeImmediatelyBeforeDeparture: durationInMinutes(0),
    });

    const result = processStop({
      stop: rest,
      arrivalAt: utcInstant('2026-07-20T12:00:00.000Z'),
      hosContext: context(state),
      projection: 'expected',
    });

    expect(result.status).toBe('ready');
    expect(result.serviceCompletedAt).toBe('2026-07-20T22:00:00.000Z');
    expect(result.departureHosClocks.drivingTimeRemaining.value).toBe(660);
    expect(result.departureHosClocks.shiftTimeRemaining.value).toBe(840);
  });

  it('marks missed appointments and identifies the earliest supplied lateness checkpoint', () => {
    const late = stop('late-stop', 1, 'final-consignee', {
      appointment: {
        mode: 'latest',
        at: { localDateTime: localDateTime('2026-07-20T12:00'), timeZone: location.timeZone },
        lateTolerance: durationInMinutes(15),
      },
      checkInDuration: durationInMinutes(5),
      serviceDuration: { mode: 'exact', duration: durationInMinutes(15) },
    });
    const arrival = utcInstant('2026-07-20T12:20:00.000Z');

    const result = processStop({
      stop: late,
      arrivalAt: arrival,
      hosContext: context(departureState(arrival)),
      projection: 'expected',
      feasibilityCheckpoints: [
        {
          at: utcInstant('2026-07-20T10:00:00.000Z'),
          projectedArrivalAt: utcInstant('2026-07-20T11:55:00.000Z'),
          explanation: 'Still achievable.',
        },
        {
          at: utcInstant('2026-07-20T11:00:00.000Z'),
          projectedArrivalAt: utcInstant('2026-07-20T12:10:00.000Z'),
          explanation: 'The appointment could no longer be reached by the deadline.',
        },
      ],
    });

    expect(result.appointmentOutcome).toBe('missed');
    expect(result.latenessBecameUnavoidableAt).toBe('2026-07-20T11:00:00.000Z');
    expect(result.warnings.map((item) => item.code)).toEqual(
      expect.arrayContaining(['APPOINTMENT_MISSED', 'SERVICE_START_AFTER_APPOINTMENT']),
    );
  });

  it('rejects nonexistent local appointment times instead of shifting them silently', () => {
    expect(() =>
      validateTripStopPlan({
        ...stop('dst-gap', 1),
        location: { ...location, timeZone: 'America/Los_Angeles' },
        appointment: {
          mode: 'fixed',
          at: {
            localDateTime: localDateTime('2026-03-08T02:30'),
            timeZone: 'America/Los_Angeles',
          },
          lateTolerance: durationInMinutes(0),
        },
      }),
    ).toThrow(StopValidationError);
  });
});

describe('Stage 10 deterministic multi-stop processing', () => {
  it('processes five ordered stops and consumes each timestamped driving leg before the next arrival', () => {
    const stops = [
      stop('start', 1, 'start-location', { serviceDuration: { mode: 'exact', duration: durationInMinutes(15) } }),
      stop('shipper', 2, 'shipper', { serviceDuration: { mode: 'exact', duration: durationInMinutes(20) } }),
      stop('pickup', 3, 'intermediate-pickup', { serviceDuration: { mode: 'exact', duration: durationInMinutes(20) } }),
      stop('delivery', 4, 'intermediate-delivery', { serviceDuration: { mode: 'exact', duration: durationInMinutes(20) } }),
      stop('final', 5, 'final-consignee', { serviceDuration: { mode: 'exact', duration: durationInMinutes(20) } }),
    ];
    const legs: DutyEvent[][] = [];
    let cursor = '2026-07-20T12:15:00.000Z';
    for (let index = 0; index < 4; index += 1) {
      const event = dutyEvent(`drive-${String(index + 1)}`, cursor, 60, 'DRIVING');
      legs.push([event]);
      cursor = new Date(Date.parse(event.endAt) + 20 * 60_000).toISOString();
    }

    const result = processOrderedStops({
      stops,
      initialHosContext: context(),
      projection: 'expected',
      legs: legs.map((events, index) => ({
        fromStopId: stops[index]?.id ?? '',
        toStopId: stops[index + 1]?.id ?? '',
        dutyEvents: events,
      })),
    });

    expect(result.status).toBe('complete');
    expect(result.completedStopCount).toBe(5);
    expect(result.stopResults.map((item) => item.stop.id)).toEqual([
      'start',
      'shipper',
      'pickup',
      'delivery',
      'final',
    ]);
    expect(result.stopResults.at(-1)?.departureHosClocks.drivingTimeRemaining.value).toBe(420);
  });
});
