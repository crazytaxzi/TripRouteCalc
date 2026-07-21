import { randomUUID } from 'node:crypto';

import {
  assessCommercialRoute,
  createStopFromDefaults,
  distanceInMiles,
  durationInMinutes,
  etaSimulationSnapshot,
  ianaTimeZone,
  simulateEtaTrip,
  speedInMilesPerHour,
  suggestedStopDefaults,
  utcInstant,
  validateDriverHosDepartureState,
  validateTripStopPlan,
} from '@trip-route-calc/foundation';
import type {
  CommercialRoutePayload,
  DriverHosDepartureState,
  EtaExternalAdjustment,
  EtaSegmentCondition,
  EtaSimulationInput,
  EtaSpeedModel,
  NormalizedCommercialRouteResult,
  ResolvedStopLocation,
  TripStopPlan,
} from '@trip-route-calc/foundation';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  TripRevisionRepository,
  createPersistenceClient,
  databaseUrlFromEnvironment,
} from '../src/index.js';
import type {
  CreateTripRevisionInput,
  PersistenceClient,
  TenantContext,
} from '../src/index.js';

const TABLES = [
  'audit_events',
  'trip_revision_rules',
  'route_provider_responses',
  'calculation_results',
  'user_overrides',
  'calculation_assumptions',
  'warning_acknowledgements',
  'compliance_warnings',
  'appointment_windows',
  'trip_stop_details',
  'trip_stops',
  'trip_revisions',
  'trips',
  'drivers',
  'carrier_memberships',
  'carriers',
  'users',
] as const;

interface TenantFixture {
  readonly context: TenantContext;
  readonly tripId: string;
}

const provenance = Object.freeze({
  origin: 'CALCULATED' as const,
  verification: 'VERIFIED' as const,
  verifiedAt: utcInstant('2026-07-20T14:58:00.000Z'),
  sourceName: 'Stage 15 persistence fixture',
  explanation: 'Deterministic test-only evidence.',
});

const noDelay: EtaExternalAdjustment = Object.freeze({
  status: 'AVAILABLE',
  duration: Object.freeze({
    minimum: durationInMinutes(0),
    expected: durationInMinutes(0),
    maximum: durationInMinutes(0),
  }),
  sourceName: 'Stage 15 persistence fixture',
  reference: 'fixture://stage-15/persistence/no-delay',
  confidence: 'HIGH',
  explanation: 'No external delay in the deterministic persistence fixture.',
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
  explanation: 'Deterministic persistence-test speed model.',
});

let client: PersistenceClient;

