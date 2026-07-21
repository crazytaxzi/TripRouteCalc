import { describe, expect, it } from 'vitest';

import {
  assessCommercialRoute,
  createStopFromDefaults,
  distanceInMiles,
  durationInMinutes,
  etaSimulationSnapshot,
  ianaTimeZone,
  localDateTime,
  simulateEtaTrip,
  speedInMilesPerHour,
  suggestedStopDefaults,
  utcInstant,
  validateTripStopPlan,
} from '../src/index.js';
import type {
  CommercialRoutePayload,
  EtaExternalAdjustment,
  EtaSegmentCondition,
  EtaSimulationInput,
  EtaSpeedModel,
  NormalizedCommercialRouteResult,
  ResolvedStopLocation,
  TripStopPlan,
} from '../src/index.js';

import { departureState } from './hos-test-fixtures.js';

const noDelay: EtaExternalAdjustment = Object.freeze({
  status: 'AVAILABLE',
  duration: Object.freeze({
    minimum: durationInMinutes(0),
    expected: durationInMinutes(0),
    maximum: durationInMinutes(0),
  }),
  sourceName: 'Stage 15 fixture',
  reference: 'fixture://stage-15/no-delay',
  confidence: 'HIGH',
  explanation: 'No additional fixture delay.',
});

const speedModel: EtaSpeedModel = Object.freeze({
  governedMaximumSpeed: speedInMilesPerHour(65),
  preferredPlanningSpeed: speedInMilesPerHour(58),
  maximumAverageTripSpeed: speedInMilesPerHour(55),
  carrierMaximumSpeed: speedInMilesPerHour(62),
  fallbackAverageSpeed: speedInMilesPerHour(50),
  roadClassSpeeds: Object.freeze([
    Object.freeze({
      roadClass: 'INTERSTATE' as const,
      speed: speedInMilesPerHour(60),
    }),
    Object.freeze({
      roadClass: 'URBAN' as const,
      speed: speedInMilesPerHour(45),
    }),
  ]),
  projectionFactors: Object.freeze({
    earliestLegalBasisPoints: 10_000,
    expectedBasisPoints: 9_000,
    conservativeBasisPoints: 8_000,
  }),
  explanation:
    'The fixture models a 65 mph governed truck with a 55 mph maximum average and conservative planning factors.',
});

function location(description: string, timeZone: string): ResolvedStopLocation {
  return Object.freeze({
    description,
    timeZone: ianaTimeZone(timeZone),
    resolutionStatus: 'user-confirmed' as const,
  });
}

function stop(
  id: string,
  sequence: number,
  timeZone: string,
  type: TripStopPlan['type'],
  overrides: Readonly<Partial<TripStopPlan>> = {},
): TripStopPlan {
  const created = createStopFromDefaults(
    {
      id,
      sequence,
      type,
      required: true,
      location: location(id, timeZone),
      earlyParkingAllowed: true,
      overnightParkingAllowed: true,
    },
    suggestedStopDefaults(),
  );
  return validateTripStopPlan({
    ...created,
    checkInDuration: durationInMinutes(0),
    serviceDuration: { mode: 'exact', duration: durationInMinutes(0) },
    waitingDutyStatus: 'OFF_DUTY',
    checkInDutyStatus: 'ON_DUTY_NOT_DRIVING',
    serviceDutyStatus: 'ON_DUTY_NOT_DRIVING',
    ...overrides,
  });
}

interface SegmentFixture {
  readonly segmentId: string;
  readonly miles: number;
  readonly minutes: number;
  readonly startTimeZone: string;
  readonly endTimeZone: string;
  readonly verificationStatus?: 'verified' | 'unverified' | undefined;
  readonly unavailableTravelTime?: boolean | undefined;
  readonly legalSpeed?: number | undefined;
  readonly gradeSpeed?: number | undefined;
  readonly urbanSpeed?: number | undefined;
  readonly traffic?: EtaExternalAdjustment | undefined;
  readonly weather?: EtaExternalAdjustment | undefined;
}

