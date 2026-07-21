import { describe, expect, it } from 'vitest';

import {
  assessCommercialRoute,
  createStopFromDefaults,
  distanceInMiles,
  durationInMinutes,
  etaSimulationSnapshot,
  ianaTimeZone,
  insertStop,
  localDateTime,
  reorderStop,
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
  sourceName: 'Stage 15 acceptance fixture',
  reference: 'fixture://stage-15/acceptance/no-delay',
  confidence: 'HIGH',
  explanation: 'No additional acceptance-test delay.',
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
  ]),
  projectionFactors: Object.freeze({
    earliestLegalBasisPoints: 10_000,
    expectedBasisPoints: 9_000,
    conservativeBasisPoints: 8_000,
  }),
  explanation: 'Stage 15 acceptance speed model.',
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
}

function route(
  stops: readonly TripStopPlan[],
  segments: readonly SegmentFixture[],
): NormalizedCommercialRouteResult {
  if (segments.length !== stops.length - 1) {
    throw new Error('Acceptance route requires one segment per stop transition.');
  }
  const geometry = {
    format: 'geojson-line-string' as const,
    coordinates: [[-117, 46], [-116, 46]] as [number, number][],
  };
  const payload: CommercialRoutePayload = {
    routeId: `stage-15-acceptance-${stops.map((item) => item.id).join('-')}`,
    routeKind: 'commercial-vehicle',
    provider: {
      providerName: 'stage-15-acceptance-provider',
      providerVersion: 'fixture-v1',
      providerRequestId: `request-${segments.map((item) => item.segmentId).join('-')}`,
      requestedAt: utcInstant('2026-07-20T14:59:00.000Z'),
      respondedAt: utcInstant('2026-07-20T14:59:01.000Z'),
      confidence: 'high',
    },
    totalDistance: distanceInMiles(
      segments.reduce((sum, segment) => sum + segment.miles, 0),
    ),
    travelDuration: durationInMinutes(
      segments.reduce((sum, segment) => sum + segment.minutes, 0),
    ),
    geometry,
    legs: segments.map((segment, index) => ({
      legId: `acceptance-leg-${String(index + 1)}`,
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
          jurisdictionCodes: ['US-ID'],
          verificationStatus: 'verified',
          restrictions: [],
          unavailableFields: [],
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
        explanation: 'Verified acceptance-test segment conditions.',
      }),
    ),
  );
}

function input(
  stops: readonly TripStopPlan[],
  segments: readonly SegmentFixture[],
  overrides: Readonly<Partial<EtaSimulationInput>> = {},
): EtaSimulationInput {
  return {
    route: route(stops, segments),
    stops,
    initialHosContext: Object.freeze({
      departureState: departureState({
        departureAt: '2026-07-20T15:00:00.000Z',
        departureTimeZone: stops[0]?.location.timeZone ?? 'UTC',
      }),
      dutyEvents: Object.freeze([]),
    }),
    speedModel,
    segmentConditions: conditions(segments),
    operationalEvents: Object.freeze([]),
    availableOperationalLocations: Object.freeze([]),
    complianceActions: Object.freeze([]),
    hosAvailabilityActions: Object.freeze([]),
    ...overrides,
  };
}

function segment(
  segmentId: string,
  minutes: number,
  startTimeZone: string,
  endTimeZone = startTimeZone,
): SegmentFixture {
  return Object.freeze({
    segmentId,
    miles: Math.max(10, minutes / 2),
    minutes,
    startTimeZone,
    endTimeZone,
  });
}

