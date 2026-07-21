import { describe, expect, it } from 'vitest';

import {
  assessCommercialRoute,
  calculateEtaSegmentSpeed,
  createStopFromDefaults,
  distanceInMiles,
  durationInMinutes,
  etaSimulationSnapshot,
  ianaTimeZone,
  simulateEtaTrip,
  speedInMilesPerHour,
  suggestedStopDefaults,
  utcInstant,
  validateOperationalEventPlan,
  validateTripStopPlan,
} from '../src/index.js';
import type {
  CommercialRoutePayload,
  EtaComplianceAction,
  EtaExternalAdjustment,
  EtaHosAvailabilityAction,
  EtaSegmentCondition,
  EtaSimulationInput,
  EtaSpeedModel,
  NormalizedCommercialRouteResult,
  OperationalEventPlan,
  OperationalLocation,
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
  sourceName: 'Stage 15 deterministic fixture',
  reference: 'fixture://stage-15/no-delay',
  confidence: 'HIGH',
  explanation: 'No additional test delay.',
});

const speedModel: EtaSpeedModel = Object.freeze({
  governedMaximumSpeed: speedInMilesPerHour(65),
  preferredPlanningSpeed: speedInMilesPerHour(58),
  maximumAverageTripSpeed: speedInMilesPerHour(55),
  carrierMaximumSpeed: speedInMilesPerHour(62),
  fallbackAverageSpeed: speedInMilesPerHour(50),
  roadClassSpeeds: Object.freeze([
    Object.freeze({ roadClass: 'INTERSTATE' as const, speed: speedInMilesPerHour(60) }),
    Object.freeze({ roadClass: 'URBAN' as const, speed: speedInMilesPerHour(35) }),
  ]),
  projectionFactors: Object.freeze({
    earliestLegalBasisPoints: 10_000,
    expectedBasisPoints: 9_000,
    conservativeBasisPoints: 8_000,
  }),
  explanation: 'Test-only constrained commercial speed model.',
});

function stopLocation(
  description: string,
  timeZone: string,
): ResolvedStopLocation {
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
): TripStopPlan {
  const created = createStopFromDefaults(
    {
      id,
      sequence,
      type,
      required: true,
      location: stopLocation(id, timeZone),
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
  });
}

interface SegmentFixture {
  readonly segmentId: string;
  readonly miles: number;
  readonly minutes: number;
  readonly startTimeZone: string;
  readonly endTimeZone: string;
  readonly verificationStatus?: 'verified' | 'unverified' | 'prohibited';
  readonly unavailableTravelTime?: boolean;
}