function route(
  stops: readonly TripStopPlan[],
  segmentFixtures: readonly SegmentFixture[],
): NormalizedCommercialRouteResult {
  if (segmentFixtures.length !== stops.length - 1) {
    throw new Error('Fixture requires one segment per stop transition.');
  }
  const geometry = {
    format: 'geojson-line-string' as const,
    coordinates: [[-117, 46], [-116, 46]] as [number, number][],
  };
  const payload: CommercialRoutePayload = {
    routeId: `route-${stops.map((item) => item.id).join('-')}`,
    routeKind: 'commercial-vehicle',
    provider: {
      providerName: 'stage-15-fixture-provider',
      providerVersion: 'fixture-v1',
      providerRequestId: `request-${segmentFixtures.map((item) => item.segmentId).join('-')}`,
      requestedAt: utcInstant('2026-07-20T14:59:00.000Z'),
      respondedAt: utcInstant('2026-07-20T14:59:01.000Z'),
      confidence: 'high',
    },
    totalDistance: distanceInMiles(
      segmentFixtures.reduce((sum, segment) => sum + segment.miles, 0),
    ),
    travelDuration: durationInMinutes(
      segmentFixtures.reduce((sum, segment) => sum + segment.minutes, 0),
    ),
    geometry,
    legs: segmentFixtures.map((segment, index) => ({
      legId: `leg-${String(index + 1)}`,
      sequence: index + 1,
      originReferenceId: stops[index]?.id ?? 'missing-origin',
      destinationStopId: stops[index + 1]?.id ?? 'missing-destination',
      distance: distanceInMiles(segment.miles),
      travelDuration: durationInMinutes(segment.minutes),
      geometry,
      segments: [
        {
          segmentId: segment.segmentId,
          sequence: 1,
          distance: distanceInMiles(segment.miles),
          ...(segment.unavailableTravelTime
            ? {}
            : { travelDuration: durationInMinutes(segment.minutes) }),
          geometry,
          expectedSpeed: speedInMilesPerHour(
            Math.max(1, Math.round(segment.miles / (segment.minutes / 60))),
          ),
          jurisdictionCodes: ['US-ID'],
          verificationStatus: segment.verificationStatus ?? 'verified',
          restrictions: [],
          unavailableFields: segment.unavailableTravelTime
            ? [
                {
                  path: 'legs[].segments[].travelDuration',
                  reason: 'Provider travel time was unavailable in this fixture.',
                },
              ]
            : [],
        },
      ],
      unavailableFields: [],
    })),
    restrictions: [],
    unavailableFields: [],
  };
  return assessCommercialRoute(payload);
}

function conditions(
  segmentFixtures: readonly SegmentFixture[],
): readonly EtaSegmentCondition[] {
  return Object.freeze(
    segmentFixtures.map((segment) =>
      Object.freeze({
        segmentId: segment.segmentId,
        roadClass: 'INTERSTATE' as const,
        startTimeZone: ianaTimeZone(segment.startTimeZone),
        endTimeZone: ianaTimeZone(segment.endTimeZone),
        legalOrProviderSpeedLimit: speedInMilesPerHour(
          segment.legalSpeed ?? 65,
        ),
        ...(segment.gradeSpeed === undefined
          ? {}
          : { gradeSpeedCap: speedInMilesPerHour(segment.gradeSpeed) }),
        ...(segment.urbanSpeed === undefined
          ? {}
          : { urbanSpeedCap: speedInMilesPerHour(segment.urbanSpeed) }),
        traffic: segment.traffic ?? noDelay,
        weather: segment.weather ?? noDelay,
        explanation: 'Verified Stage 15 fixture segment conditions.',
      }),
    ),
  );
}