describe('Stage 15 time-zone acceptance matrix', () => {
  it('renders a Central-to-Eastern crossing and preserves elapsed UTC minutes', () => {
    const stops = [
      stop('central', 1, 'America/Chicago', 'start-location'),
      stop('eastern', 2, 'America/New_York', 'final-consignee'),
    ];
    const result = simulateEtaTrip(
      input(stops, [segment('central-eastern', 60, 'America/Chicago', 'America/New_York')]),
    );
    const driving = result.earliestLegal.timeline.find(
      (event) => event.type === 'DRIVING',
    );

    expect(driving?.duration.value).toBe(60);
    expect(driving?.startLocal.localDateTime).toBe('2026-07-20T10:00');
    expect(driving?.endLocal.localDateTime).toBe('2026-07-20T12:00');
    expect(driving?.endLocal.timeZone).toBe('America/New_York');
  });

  it('keeps a destination appointment attached to destination-local time', () => {
    const destination = stop(
      'denver-appointment',
      2,
      'America/Denver',
      'final-consignee',
      {
        appointment: {
          mode: 'fixed',
          at: {
            localDateTime: localDateTime('2026-07-20T10:30'),
            timeZone: ianaTimeZone('America/Denver'),
          },
          lateTolerance: durationInMinutes(0),
        },
      },
    );
    const stops = [
      stop('pacific-origin', 1, 'America/Los_Angeles', 'start-location'),
      destination,
    ];
    const result = simulateEtaTrip(
      input(stops, [segment('destination-local', 60, 'America/Los_Angeles', 'America/Denver')]),
    );
    const stopResult = result.earliestLegal.stopResults[1];
    const wait = result.earliestLegal.timeline.find(
      (event) => event.type === 'STOP_WAIT',
    );

    expect(stopResult?.appointmentOutcome).toBe('early');
    expect(stopResult?.waitingTime.value).toBe(30);
    expect(wait?.startLocal.timeZone).toBe('America/Denver');
    expect(wait?.endLocal.localDateTime).toBe('2026-07-20T10:30');
  });

  it('renders a qualifying rest in the crossed-into zone before the next crossing', () => {
    const stops = [
      stop('pacific', 1, 'America/Los_Angeles', 'start-location'),
      stop('mountain-rest', 2, 'America/Denver', 'sleeper-rest'),
      stop('central-final', 3, 'America/Chicago', 'final-consignee'),
    ];
    const result = simulateEtaTrip(
      input(
        stops,
        [
          segment('to-mountain-rest', 60, 'America/Los_Angeles', 'America/Denver'),
          segment('after-mountain-rest', 60, 'America/Denver', 'America/Chicago'),
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
    const afterRest = result.earliestLegal.timeline.find(
      (event) => event.segmentId === 'after-mountain-rest' && event.type === 'DRIVING',
    );

    expect(rest?.startLocal.timeZone).toBe('America/Denver');
    expect(rest?.endLocal.timeZone).toBe('America/Denver');
    expect(afterRest?.startLocal.timeZone).toBe('America/Denver');
    expect(afterRest?.endLocal.timeZone).toBe('America/Chicago');
  });
});

describe('Stage 15 multi-stop acceptance matrix', () => {
  it('simulates five intermediate stops in exact route order', () => {
    const stops = [
      stop('origin', 1, 'America/Denver', 'start-location'),
      ...Array.from({ length: 5 }, (_, index) =>
        stop(
          `intermediate-${String(index + 1)}`,
          index + 2,
          'America/Denver',
          'intermediate-delivery',
        ),
      ),
      stop('final', 7, 'America/Denver', 'final-consignee'),
    ];
    const segments = Array.from({ length: 6 }, (_, index) =>
      segment(`five-stop-${String(index + 1)}`, 15, 'America/Denver'),
    );
    const result = simulateEtaTrip(input(stops, segments));

    expect(result.earliestLegal.status).toBe('COMPLETE');
    expect(result.earliestLegal.stopResults.map((item) => item.stop.id)).toEqual(
      stops.map((item) => item.id),
    );
  });

  it('recalculates from a reordered immutable stop list', () => {
    const original = [
      stop('origin', 1, 'America/Denver', 'start-location'),
      stop('alpha', 2, 'America/Denver', 'intermediate-delivery'),
      stop('beta', 3, 'America/Denver', 'intermediate-delivery'),
      stop('final', 4, 'America/Denver', 'final-consignee'),
    ];
    const reordered = reorderStop(original, 'beta', 1);
    const originalResult = simulateEtaTrip(
      input(original, [
        segment('original-1', 15, 'America/Denver'),
        segment('original-2', 20, 'America/Denver'),
        segment('original-3', 25, 'America/Denver'),
      ]),
    );
    const reorderedResult = simulateEtaTrip(
      input(reordered, [
        segment('reordered-1', 25, 'America/Denver'),
        segment('reordered-2', 20, 'America/Denver'),
        segment('reordered-3', 15, 'America/Denver'),
      ]),
    );

    expect(reorderedResult.earliestLegal.stopResults.map((item) => item.stop.id)).toEqual([
      'origin',
      'beta',
      'alpha',
      'final',
    ]);
    expect(etaSimulationSnapshot(reorderedResult)).not.toEqual(
      etaSimulationSnapshot(originalResult),
    );
    expect(original.map((item) => item.id)).toEqual(['origin', 'alpha', 'beta', 'final']);
  });

  it('recalculates after a stop is inserted between existing stops', () => {
    const original = [
      stop('origin', 1, 'America/Denver', 'start-location'),
      stop('final', 2, 'America/Denver', 'final-consignee'),
    ];
    const inserted = insertStop(
      original,
      stop('inserted', 3, 'America/Denver', 'intermediate-pickup'),
      1,
    );
    const result = simulateEtaTrip(
      input(inserted, [
        segment('to-inserted', 20, 'America/Denver'),
        segment('from-inserted', 30, 'America/Denver'),
      ]),
    );

    expect(result.earliestLegal.stopResults.map((item) => item.stop.id)).toEqual([
      'origin',
      'inserted',
      'final',
    ]);
    expect(result.earliestLegal.finalStopId).toBe('final');
  });

  it('uses a different configured service duration at every stop', () => {
    const serviceMinutes = [5, 10, 15, 20];
    const stops = [
      stop('origin', 1, 'America/Denver', 'start-location', {
        serviceDuration: { mode: 'exact', duration: durationInMinutes(serviceMinutes[0] ?? 0) },
      }),
      stop('one', 2, 'America/Denver', 'intermediate-pickup', {
        serviceDuration: { mode: 'exact', duration: durationInMinutes(serviceMinutes[1] ?? 0) },
      }),
      stop('two', 3, 'America/Denver', 'intermediate-delivery', {
        serviceDuration: { mode: 'exact', duration: durationInMinutes(serviceMinutes[2] ?? 0) },
      }),
      stop('final', 4, 'America/Denver', 'final-consignee', {
        serviceDuration: { mode: 'exact', duration: durationInMinutes(serviceMinutes[3] ?? 0) },
      }),
    ];
    const result = simulateEtaTrip(
      input(stops, [
        segment('duration-1', 15, 'America/Denver'),
        segment('duration-2', 15, 'America/Denver'),
        segment('duration-3', 15, 'America/Denver'),
      ]),
    );

    expect(result.earliestLegal.stopResults.map((item) => item.serviceTime.value)).toEqual(
      serviceMinutes,
    );
  });

  it('reports a late appointment without changing legal speed or HOS assumptions', () => {
    const destination = stop('late', 2, 'America/Denver', 'final-consignee', {
      appointment: {
        mode: 'fixed',
        at: {
          localDateTime: localDateTime('2026-07-20T09:30'),
          timeZone: ianaTimeZone('America/Denver'),
        },
        lateTolerance: durationInMinutes(15),
      },
    });
    const stops = [
      stop('origin', 1, 'America/Denver', 'start-location'),
      destination,
    ];
    const result = simulateEtaTrip(
      input(stops, [segment('late-appointment', 60, 'America/Denver')]),
    );
    const stopResult = result.earliestLegal.stopResults[1];

    expect(result.earliestLegal.status).toBe('COMPLETE');
    expect(stopResult?.appointmentOutcome).toBe('missed');
    expect(stopResult?.warnings.map((warning) => warning.code)).toContain(
      'APPOINTMENT_MISSED',
    );
    expect(result.earliestLegal.speedDecisions[0]?.selectedSpeed.value).toBeLessThanOrEqual(
      speedModel.maximumAverageTripSpeed.value,
    );
  });

  it('allows a required 30-minute interruption to overlap qualifying stop service', () => {
    const destination = stop('qualifying-break', 2, 'America/Denver', 'driver-break', {
      serviceDuration: { mode: 'exact', duration: durationInMinutes(30) },
      serviceDutyStatus: 'OFF_DUTY',
    });
    const stops = [
      stop('origin', 1, 'America/Denver', 'start-location'),
      destination,
    ];
    const result = simulateEtaTrip(
      input(stops, [segment('break-overlap', 30, 'America/Denver')], {
        initialHosContext: Object.freeze({
          departureState: departureState({
            departureAt: '2026-07-20T15:00:00.000Z',
            departureTimeZone: 'America/Denver',
            drivenSinceLastQualifyingInterruption: durationInMinutes(450),
          }),
          dutyEvents: Object.freeze([]),
        }),
      }),
    );

    expect(result.earliestLegal.status).toBe('COMPLETE');
    expect(result.earliestLegal.stopResults[1]?.serviceTime.value).toBe(30);
    expect(
      result.earliestLegal.timeline.some(
        (event) => event.type === 'HOS_ACTION' && event.duration.value === 30,
      ),
    ).toBe(false);
  });

  it('allows a required 10-hour rest to overlap an overnight facility wait', () => {
    const destination = stop('overnight-wait', 2, 'America/Denver', 'final-consignee', {
      appointment: {
        mode: 'fixed',
        at: {
          localDateTime: localDateTime('2026-07-20T20:00'),
          timeZone: ianaTimeZone('America/Denver'),
        },
        lateTolerance: durationInMinutes(0),
      },
      waitingDutyStatus: 'OFF_DUTY',
      overnightParkingAllowed: true,
    });
    const stops = [
      stop('origin', 1, 'America/Denver', 'start-location'),
      destination,
    ];
    const result = simulateEtaTrip(
      input(stops, [segment('overnight-overlap', 60, 'America/Denver')], {
        initialHosContext: Object.freeze({
          departureState: departureState({
            departureAt: '2026-07-20T15:00:00.000Z',
            departureTimeZone: 'America/Denver',
            drivingTimeRemaining: durationInMinutes(60),
            shiftTimeRemaining: durationInMinutes(60),
          }),
          dutyEvents: Object.freeze([]),
        }),
      }),
    );

    expect(result.earliestLegal.status).toBe('COMPLETE');
    expect(result.earliestLegal.stopResults[1]?.waitingTime.value).toBe(600);
    expect(
      result.earliestLegal.timeline.some((event) => event.type === 'STOP_HOS_HOLD'),
    ).toBe(false);
  });
});