async function resetDatabase(): Promise<void> {
  await client.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((table) => `"${table}"`).join(', ')} CASCADE`,
  );
}

async function seedTenant(label: string): Promise<TenantFixture> {
  const suffix = randomUUID();
  const user = await client.user.create({
    data: {
      email: `${label}-${suffix}@example.test`,
      displayName: `${label} user`,
    },
  });
  const carrier = await client.carrier.create({
    data: {
      legalName: `${label} carrier`,
      homeTerminalTimeZone: 'America/Los_Angeles',
    },
  });
  await client.carrierMembership.create({
    data: { carrierId: carrier.id, userId: user.id, role: 'OWNER' },
  });
  const driver = await client.driver.create({
    data: { carrierId: carrier.id, displayName: `${label} driver` },
  });
  const trip = await client.trip.create({
    data: { carrierId: carrier.id, driverId: driver.id },
  });
  return {
    context: { carrierId: carrier.id, actorUserId: user.id },
    tripId: trip.id,
  };
}

function priorDutyDays(): readonly unknown[] {
  return Object.freeze(
    Array.from({ length: 8 }, (_, index) => ({
      date: `2026-07-${String(12 + index).padStart(2, '0')}`,
      onDutyTime: durationInMinutes(0),
    })),
  );
}

function departureState(): DriverHosDepartureState {
  const departureAt = '2026-07-20T15:00:00.000Z';
  return validateDriverHosDepartureState({
    driver: { id: 'stage-15-persisted-driver', nameOrIdentifier: 'Persisted Driver' },
    departureAt,
    departureTimeZone: 'America/Los_Angeles',
    currentDutyStatus: 'ON_DUTY_NOT_DRIVING',
    currentDutyStatusStartedAt: departureAt,
    drivingTimeRemaining: durationInMinutes(660),
    shiftTimeRemaining: durationInMinutes(840),
    cycleTimeRemaining: durationInMinutes(4_200),
    cycleType: 'SEVENTY_HOURS_EIGHT_DAYS',
    drivenSinceLastQualifyingInterruption: durationInMinutes(0),
    onDutyTimeCurrentShift: durationInMinutes(0),
    offDutyTimeImmediatelyBeforeDeparture: durationInMinutes(600),
    qualifyingTenHourBreakCompleted: true,
    priorDutyDays: priorDutyDays(),
    recapReturns: [],
    sleeperBerthEligible: true,
    existingSleeperPeriods: [],
    splitSleeperEnabled: false,
    restart34HourPlanned: false,
    carrierMaxDailyDriving: durationInMinutes(660),
    carrierMaxDuty: durationInMinutes(840),
    provenance: {
      driver: provenance,
      departure: provenance,
      dutyStatus: provenance,
      clocks: provenance,
      dutyHistory: provenance,
      sleeper: provenance,
      carrierPolicy: provenance,
      restPreference: provenance,
    },
  });
}

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
  });
}

function route(stops: readonly TripStopPlan[]): NormalizedCommercialRouteResult {
  const geometry = {
    format: 'geojson-line-string' as const,
    coordinates: [[-117, 46], [-104, 39]] as [number, number][],
  };
  const payload: CommercialRoutePayload = {
    routeId: 'persisted-stage-15-route',
    routeKind: 'commercial-vehicle',
    provider: {
      providerName: 'stage-15-persistence-provider',
      providerVersion: 'fixture-v1',
      providerRequestId: 'stage-15-persisted-request',
      requestedAt: utcInstant('2026-07-20T14:59:00.000Z'),
      respondedAt: utcInstant('2026-07-20T14:59:01.000Z'),
      confidence: 'high',
    },
    totalDistance: distanceInMiles(50),
    travelDuration: durationInMinutes(60),
    geometry,
    legs: [
      {
        legId: 'persisted-leg-1',
        sequence: 1,
        originReferenceId: stops[0]?.id ?? 'missing-origin',
        destinationStopId: stops[1]?.id ?? 'missing-destination',
        distance: distanceInMiles(50),
        travelDuration: durationInMinutes(60),
        geometry,
        segments: [
          {
            segmentId: 'persisted-segment-1',
            sequence: 1,
            distance: distanceInMiles(50),
            travelDuration: durationInMinutes(60),
            geometry,
            expectedSpeed: speedInMilesPerHour(50),
            jurisdictionCodes: ['US-WA', 'US-ID'],
            verificationStatus: 'verified',
            restrictions: [],
            unavailableFields: [],
          },
        ],
        unavailableFields: [],
      },
    ],
    restrictions: [],
    unavailableFields: [],
  };
  return assessCommercialRoute(payload);
}

function simulationInput(): EtaSimulationInput {
  const stops = [
    stop('persisted-origin', 1, 'America/Los_Angeles', 'start-location'),
    stop('persisted-destination', 2, 'America/Denver', 'final-consignee'),
  ];
  const segmentConditions: readonly EtaSegmentCondition[] = Object.freeze([
    Object.freeze({
      segmentId: 'persisted-segment-1',
      roadClass: 'INTERSTATE' as const,
      startTimeZone: ianaTimeZone('America/Los_Angeles'),
      endTimeZone: ianaTimeZone('America/Denver'),
      legalOrProviderSpeedLimit: speedInMilesPerHour(65),
      traffic: noDelay,
      weather: noDelay,
      explanation: 'Verified persisted segment conditions.',
    }),
  ]);
  return {
    route: route(stops),
    stops,
    initialHosContext: Object.freeze({
      departureState: departureState(),
      dutyEvents: Object.freeze([]),
    }),
    speedModel,
    segmentConditions,
    operationalEvents: Object.freeze([]),
    availableOperationalLocations: Object.freeze([]),
    complianceActions: Object.freeze([]),
    hosAvailabilityActions: Object.freeze([]),
  };
}

function revisionInput(
  tripId: string,
  input: EtaSimulationInput,
): CreateTripRevisionInput {
  const result = simulateEtaTrip(input);
  expect(result.expected.confidence).toBe('HIGH');
  return {
    tripId,
    calculationTimestamp: utcInstant('2026-07-20T14:59:01.000Z'),
    ruleSetVersion: 'stage-15-v1',
    routingProviderName: input.route.provider.providerName,
    ...(input.route.provider.providerVersion === undefined
      ? {}
      : { routingProviderVersion: input.route.provider.providerVersion }),
    inputSnapshot: input as unknown as Readonly<Record<string, unknown>>,
    stops: input.stops.map((tripStop) => ({
      sequence: tripStop.sequence,
      type: tripStop.type,
      required: tripStop.required,
      timeZone: tripStop.location.timeZone,
      expectedServiceDuration: durationInMinutes(0),
      details: {
        lockedPosition: tripStop.lockedPosition,
        location: tripStop.location,
        appointment: tripStop.appointment,
        facilityHours: tripStop.facilityHours,
        checkInDuration: tripStop.checkInDuration,
        serviceDuration: tripStop.serviceDuration,
        waitingDutyStatus: tripStop.waitingDutyStatus,
        checkInDutyStatus: tripStop.checkInDutyStatus,
        serviceDutyStatus: tripStop.serviceDutyStatus,
        earlyParkingAllowed: tripStop.earlyParkingAllowed,
        overnightParkingAllowed: tripStop.overnightParkingAllowed,
        ...(tripStop.notes === undefined ? {} : { notes: tripStop.notes }),
        ...(tripStop.instructions === undefined
          ? {}
          : { instructions: tripStop.instructions }),
      },
    })),
    result: {
      confidence: 'high',
      confidenceReasons: result.expected.confidenceReasons,
      explanation: result.expected.explanations,
      snapshot: etaSimulationSnapshot(result),
    },
  };
}

beforeAll(() => {
  client = createPersistenceClient(databaseUrlFromEnvironment());
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await client.$disconnect();
});

describe('Stage 15 deterministic ETA revision replay', () => {
  it('reproduces all three projections and the event timeline from one persisted revision', async () => {
    const tenant = await seedTenant('eta-replay');
    const repository = new TripRevisionRepository(client, tenant.context);
    const originalInput = simulationInput();
    const created = await repository.createRevision(
      revisionInput(tenant.tripId, originalInput),
    );
    const stored = await repository.getRevision(created.id);

    expect(stored?.inputSnapshot).toBeDefined();
    expect(stored?.resultSnapshot).toBeDefined();
    const replayInput = stored?.inputSnapshot as unknown as EtaSimulationInput;
    const firstReplay = etaSimulationSnapshot(simulateEtaTrip(replayInput));
    const secondReplay = etaSimulationSnapshot(simulateEtaTrip(replayInput));

    expect(firstReplay).toEqual(stored?.resultSnapshot);
    expect(secondReplay).toEqual(firstReplay);
    expect(stored?.calculationResult?.resultSnapshot).toEqual(firstReplay);
    expect(stored?.stops.map((storedStop) => storedStop.sequence)).toEqual([1, 2]);
  });
});