function route(
  stops: readonly TripStopPlan[],
  segments: readonly SegmentFixture[],
): NormalizedCommercialRouteResult {
  if (segments.length !== stops.length - 1) {
    throw new Error('Stage 15 route fixture requires one segment per route leg.');
  }
  const geometry = {
    format: 'geojson-line-string' as const,
    coordinates: [[-117, 46], [-116, 46]] as [number, number][],
  };
  const totalMiles = segments.reduce((sum, segment) => sum + segment.miles, 0);
  const totalMinutes = segments.reduce((sum, segment) => sum + segment.minutes, 0);
  const payload: CommercialRoutePayload = {
    routeId: 'stage-15-route',
    routeKind: 'commercial-vehicle',
    provider: {
      providerName: 'test-only-commercial-provider',
      providerVersion: 'fixture-15',
      providerRequestId: 'provider-stage-15',
      requestedAt: utcInstant('2026-07-20T14:59:00.000Z'),
      respondedAt: utcInstant('2026-07-20T14:59:01.000Z'),
      confidence: 'high',
    },
    totalDistance: distanceInMiles(totalMiles),
    travelDuration: durationInMinutes(totalMinutes),
    geometry,
    legs: segments.map((segment, index) => ({
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
          travelDuration: durationInMinutes(segment.minutes),
          geometry,
          expectedSpeed: speedInMilesPerHour(
            Math.max(1, Math.round(segment.miles / (segment.minutes / 60))),
          ),
          jurisdictionCodes: ['US-WA'],
          verificationStatus: segment.verificationStatus ?? 'verified',
          restrictions: [],
          unavailableFields: segment.unavailableTravelTime
            ? [
                {
                  path: 'travelDuration',
                  reason: 'Provider travel time omitted by test fixture.',
                  impact: 'lowers-confidence' as const,
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
  segments: readonly SegmentFixture[],
): readonly EtaSegmentCondition[] {
  return Object.freeze(
    segments.map((segment) =>
      Object.freeze({
        segmentId: segment.segmentId,
        roadClass: 'INTERSTATE' as const,
        startTimeZone: ianaTimeZone(segment.startTimeZone),
        endTimeZone: ianaTimeZone(segment.endTimeZone),
        legalOrProviderSpeedLimit: speedInMilesPerHour(65),
        traffic: noDelay,
        weather: noDelay,
        explanation: 'Test-only verified segment conditions.',
      }),
    ),
  );
}

function input(
  stops: readonly TripStopPlan[],
  segments: readonly SegmentFixture[],
  overrides: Readonly<Partial<EtaSimulationInput>> = {},
): EtaSimulationInput {
  const state = departureState({
    departureAt: '2026-07-20T15:00:00.000Z',
    departureTimeZone: stops[0]?.location.timeZone ?? 'UTC',
  });
  return {
    route: route(stops, segments),
    stops,
    initialHosContext: Object.freeze({ departureState: state, dutyEvents: Object.freeze([]) }),
    speedModel,
    segmentConditions: conditions(segments),
    operationalEvents: Object.freeze([]),
    availableOperationalLocations: Object.freeze([]),
    complianceActions: Object.freeze([]),
    hosAvailabilityActions: Object.freeze([]),
    ...overrides,
  };
}

function drivingEvents(result: ReturnType<typeof simulateEtaTrip>['earliestLegal']) {
  return result.timeline.filter((event) => event.type === 'DRIVING');
}

function verifiedOperationalLocation(
  locationId: string,
  routeMiles: number,
): OperationalLocation {
  return Object.freeze({
    locationId,
    description: locationId,
    timeZone: ianaTimeZone('America/Denver'),
    routeDistance: distanceInMiles(routeMiles),
    truckCompatible: true,
    capabilities: Object.freeze(['FUEL'] as const),
    source: Object.freeze({
      type: 'VERIFIED_LOCATION_PROVIDER' as const,
      sourceName: 'Stage 15 test location provider',
      reference: `fixture://stage-15/${locationId}`,
      verifiedAt: utcInstant('2026-07-20T14:00:00.000Z'),
      explanation: 'Test-only verified route location.',
    }),
  });
}

describe('Stage 15 constrained speed projections', () => {
  it('keeps selected speed under every configured cap and orders projections', () => {
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
    const tripRoute = route(tripStops, segmentFixtures);
    const segment = tripRoute.legs[0]?.segments[0];
    const condition = conditions(segmentFixtures)[0];
    if (segment === undefined || condition === undefined) throw new Error('Fixture missing.');

    const earliest = calculateEtaSegmentSpeed(segment, condition, speedModel, 'EARLIEST_LEGAL');
    const expected = calculateEtaSegmentSpeed(segment, condition, speedModel, 'EXPECTED');
    const conservative = calculateEtaSegmentSpeed(segment, condition, speedModel, 'CONSERVATIVE');

    expect(earliest.selectedSpeed.value).toBeLessThanOrEqual(
      speedModel.maximumAverageTripSpeed.value,
    );
    expect(earliest.travelDuration.value).toBeLessThan(expected.travelDuration.value);
    expect(expected.travelDuration.value).toBeLessThan(conservative.travelDuration.value);
  });

  it('labels fallback speed and lowers confidence when provider time is unavailable', () => {
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
    expect(result.expected.confidenceReasons.join(' ')).toContain('fallback average');
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

    expect(result.earliestLegal.status).toBe('COMPLETE');
    expect(driving?.duration.value).toBe(120);
    expect(driving?.startLocal.localDateTime).toBe('2026-07-20T08:00');
    expect(driving?.endLocal.localDateTime).toBe('2026-07-20T11:00');
  });

  it('renders multiple time-zone crossings in route order', () => {
    const tripStops = [
      stop('pacific', 1, 'America/Los_Angeles', 'start-location'),
      stop('mountain', 2, 'America/Denver', 'intermediate-delivery'),
      stop('central', 3, 'America/Chicago', 'final-consignee'),
    ];
    const segmentFixtures = [
      {
        segmentId: 'pacific-mountain',
        miles: 50,
        minutes: 60,
        startTimeZone: 'America/Los_Angeles',
        endTimeZone: 'America/Denver',
      },
      {
        segmentId: 'mountain-central',
        miles: 50,
        minutes: 60,
        startTimeZone: 'America/Denver',
        endTimeZone: 'America/Chicago',
      },
    ];
    const result = simulateEtaTrip(input(tripStops, segmentFixtures));
    const driving = drivingEvents(result.earliestLegal);

    expect(driving.map((event) => event.endLocal.timeZone)).toEqual([
      'America/Denver',
      'America/Chicago',
    ]);
    expect(result.earliestLegal.finalStopId).toBe('central');
  });

  it('handles spring-forward wall time while preserving real elapsed minutes', () => {
    const tripStops = [
      stop('before-gap', 1, 'America/Los_Angeles', 'start-location'),
      stop('after-gap', 2, 'America/Los_Angeles', 'final-consignee'),
    ];
    const segmentFixtures = [
      {
        segmentId: 'spring-forward',
        miles: 100,
        minutes: 120,
        startTimeZone: 'America/Los_Angeles',
        endTimeZone: 'America/Los_Angeles',
      },
    ];
    const result = simulateEtaTrip(
      input(tripStops, segmentFixtures, {
        initialHosContext: Object.freeze({
          departureState: departureState({
            departureAt: '2026-03-08T09:30:00.000Z',
            departureTimeZone: 'America/Los_Angeles',
          }),
          dutyEvents: Object.freeze([]),
        }),
      }),
    );
    const driving = drivingEvents(result.earliestLegal)[0];

    expect(driving?.duration.value).toBe(120);
    expect(driving?.startLocal.localDateTime).toBe('2026-03-08T01:30');
    expect(driving?.endLocal.localDateTime).toBe('2026-03-08T04:30');
  });

  it('handles fall-back repeated wall time without adding phantom elapsed time', () => {
    const tripStops = [
      stop('before-repeat', 1, 'America/Los_Angeles', 'start-location'),
      stop('after-repeat', 2, 'America/Los_Angeles', 'final-consignee'),
    ];
    const segmentFixtures = [
      {
        segmentId: 'fall-back',
        miles: 100,
        minutes: 120,
        startTimeZone: 'America/Los_Angeles',
        endTimeZone: 'America/Los_Angeles',
      },
    ];
    const result = simulateEtaTrip(
      input(tripStops, segmentFixtures, {
        initialHosContext: Object.freeze({
          departureState: departureState({
            departureAt: '2026-11-01T08:30:00.000Z',
            departureTimeZone: 'America/Los_Angeles',
          }),
          dutyEvents: Object.freeze([]),
        }),
      }),
    );
    const driving = drivingEvents(result.earliestLegal)[0];

    expect(driving?.duration.value).toBe(120);
    expect(driving?.startLocal.localDateTime).toBe('2026-11-01T01:30');
    expect(driving?.endLocal.localDateTime).toBe('2026-11-01T02:30');
  });
});

describe('Stage 15 HOS and action composition', () => {
  it('inserts the standard 30-minute interruption at the legal boundary', () => {
    const tripStops = [
      stop('origin', 1, 'America/Los_Angeles', 'start-location'),
      stop('destination', 2, 'America/Los_Angeles', 'final-consignee'),
    ];
    const segmentFixtures = [
      {
        segmentId: 'interruption',
        miles: 50,
        minutes: 60,
        startTimeZone: 'America/Los_Angeles',
        endTimeZone: 'America/Los_Angeles',
      },
    ];
    const result = simulateEtaTrip(
      input(tripStops, segmentFixtures, {
        initialHosContext: Object.freeze({
          departureState: departureState({
            departureAt: '2026-07-20T15:00:00.000Z',
            departureTimeZone: 'America/Los_Angeles',
            drivenSinceLastQualifyingInterruption: durationInMinutes(450),
          }),
          dutyEvents: Object.freeze([]),
        }),
      }),
    );

    expect(result.earliestLegal.status).toBe('COMPLETE');
    expect(
      result.earliestLegal.timeline.some(
        (event) => event.type === 'HOS_ACTION' && event.duration.value === 30,
      ),
    ).toBe(true);
  });

  it('inserts a 10-hour rest after crossing into the next time zone', () => {
    const tripStops = [
      stop('pacific', 1, 'America/Los_Angeles', 'start-location'),
      stop('mountain', 2, 'America/Denver', 'intermediate-delivery'),
      stop('mountain-final', 3, 'America/Denver', 'final-consignee'),
    ];
    const segmentFixtures = [
      {
        segmentId: 'cross-zone',
        miles: 50,
        minutes: 60,
        startTimeZone: 'America/Los_Angeles',
        endTimeZone: 'America/Denver',
      },
      {
        segmentId: 'after-crossing',
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
            departureAt: '2026-07-20T15:00:00.000Z',
            departureTimeZone: 'America/Los_Angeles',
            drivingTimeRemaining: durationInMinutes(60),
            shiftTimeRemaining: durationInMinutes(60),
          }),
          dutyEvents: Object.freeze([]),
        }),
      }),
    );
    const rest = result.earliestLegal.timeline.find(
      (event) => event.type === 'HOS_ACTION' && event.duration.value === 600,
    );

    expect(result.earliestLegal.status).toBe('COMPLETE');
    expect(rest?.startLocal.timeZone).toBe('America/Denver');
  });

  it('blocks zero cycle without explicit availability evidence and resumes with a recap action', () => {
    const tripStops = [
      stop('origin', 1, 'America/Los_Angeles', 'start-location'),
      stop('destination', 2, 'America/Los_Angeles', 'final-consignee'),
    ];
    const segmentFixtures = [
      {
        segmentId: 'cycle-block',
        miles: 10,
        minutes: 15,
        startTimeZone: 'America/Los_Angeles',
        endTimeZone: 'America/Los_Angeles',
      },
    ];
    const blockedInput = input(tripStops, segmentFixtures, {
      initialHosContext: Object.freeze({
        departureState: departureState({
          departureAt: '2026-07-20T15:00:00.000Z',
          departureTimeZone: 'America/Los_Angeles',
          cycleTimeRemaining: durationInMinutes(0),
        }),
        dutyEvents: Object.freeze([]),
      }),
    });
    const blocked = simulateEtaTrip(blockedInput);

    const recap: EtaHosAvailabilityAction = Object.freeze({
      actionId: 'recap-available',
      trigger: 'WAIT_FOR_CYCLE_AVAILABILITY',
      kind: 'RECAP_WAIT',
      availableAt: utcInstant('2026-07-20T16:00:00.000Z'),
      dutyStatus: 'OFF_DUTY',
      location: Object.freeze({
        description: 'Pacific terminal',
        timeZone: ianaTimeZone('America/Los_Angeles'),
      }),
      resultingDepartureState: departureState({
        departureAt: '2026-07-20T16:00:00.000Z',
        departureTimeZone: 'America/Los_Angeles',
        cycleTimeRemaining: durationInMinutes(120),
      }),
      sourceReference: 'fixture://stage-15/recap',
      explanation: 'Test-only verified recap return.',
    });
    const resumed = simulateEtaTrip({
      ...blockedInput,
      hosAvailabilityActions: Object.freeze([recap]),
    });

    expect(blocked.earliestLegal.status).toBe('BLOCKED');
    expect(blocked.earliestLegal.blockingReasons.join(' ')).toContain('cycle');
    expect(resumed.earliestLegal.status).toBe('COMPLETE');
    expect(resumed.earliestLegal.timeline.some((event) => event.type === 'HOS_ACTION')).toBe(true);
  });
});

describe('Stage 15 route, compliance, and deterministic composition', () => {
  it('places a route-distance operational event between driving chunks', () => {
    const tripStops = [
      stop('origin', 1, 'America/Los_Angeles', 'start-location'),
      stop('destination', 2, 'America/Denver', 'final-consignee'),
    ];
    const segmentFixtures = [
      {
        segmentId: 'route-distance-event',
        miles: 100,
        minutes: 120,
        startTimeZone: 'America/Los_Angeles',
        endTimeZone: 'America/Denver',
      },
    ];
    const fuelLocation = verifiedOperationalLocation('mid-route-fuel', 50);
    const fuelPlan: OperationalEventPlan = validateOperationalEventPlan({
      eventId: 'mid-route-fuel-event',
      type: 'FUEL',
      duration: { mode: 'EXACT', duration: durationInMinutes(30) },
      dutyStatus: 'ON_DUTY_NOT_DRIVING',
      source: fuelLocation.source,
      location: fuelLocation,
      placement: {
        kind: 'AT_ROUTE_DISTANCE',
        routeDistance: distanceInMiles(50),
        requiredCapability: 'FUEL',
      },
      allowThirtyMinuteInterruptionOverlap: true,
      allowRestOverlap: false,
      required: true,
      userOverride: false,
      explanation: 'Test-only route-distance fuel event.',
    });
    const result = simulateEtaTrip(
      input(tripStops, segmentFixtures, {
        operationalEvents: Object.freeze([fuelPlan]),
        availableOperationalLocations: Object.freeze([fuelLocation]),
      }),
    );
    const types = result.earliestLegal.timeline.map((event) => event.type);

    expect(result.earliestLegal.status).toBe('COMPLETE');
    expect(types.filter((type) => type === 'DRIVING')).toHaveLength(2);
    expect(types).toContain('OPERATIONAL_EVENT');
  });

  it('stops at a blocking compliance action before driving', () => {
    const tripStops = [
      stop('origin', 1, 'America/Los_Angeles', 'start-location'),
      stop('destination', 2, 'America/Denver', 'final-consignee'),
    ];
    const segmentFixtures = [
      {
        segmentId: 'blocked-segment',
        miles: 100,
        minutes: 120,
        startTimeZone: 'America/Los_Angeles',
        endTimeZone: 'America/Denver',
      },
    ];
    const block: EtaComplianceAction = Object.freeze({
      actionId: 'route-block',
      status: 'BLOCKING',
      placement: Object.freeze({
        kind: 'BEFORE_SEGMENT',
        segmentId: 'blocked-segment',
      }),
      sourceReference: 'fixture://stage-15/compliance-block',
      explanation: 'Test-only unresolved compliance finding blocks movement.',
    });
    const result = simulateEtaTrip(
      input(tripStops, segmentFixtures, {
        complianceActions: Object.freeze([block]),
      }),
    );

    expect(result.earliestLegal.status).toBe('BLOCKED');
    expect(drivingEvents(result.earliestLegal)).toHaveLength(0);
    expect(result.earliestLegal.timeline.some((event) => event.type === 'COMPLIANCE_BLOCK')).toBe(true);
  });

  it('replays the same immutable input into identical projections and timeline', () => {
    const tripStops = [
      stop('origin', 1, 'America/Los_Angeles', 'start-location'),
      stop('middle', 2, 'America/Denver', 'intermediate-delivery'),
      stop('destination', 3, 'America/Chicago', 'final-consignee'),
    ];
    const segmentFixtures = [
      {
        segmentId: 'first',
        miles: 50,
        minutes: 60,
        startTimeZone: 'America/Los_Angeles',
        endTimeZone: 'America/Denver',
      },
      {
        segmentId: 'second',
        miles: 50,
        minutes: 60,
        startTimeZone: 'America/Denver',
        endTimeZone: 'America/Chicago',
      },
    ];
    const fixture = input(tripStops, segmentFixtures);
    const first = simulateEtaTrip(fixture);
    const second = simulateEtaTrip(fixture);

    expect(second).toEqual(first);
    expect(etaSimulationSnapshot(second)).toEqual(etaSimulationSnapshot(first));
    expect(first.earliestLegal.completedAt).not.toBe(first.expected.completedAt);
    expect(first.expected.completedAt).not.toBe(first.conservative.completedAt);
  });
});
