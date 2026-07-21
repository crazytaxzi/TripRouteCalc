import { randomUUID } from 'node:crypto';

import {
  distanceInMiles,
  durationInMinutes,
  ianaTimeZone,
  lengthInFeet,
  lengthInInches,
  speedInMilesPerHour,
  utcInstant,
  volumeInUsGallons,
  weightInPounds,
} from '@trip-route-calc/foundation';
import {
  createPersistenceClient,
  databaseUrlFromEnvironment,
} from '@trip-route-calc/persistence';
import type {
  PersistenceClient,
  TenantContext,
} from '@trip-route-calc/persistence';
import { createCommercialRoutingRuntime } from '@trip-route-calc/routing';
import type {
  CommercialRouteProvider,
  ProviderLicenseCapabilities,
} from '@trip-route-calc/routing';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { z } from 'zod';

import {
  FixedWindowRateLimiter,
  HmacBearerAuthenticator,
  PublicIdCodec,
  Stage17ApplicationService,
  createStage17Api,
} from '../src/index.js';

const secret =
  'stage-17-exit-gate-secret-with-at-least-thirty-two-characters';
const responseObjectSchema = z.record(z.unknown());

let client: PersistenceClient;
let authenticator: HmacBearerAuthenticator;
let publicIds: PublicIdCodec;
let api: FastifyInstance;

interface SeededTenant extends TenantContext {
  readonly token: string;
}

interface CreatedTrip {
  readonly tripId: string;
  readonly revisionNumber: number;
}

interface AddedStop {
  readonly stopId: string;
  readonly revisionNumber: number;
}

function responseObject(
  response: LightMyRequestResponse,
): Record<string, unknown> {
  return responseObjectSchema.parse(response.json());
}

function nestedObject(
  value: unknown,
  label: string,
): Record<string, unknown> {
  const parsed = responseObjectSchema.safeParse(value);
  if (!parsed.success) throw new Error(`${label} was not a JSON object.`);
  return parsed.data;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value === '') {
    throw new Error(`${label} was not a non-empty string.`);
  }
  return value;
}

function requiredNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} was not a finite number.`);
  }
  return value;
}

function headers(
  tenant: SeededTenant,
  idempotencyKey?: string,
): Record<string, string> {
  return {
    authorization: `Bearer ${tenant.token}`,
    ...(idempotencyKey === undefined
      ? {}
      : { 'idempotency-key': idempotencyKey }),
  };
}

async function resetDatabase(): Promise<void> {
  await client.$executeRawUnsafe(
    'TRUNCATE TABLE "carriers", "users" CASCADE',
  );
}

async function seedTenant(label: string): Promise<SeededTenant> {
  const suffix = randomUUID();
  const user = await client.user.create({
    data: {
      email: `${label}-${suffix}@example.test`,
      displayName: `${label} user`,
    },
  });
  const carrier = await client.carrier.create({
    data: {
      legalName: `${label} carrier ${suffix}`,
      homeTerminalTimeZone: 'America/Denver',
    },
  });
  await client.carrierMembership.create({
    data: {
      carrierId: carrier.id,
      userId: user.id,
      role: 'OWNER',
    },
  });
  const now = Math.floor(Date.now() / 1_000);
  return {
    carrierId: carrier.id,
    actorUserId: user.id,
    token: authenticator.issue({
      version: 1,
      carrierId: carrier.id,
      actorUserId: user.id,
      tokenId: `exit-gate-${suffix}`,
      issuedAt: now - 60,
      expiresAt: now + 3_600,
    }),
  };
}

async function createDriver(
  server: FastifyInstance,
  tenant: SeededTenant,
  label: string,
): Promise<string> {
  const response = await server.inject({
    method: 'POST',
    url: '/api/drivers',
    headers: headers(tenant, `driver-${label}-${randomUUID()}`),
    payload: { displayName: `${label} Driver` },
  });
  expect(response.statusCode).toBe(201);
  return requiredString(responseObject(response).driverId, 'driverId');
}

async function createTrip(
  server: FastifyInstance,
  tenant: SeededTenant,
  driverId: string,
): Promise<CreatedTrip> {
  const response = await server.inject({
    method: 'POST',
    url: '/api/trips',
    headers: headers(tenant, `trip-${randomUUID()}`),
    payload: { driverId, ruleSetVersion: 'stage-17-exit-gate-v1' },
  });
  expect(response.statusCode).toBe(201);
  const body = responseObject(response);
  const currentRevision = nestedObject(
    body.currentRevision,
    'currentRevision',
  );
  return {
    tripId: requiredString(body.tripId, 'tripId'),
    revisionNumber: requiredNumber(
      currentRevision.revisionNumber,
      'revisionNumber',
    ),
  };
}

function stopBody(
  sequence: number,
  type: 'start-location' | 'final-consignee',
): Readonly<Record<string, unknown>> {
  return {
    sequence,
    type,
    required: true,
    lockedPosition: false,
    location: {
      description: `${type} ${String(sequence)}`,
      timeZone: 'America/Denver',
      resolutionStatus: 'user-confirmed',
    },
    appointment: { mode: 'none' },
    facilityHours: { windows: [] },
    checkInDuration: durationInMinutes(0),
    serviceDuration: {
      mode: 'exact',
      duration: durationInMinutes(0),
    },
    waitingDutyStatus: 'OFF_DUTY',
    checkInDutyStatus: 'ON_DUTY_NOT_DRIVING',
    serviceDutyStatus: 'ON_DUTY_NOT_DRIVING',
    earlyParkingAllowed: true,
    overnightParkingAllowed: true,
  };
}

async function addStop(
  server: FastifyInstance,
  tenant: SeededTenant,
  tripId: string,
  expectedRevisionNumber: number,
  stop: Readonly<Record<string, unknown>>,
): Promise<AddedStop> {
  const response = await server.inject({
    method: 'POST',
    url: `/api/trips/${tripId}/stops`,
    headers: headers(tenant, `stop-${randomUUID()}`),
    payload: { expectedRevisionNumber, stop },
  });
  expect(response.statusCode).toBe(201);
  const body = responseObject(response);
  return {
    stopId: requiredString(nestedObject(body.stop, 'stop').id, 'stopId'),
    revisionNumber: requiredNumber(
      nestedObject(
        nestedObject(body.trip, 'trip').currentRevision,
        'currentRevision',
      ).revisionNumber,
      'revisionNumber',
    ),
  };
}

function provenance(): Readonly<Record<string, unknown>> {
  return {
    origin: 'USER_ENTERED',
    verification: 'UNVERIFIED',
    sourceName: 'Stage 17 API acceptance fixture',
    explanation: 'Deterministic test-only HOS evidence.',
  };
}

function departureState(): Readonly<Record<string, unknown>> {
  const evidence = provenance();
  return {
    driver: {
      id: 'driver-stage-17-api',
      nameOrIdentifier: 'Stage 17 API Driver',
    },
    departureAt: '2026-07-20T15:00:00.000Z',
    departureTimeZone: 'America/Denver',
    currentDutyStatus: 'ON_DUTY_NOT_DRIVING',
    currentDutyStatusStartedAt: '2026-07-20T15:00:00.000Z',
    drivingTimeRemaining: durationInMinutes(660),
    shiftTimeRemaining: durationInMinutes(840),
    cycleTimeRemaining: durationInMinutes(4_200),
    cycleType: 'SEVENTY_HOURS_EIGHT_DAYS',
    drivenSinceLastQualifyingInterruption: durationInMinutes(0),
    onDutyTimeCurrentShift: durationInMinutes(0),
    offDutyTimeImmediatelyBeforeDeparture: durationInMinutes(600),
    qualifyingTenHourBreakCompleted: true,
    priorDutyDays: [
      '2026-07-12',
      '2026-07-13',
      '2026-07-14',
      '2026-07-15',
      '2026-07-16',
      '2026-07-17',
      '2026-07-18',
      '2026-07-19',
    ].map((date) => ({ date, onDutyTime: durationInMinutes(0) })),
    recapReturns: [],
    sleeperBerthEligible: true,
    existingSleeperPeriods: [],
    splitSleeperEnabled: false,
    restart34HourPlanned: false,
    carrierMaxDailyDriving: durationInMinutes(660),
    carrierMaxDuty: durationInMinutes(840),
    provenance: {
      driver: evidence,
      departure: evidence,
      dutyStatus: evidence,
      clocks: evidence,
      dutyHistory: evidence,
      sleeper: evidence,
      carrierPolicy: evidence,
      restPreference: evidence,
    },
  };
}

function simulation(
  originStopId: string,
  destinationStopId: string,
): Readonly<Record<string, unknown>> {
  const geometry = {
    format: 'geojson-line-string',
    coordinates: [
      [-105, 39],
      [-104, 39],
    ],
  };
  const noDelay = {
    status: 'AVAILABLE',
    duration: {
      minimum: durationInMinutes(0),
      expected: durationInMinutes(0),
      maximum: durationInMinutes(0),
    },
    sourceName: 'Stage 17 API fixture',
    reference: 'fixture://stage-17/no-delay',
    confidence: 'HIGH',
    explanation: 'No external delay is applied.',
  };
  return {
    route: {
      routeId: 'stage-17-api-route',
      routeKind: 'commercial-vehicle',
      provider: {
        providerName: 'stage-17-api-fixture-provider',
        providerVersion: 'fixture-v1',
        providerRequestId: 'stage-17-api-request',
        requestedAt: '2026-07-20T14:59:00.000Z',
        respondedAt: '2026-07-20T14:59:01.000Z',
        confidence: 'high',
      },
      totalDistance: distanceInMiles(50),
      travelDuration: durationInMinutes(60),
      geometry,
      legs: [
        {
          legId: 'stage-17-api-leg',
          sequence: 1,
          originReferenceId: originStopId,
          destinationStopId,
          distance: distanceInMiles(50),
          travelDuration: durationInMinutes(60),
          geometry,
          segments: [
            {
              segmentId: 'stage-17-api-segment',
              sequence: 1,
              distance: distanceInMiles(50),
              travelDuration: durationInMinutes(60),
              geometry,
              expectedSpeed: speedInMilesPerHour(50),
              jurisdictionCodes: ['US-CO'],
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
    },
    initialHosContext: {
      departureState: departureState(),
      dutyEvents: [],
    },
    speedModel: {
      governedMaximumSpeed: speedInMilesPerHour(65),
      preferredPlanningSpeed: speedInMilesPerHour(58),
      maximumAverageTripSpeed: speedInMilesPerHour(55),
      carrierMaximumSpeed: speedInMilesPerHour(62),
      fallbackAverageSpeed: speedInMilesPerHour(50),
      roadClassSpeeds: [
        { roadClass: 'INTERSTATE', speed: speedInMilesPerHour(60) },
      ],
      projectionFactors: {
        earliestLegalBasisPoints: 10_000,
        expectedBasisPoints: 9_000,
        conservativeBasisPoints: 8_000,
      },
      explanation: 'Stage 17 API acceptance speed model.',
    },
    segmentConditions: [
      {
        segmentId: 'stage-17-api-segment',
        roadClass: 'INTERSTATE',
        startTimeZone: 'America/Denver',
        endTimeZone: 'America/Denver',
        legalOrProviderSpeedLimit: speedInMilesPerHour(65),
        traffic: noDelay,
        weather: noDelay,
        explanation: 'Verified fixture conditions.',
      },
    ],
    operationalEvents: [],
    availableOperationalLocations: [],
    complianceActions: [],
    hosAvailabilityActions: [],
  };
}

const license: ProviderLicenseCapabilities = {
  rawResponseRetention: 'forbidden',
  normalizedSnapshotRetention: 'allowed',
  providerReferenceRetention: 'allowed',
  commercialVehicleRoutingLicensed: true,
  coverageDescription: 'Test-only route contract fixture.',
};

function routeLocation(referenceId: string): Readonly<Record<string, unknown>> {
  return {
    referenceId,
    description: referenceId,
    latitude: 46.4,
    longitude: -117,
    timeZone: ianaTimeZone('America/Los_Angeles'),
    resolutionSource: 'provider-resolved',
    confidence: 'high',
    unavailableFields: [],
  };
}

function routeRequest(): Readonly<Record<string, unknown>> {
  return {
    requestId: 'stage-17-prohibited-request',
    requestedAt: utcInstant('2026-07-20T19:00:00Z'),
    departureAt: utcInstant('2026-07-20T20:00:00Z'),
    equipment: {
      tractor: {
        axleCount: 3,
        overallLength: lengthInFeet(20),
        height: lengthInFeet(13),
        width: lengthInInches(96),
        emptyWeight: weightInPounds(19_000),
        registeredGrossWeight: weightInPounds(80_000),
        fuelCapacity: volumeInUsGallons(200),
        estimatedFuelRange: distanceInMiles(1_200),
        governedSpeed: speedInMilesPerHour(65),
        planningCruiseSpeed: speedInMilesPerHour(55),
        hazmatEquipped: false,
      },
      trailer: {
        axleCount: 2,
        length: lengthInFeet(53),
        height: lengthInFeet(13.5),
        width: lengthInInches(102),
        currentKpra: lengthInFeet(40),
        emptyWeight: weightInPounds(14_000),
        maximumPayload: weightInPounds(54_000),
        reefer: false,
      },
      load: {
        hazmat: false,
        grossCargoWeight: weightInPounds(40_000),
        steerAxleWeight: weightInPounds(12_000),
        driveAxleWeight: weightInPounds(33_000),
        trailerAxleWeight: weightInPounds(32_000),
        totalGrossCombinationWeight: weightInPounds(77_000),
        length: lengthInFeet(48),
        height: lengthInFeet(8),
        width: lengthInFeet(8),
        permitRequirement: 'not-required',
        permitIdentifiers: [],
      },
      totalAxleCount: 5,
      trailerCount: 1,
      combinedDimensions: {
        overallLength: lengthInFeet(72),
        height: lengthInFeet(13.5),
        width: lengthInInches(102),
      },
      legalityStatus: 'not-evaluated',
    },
    origin: routeLocation('origin'),
    orderedStops: [
      {
        stopId: 'destination',
        sequence: 1,
        required: true,
        location: routeLocation('destination'),
      },
    ],
    avoidances: [],
    routePolicy: 'fastest-compliant',
    permitIdentifiers: [],
    comparisonMode: 'commercial-route-only',
  };
}

function prohibitedRoutePayload(): Readonly<Record<string, unknown>> {
  const geometry = {
    format: 'geojson-line-string',
    coordinates: [
      [-117, 46.4],
      [-116.9, 46.4],
    ],
  };
  return {
    routeId: 'stage-17-prohibited-route',
    routeKind: 'commercial-vehicle',
    provider: {
      providerName: 'stage-17-test-provider',
      providerVersion: 'fixture-v1',
      providerRequestId: 'stage-17-provider-request',
      requestedAt: utcInstant('2026-07-20T19:00:00Z'),
      respondedAt: utcInstant('2026-07-20T19:00:01Z'),
      confidence: 'high',
    },
    totalDistance: distanceInMiles(10),
    travelDuration: durationInMinutes(15),
    geometry,
    legs: [
      {
        legId: 'stage-17-prohibited-leg',
        sequence: 1,
        originReferenceId: 'origin',
        destinationStopId: 'destination',
        distance: distanceInMiles(10),
        travelDuration: durationInMinutes(15),
        geometry,
        segments: [
          {
            segmentId: 'stage-17-prohibited-segment',
            sequence: 1,
            distance: distanceInMiles(10),
            travelDuration: durationInMinutes(15),
            geometry,
            jurisdictionCodes: ['US-WA'],
            verificationStatus: 'prohibited',
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
}

function prohibitedProvider(): CommercialRouteProvider {
  return {
    metadata: {
      name: 'stage-17-test-provider',
      version: 'fixture-v1',
      credentialRequirement: 'none',
      capabilities: {
        geocoding: true,
        commercialRouting: true,
        routeRestrictions: true,
        trafficEstimate: false,
        roadClosures: false,
        consumerComparison: false,
      },
    },
    geocodeLocation: (): Promise<unknown> =>
      Promise.resolve(routeLocation('geocoded')),
    calculateCommercialRoute: (): Promise<unknown> =>
      Promise.resolve(prohibitedRoutePayload()),
    getRouteRestrictions: (): Promise<readonly never[]> => Promise.resolve([]),
  };
}

function serverWithRuntime(
  runtime: ReturnType<typeof createCommercialRoutingRuntime>,
): FastifyInstance {
  return createStage17Api({
    application: new Stage17ApplicationService({
      client,
      publicIds,
      routingRuntime: runtime,
      now: (): Date => new Date('2026-07-21T17:00:00.000Z'),
    }),
    authenticator,
    rateLimiter: new FixedWindowRateLimiter({
      limit: 1_000,
      windowMilliseconds: 60_000,
    }),
  });
}

beforeAll(() => {
  client = createPersistenceClient(databaseUrlFromEnvironment());
  authenticator = new HmacBearerAuthenticator(secret);
  publicIds = new PublicIdCodec(secret);
  api = serverWithRuntime(createCommercialRoutingRuntime({}));
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await api.close();
  await client.$disconnect();
});

describe('Stage 17 REST API exit gate', () => {
  it('calculates, persists, and retrieves a structured trip result', async () => {
    const tenant = await seedTenant('calculation');
    const driverId = await createDriver(api, tenant, 'Calculation');
    const trip = await createTrip(api, tenant, driverId);
    const origin = await addStop(
      api,
      tenant,
      trip.tripId,
      trip.revisionNumber,
      stopBody(1, 'start-location'),
    );
    const destination = await addStop(
      api,
      tenant,
      trip.tripId,
      origin.revisionNumber,
      stopBody(2, 'final-consignee'),
    );

    const calculationResponse = await api.inject({
      method: 'POST',
      url: `/api/trips/${trip.tripId}/calculate`,
      headers: headers(tenant, `calculation-${randomUUID()}`),
      payload: {
        expectedRevisionNumber: destination.revisionNumber,
        simulation: simulation(origin.stopId, destination.stopId),
      },
    });
    expect(calculationResponse.statusCode).toBe(201);
    const calculationBody = responseObject(calculationResponse);
    expect(nestedObject(calculationBody.calculation, 'calculation')).toHaveProperty(
      'expected',
    );

    const timelineResponse = await api.inject({
      method: 'GET',
      url: `/api/trips/${trip.tripId}/timeline`,
      headers: headers(tenant),
    });
    expect(timelineResponse.statusCode).toBe(200);
    const timeline = responseObject(timelineResponse);
    expect(timeline.status).toBe('COMPLETE');
    expect(Array.isArray(timeline.timeline)).toBe(true);
    expect(timeline.timeline).not.toHaveLength(0);

    const complianceResponse = await api.inject({
      method: 'GET',
      url: `/api/trips/${trip.tripId}/compliance`,
      headers: headers(tenant),
    });
    expect(complianceResponse.statusCode).toBe(200);
    expect(responseObject(complianceResponse).calculationStatus).toBe(
      'available',
    );
  });

  it('returns a structured 422 when a licensed provider marks a segment prohibited', async () => {
    const tenant = await seedTenant('prohibited-route');
    const licensedApi = serverWithRuntime(
      createCommercialRoutingRuntime({
        provider: prohibitedProvider(),
        license,
      }),
    );
    try {
      const response = await licensedApi.inject({
        method: 'POST',
        url: '/api/routes/validate',
        headers: headers(tenant),
        payload: routeRequest(),
      });
      expect(response.statusCode).toBe(422);
      const body = responseObject(response);
      const blocking = nestedObject(body.blocking, 'blocking');
      expect(blocking.code).toBe('LEGAL_BLOCKING_FINDING');
      expect(blocking.reasons).toContain(
        'At least one route segment is explicitly prohibited.',
      );
    } finally {
      await licensedApi.close();
    }
  });
});
