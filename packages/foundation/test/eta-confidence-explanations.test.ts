import { describe, expect, it } from 'vitest';

import {
  assessCommercialRoute,
  createStopFromDefaults,
  distanceInMiles,
  durationInMinutes,
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
  sourceName: 'Stage 16 explanation fixture',
  reference: 'fixture://stage-16/no-delay',
  confidence: 'HIGH',
  explanation: 'No external delay is applied.',
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
  explanation: 'Stage 16 explanation test speed model.',
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
  type: TripStopPlan['type'],
  appointment = false,
): TripStopPlan {
  const created = createStopFromDefaults(
    {
      id,
      sequence,
      type,
      required: true,
      location: location(id, 'America/Denver'),
      earlyParkingAllowed: true,
      overnightParkingAllowed: true,
    },
    suggestedStopDefaults(),
  );
  return validateTripStopPlan({
    ...created,
    appointment: appointment
      ? {
          mode: 'fixed',
          at: {
            localDateTime: localDateTime('2026-07-20T12:00'),
            timeZone: ianaTimeZone('America/Denver'),
          },
          lateTolerance: durationInMinutes(0),
        }
      : created.appointment,
    checkInDuration: durationInMinutes(0),
    serviceDuration: { mode: 'exact', duration: durationInMinutes(0) },
    waitingDutyStatus: 'OFF_DUTY',
    checkInDutyStatus: 'ON_DUTY_NOT_DRIVING',
    serviceDutyStatus: 'ON_DUTY_NOT_DRIVING',
  });
}

function simulationInput(options: {
  readonly providerTimeAvailable?: boolean;
  readonly verified?: boolean;
  readonly appointment?: boolean;
} = {}): EtaSimulationInput {
  const providerTimeAvailable = options.providerTimeAvailable ?? true;
  const verified = options.verified ?? true;
  const stops = [
    stop('origin', 1, 'start-location'),
    stop('destination', 2, 'final-consignee', options.appointment ?? false),
  ];
  const geometry = {
    format: 'geojson-line-string' as const,
    coordinates: [[-105, 39], [-104, 39]] as [number, number][],
  };
  const payload: CommercialRoutePayload = {
    routeId: 'stage-16-explanation-route',
    routeKind: 'commercial-vehicle',
    provider: {
      providerName: 'stage-16-fixture-provider',
      providerVersion: 'fixture-v1',
      providerRequestId: 'stage-16-explanation-request',
      requestedAt: utcInstant('2026-07-20T14:59:00.000Z'),
      respondedAt: utcInstant('2026-07-20T14:59:01.000Z'),
      confidence: 'high',
    },
    totalDistance: distanceInMiles(50),
    travelDuration: durationInMinutes(60),
    geometry,
    legs: [
      {
        legId: 'stage-16-explanation-leg',
        sequence: 1,
        originReferenceId: 'origin',
        destinationStopId: 'destination',
        distance: distanceInMiles(50),
        travelDuration: durationInMinutes(60),
        geometry,
        segments: [
          {
            segmentId: 'stage-16-explanation-segment',
            sequence: 1,
            distance: distanceInMiles(50),
            travelDuration: durationInMinutes(60),
            geometry,
            expectedSpeed: speedInMilesPerHour(50),
            jurisdictionCodes: ['US-CO'],
            verificationStatus: verified ? 'verified' : 'unverified',
            restrictions: [],
            unavailableFields: providerTimeAvailable
              ? []
              : [
                  {
                    path: 'legs[].segments[].travelDuration',
                    reason: 'Provider travel time is unavailable in this fixture.',
                    impact: 'lowers-confidence' as const,
                  },
                ],
          },
        ],
        unavailableFields: [],
      },
    ],
    restrictions: [],
    unavailableFields: [],
  };
  const condition: EtaSegmentCondition = Object.freeze({
    segmentId: 'stage-16-explanation-segment',
    roadClass: 'INTERSTATE',
    startTimeZone: ianaTimeZone('America/Denver'),
    endTimeZone: ianaTimeZone('America/Denver'),
    legalOrProviderSpeedLimit: speedInMilesPerHour(65),
    traffic: noDelay,
    weather: noDelay,
    explanation: 'Verified fixture conditions.',
  });

  return {
    route: assessCommercialRoute(payload),
    stops,
    initialHosContext: Object.freeze({
      departureState: departureState({
        departureAt: '2026-07-20T15:00:00.000Z',
        departureTimeZone: 'America/Denver',
      }),
      dutyEvents: Object.freeze([]),
    }),
    speedModel,
    segmentConditions: Object.freeze([condition]),
    operationalEvents: Object.freeze([]),
    availableOperationalLocations: Object.freeze([]),
    complianceActions: Object.freeze([]),
    hosAvailabilityActions: Object.freeze([]),
    revisionReference: 'revision-stage-16-explanation',
  };
}