function input(
  stops: readonly TripStopPlan[],
  segmentFixtures: readonly SegmentFixture[],
  overrides: Readonly<Partial<EtaSimulationInput>> = {},
): EtaSimulationInput {
  return {
    route: route(stops, segmentFixtures),
    stops,
    initialHosContext: Object.freeze({
      departureState: departureState({
        departureAt: '2026-07-20T15:00:00.000Z',
        departureTimeZone: stops[0]?.location.timeZone ?? 'UTC',
      }),
      dutyEvents: Object.freeze([]),
    }),
    speedModel,
    segmentConditions: conditions(segmentFixtures),
    operationalEvents: Object.freeze([]),
    availableOperationalLocations: Object.freeze([]),
    complianceActions: Object.freeze([]),
    hosAvailabilityActions: Object.freeze([]),
    ...overrides,
  };
}

function drivingEvents(result: ReturnType<typeof simulateEtaTrip>['earliestLegal']): ReturnType<typeof simulateEtaTrip>['earliestLegal']['timeline'] {
  return result.timeline.filter((event) => event.type === 'DRIVING');
}

describe('Stage 15 constrained speed model', () => {
  it('selects the lowest applicable legal, carrier, road, provider, grade, and urban speed cap', () => {
    const tripStops = [
      stop('origin', 1, 'America/Denver', 'start-location'),
      stop('destination', 2, 'America/Denver', 'final-consignee'),
    ];
    const segmentFixtures = [
      {
        segmentId: 'speed-segment',
        miles: 100,
        minutes: 100,
        startTimeZone: 'America/Denver',
        endTimeZone: 'America/Denver',
        legalSpeed: 64,
        gradeSpeed: 48,
        urbanSpeed: 42,
      },
    ];
    const result = simulateEtaTrip(input(tripStops, segmentFixtures));
    const decision = result.earliestLegal.speedDecisions[0];

    expect(decision?.selectedSpeed.value).toBe(42);
    expect(decision?.limitingFactors.join(' ')).toContain('urban cap');
    expect(decision?.source).toBe('VERIFIED_PROVIDER_TIME');
  });

  it('uses verified provider travel time and applies slower projection factors without exceeding caps', () => {
    const tripStops = [
      stop('origin', 1, 'America/Denver', 'start-location'),
      stop('destination', 2, 'America/Denver', 'final-consignee'),
    ];
    const segmentFixtures = [
      {
        segmentId: 'provider-time-segment',
        miles: 100,
        minutes: 120,
        startTimeZone: 'America/Denver',
        endTimeZone: 'America/Denver',
      },
    ];
    const result = simulateEtaTrip(input(tripStops, segmentFixtures));

    expect(result.earliestLegal.speedDecisions[0]?.source).toBe(
      'VERIFIED_PROVIDER_TIME',
    );
    expect(result.earliestLegal.speedDecisions[0]?.travelDuration.value).toBe(120);
    expect(result.expected.speedDecisions[0]?.travelDuration.value).toBeGreaterThan(
      120,
    );
    expect(
      result.conservative.speedDecisions[0]?.travelDuration.value,
    ).toBeGreaterThan(result.expected.speedDecisions[0]?.travelDuration.value ?? 0);
  });

  it('uses a labeled fallback and lowers confidence when provider travel time is unavailable', () => {
    const tripStops = [
      stop('origin', 1, 'America/Los_Angeles', 'start-location'),
      stop('destination', 2, 'America/Denver', 'final-consignee'),
    ];
    const segmentFixtures = [
      {
        segmentId: 'fallback-segment',
        miles: 100,
        minutes: 120,
        startTimeZone: 'America/Los_Angeles',
        endTimeZone: 'America/Denver',
        unavailableTravelTime: true,
      },
    ];
    const result = simulateEtaTrip(input(tripStops, segmentFixtures));

    expect(result.expected.speedDecisions[0]?.source).toBe('FALLBACK_AVERAGE');
    expect(result.expected.confidence).toBe('LOW');
    expect(result.expected.confidenceReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'AVERAGE_SPEED_FALLBACK',
          userExplanation: expect.stringContaining('average-speed fallback'),
        }),
      ]),
    );
  });
});

describe('Stage 15 UTC chronology and local time rendering', () => {
  it('renders a Pacific-to-Mountain crossing without changing UTC elapsed time', () => {
    const tripStops = [
      stop('origin', 1, 'America/Los_Angeles', 'start-location'),
      stop('destination', 2, 'America/Denver', 'final-consignee'),
    ];
    const segmentFixtures = [
      {
        segmentId: 'pacific-mountain',
        miles: 100,
        minutes: 120,
        startTimeZone: 'America/Los_Angeles',
        endTimeZone: 'America/Denver',
      },
    ];
    const result = simulateEtaTrip(input(tripStops, segmentFixtures));
    const driving = drivingEvents(result.earliestLegal)[0];

    expect(driving?.startLocal.localDateTime).toBe('2026-07-20T08:00');
    expect(driving?.endLocal.localDateTime).toBe('2026-07-20T11:00');
    expect(driving?.duration.value).toBe(120);
  });

  it('renders a Mountain-to-Central crossing', () => {
    const tripStops = [
      stop('origin', 1, 'America/Denver', 'start-location'),
      stop('destination', 2, 'America/Chicago', 'final-consignee'),
    ];
    const segmentFixtures = [
      {
        segmentId: 'mountain-central',
        miles: 100,
        minutes: 120,
        startTimeZone: 'America/Denver',
        endTimeZone: 'America/Chicago',
      },
    ];
    const result = simulateEtaTrip(
      input(tripStops, segmentFixtures, {
        initialHosContext: Object.freeze({
          departureState: departureState({
            departureAt: '2026-07-20T15:00:00.000Z',
            departureTimeZone: 'America/Denver',
          }),
          dutyEvents: Object.freeze([]),
        }),
      }),
    );
    const driving = drivingEvents(result.earliestLegal)[0];

    expect(driving?.startLocal.localDateTime).toBe('2026-07-20T09:00');
    expect(driving?.endLocal.localDateTime).toBe('2026-07-20T12:00');
  });

  it('renders spring-forward without counting the skipped clock hour as extra elapsed time', () => {
    const tripStops = [
      stop('origin', 1, 'America/Denver', 'start-location'),
      stop('destination', 2, 'America/Denver', 'final-consignee'),
    ];
    const segmentFixtures = [
      {
        segmentId: 'spring-forward',
        miles: 50,
        minutes: 60,
        startTimeZone: 'America/Denver',
        endTimeZone: 'America/Denver',
      },
    ];
    const result = simulateEtaTrip(
      input(tripStops, segmentFixtures, {
        initialHosContext: Object.freeze({
          departureState: departureState({
            departureAt: '2026-03-08T08:30:00.000Z',
            departureTimeZone: 'America/Denver',
          }),
          dutyEvents: Object.freeze([]),
        }),
      }),
    );
    const driving = drivingEvents(result.earliestLegal)[0];

    expect(driving?.startLocal.localDateTime).toBe('2026-03-08T01:30');
    expect(driving?.endLocal.localDateTime).toBe('2026-03-08T03:30');
    expect(driving?.duration.value).toBe(60);
  });

  it('renders fall-back with repeated local time while preserving UTC elapsed time', () => {
    const tripStops = [
      stop('origin', 1, 'America/Denver', 'start-location'),
      stop('destination', 2, 'America/Denver', 'final-consignee'),
    ];
    const segmentFixtures = [
      {
        segmentId: 'fall-back',
        miles: 50,
        minutes: 60,
        startTimeZone: 'America/Denver',
        endTimeZone: 'America/Denver',
      },
    ];
    const result = simulateEtaTrip(
      input(tripStops, segmentFixtures, {
        initialHosContext: Object.freeze({
          departureState: departureState({
            departureAt: '2026-11-01T07:30:00.000Z',
            departureTimeZone: 'America/Denver',
          }),
          dutyEvents: Object.freeze([]),
        }),
      }),
    );
    const driving = drivingEvents(result.earliestLegal)[0];

    expect(driving?.startLocal.localDateTime).toBe('2026-11-01T01:30');
    expect(driving?.endLocal.localDateTime).toBe('2026-11-01T01:30');
    expect(driving?.duration.value).toBe(60);
  });
});