describe('Stage 16 ETA confidence and explanations', () => {
  it('returns structured projection confidence and dominant reasons', () => {
    const result = simulateEtaTrip(simulationInput());

    expect(result.expected.confidence).toBe('MODERATE');
    expect(result.expected.confidenceAssessment).toMatchObject({
      method: 'stage-16-rules-v1',
      level: 'MODERATE',
      legalConclusionStatus: 'AVAILABLE',
      dominantReasonCodes: ['MISSING_APPOINTMENT_WINDOW'],
    });
    expect(result.expected.confidenceReasons[0]).toMatchObject({
      code: 'MISSING_APPOINTMENT_WINDOW',
      category: 'OPERATIONAL_UNCERTAINTY',
      maximumLevel: 'MODERATE',
    });
    expect(
      result.expected.confidenceReasons[0]?.references.some(
        (reference) =>
          reference.kind === 'STOP' && reference.reference === 'stop-2',
      ),
    ).toBe(true);
  });

  it('explains HOS limits, appointment waiting, and final local time with references', () => {
    const result = simulateEtaTrip(simulationInput({ appointment: true }));
    const categories = result.expected.constraintExplanations.map(
      (explanation) => explanation.category,
    );

    expect(categories).toContain('HOS_CONSTRAINT');
    expect(categories).toContain('APPOINTMENT_WAIT');
    expect(categories).toContain('FINAL_LOCAL_TIME');
    expect(
      result.expected.constraintExplanations.every(
        (explanation) => explanation.references.length > 0,
      ),
    ).toBe(true);
    expect(
      result.expected.constraintExplanations.some((explanation) =>
        explanation.references.some(
          (reference) =>
            reference.kind === 'REVISION' &&
            reference.reference === 'revision-stage-16-explanation',
        ),
      ),
    ).toBe(true);
  });

  it('explains average-speed fallback and lowers confidence to LOW', () => {
    const result = simulateEtaTrip(
      simulationInput({ providerTimeAvailable: false, appointment: true }),
    );

    expect(result.expected.confidence).toBe('LOW');
    expect(result.expected.confidenceReasons.map((reason) => reason.code)).toContain(
      'AVERAGE_SPEED_FALLBACK',
    );
    expect(
      result.expected.constraintExplanations.some(
        (explanation) => explanation.category === 'SPEED_FALLBACK',
      ),
    ).toBe(true);
  });

  it('withholds a legal conclusion when a route segment is unverified', () => {
    const result = simulateEtaTrip(
      simulationInput({ verified: false, appointment: true }),
    );

    expect(result.expected.status).toBe('BLOCKED');
    expect(result.expected.confidence).toBe('UNVERIFIED');
    expect(result.expected.confidenceAssessment.legalConclusionStatus).toBe(
      'NOT_AVAILABLE',
    );
    expect(result.expected.confidenceReasons.map((reason) => reason.code)).toContain(
      'ROUTE_SEGMENT_MANUAL_VERIFICATION',
    );
  });
});