describe('Stage 15 stop, appointment, and rest composition', () => {
  it('waits for an early appointment and does not invent a late exception', () => {
    const destination = stop(
      'appointment-stop',
      2,
      'America/Denver',
      'final-consignee',
      {
        appointment: {
          mode: 'fixed',
          at: {
            localDateTime: localDateTime('2026-07-20T12:00'),
            timeZone: ianaTimeZone('America/Denver'),
          },
          lateTolerance: durationInMinutes(0),
        },
      },
    );
    const tripStops = [
      stop('origin', 1, 'America/Denver', 'start-location'),
      destination,
    ];
    const result = simulateEtaTrip(
      input(tripStops, [
        {
          segmentId: 'appointment-segment',
          miles: 50,
          minutes: 60,
          startTimeZone: 'America/Denver',
          endTimeZone: 'America/Denver',
        },
      ]),
    );

    expect(result.earliestLegal.stopResults[1]?.waitingTime.value).toBe(120);
    expect(result.earliestLegal.stopResults[1]?.appointmentOutcome).toBe('early');
  });

  it('preserves a ten-hour rest at a stop and crosses zones afterward', () => {
    const tripStops = [
      stop('origin', 1, 'America/Los_Angeles', 'start-location'),
      stop('rest-stop', 2, 'America/Denver', 'sleeper-rest'),
      stop('destination', 3, 'America/Chicago', 'final-consignee'),
    ];
    const result = simulateEtaTrip(
      input(
        tripStops,
        [
          {
            segmentId: 'to-rest',
            miles: 50,
            minutes: 60,
            startTimeZone: 'America/Los_Angeles',
            endTimeZone: 'America/Denver',
          },
          {
            segmentId: 'after-rest',
            miles: 50,
            minutes: 60,
            startTimeZone: 'America/Denver',
            endTimeZone: 'America/Chicago',
          },
        ],
        {
          initialHosContext: Object.freeze({
            departureState: departureState({
              departureAt: '2026-07-20T15:00:00.000Z',
              departureTimeZone: 'America/Los_Angeles',
              drivingTimeRemaining: durationInMinutes(60),
              shiftTimeRemaining: durationInMinutes(60),
            }),
            dutyEvents: Object.freeze([]),
          }),
        },
      ),
    );
    const rest = result.earliestLegal.timeline.find(
      (event) => event.type === 'STOP_HOS_HOLD' && event.duration.value === 600,
    );

    expect(rest?.startLocal.timeZone).toBe('America/Denver');
    expect(result.earliestLegal.status).toBe('COMPLETE');
  });
});

describe('Stage 15 legal blocking and deterministic snapshots', () => {
  it('blocks an unverified route segment and preserves the reason', () => {
    const tripStops = [
      stop('origin', 1, 'America/Denver', 'start-location'),
      stop('destination', 2, 'America/Denver', 'final-consignee'),
    ];
    const segmentFixtures = [
      {
        segmentId: 'unverified-segment',
        miles: 50,
        minutes: 60,
        startTimeZone: 'America/Denver',
        endTimeZone: 'America/Denver',
        verificationStatus: 'unverified' as const,
      },
    ];
    const result = simulateEtaTrip(input(tripStops, segmentFixtures));

    expect(result.earliestLegal.status).toBe('BLOCKED');
    expect(result.earliestLegal.blockingReasons.join(' ')).toContain(
      'unverified',
    );
  });

  it('reproduces all projections and the timeline from identical inputs', () => {
    const tripStops = [
      stop('origin', 1, 'America/Denver', 'start-location'),
      stop('destination', 2, 'America/Denver', 'final-consignee'),
    ];
    const simulationInput = input(tripStops, [
      {
        segmentId: 'deterministic-segment',
        miles: 50,
        minutes: 60,
        startTimeZone: 'America/Denver',
        endTimeZone: 'America/Denver',
      },
    ]);

    expect(etaSimulationSnapshot(simulateEtaTrip(simulationInput))).toEqual(
      etaSimulationSnapshot(simulateEtaTrip(simulationInput)),
    );
  });
});
