import { randomUUID } from 'node:crypto';

import { createPersistenceClient, databaseUrlFromEnvironment } from '@trip-route-calc/persistence';
import type { PersistenceClient, TenantContext } from '@trip-route-calc/persistence';
import { createCommercialRoutingRuntime } from '@trip-route-calc/routing';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  FixedWindowRateLimiter,
  HmacBearerAuthenticator,
  PublicIdCodec,
  Stage17ApplicationService,
  createStage17Api,
} from '../src/index.js';

const secret = 'stage-17-integration-secret-with-at-least-thirty-two-characters';
const responseObjectSchema = z.record(z.unknown());

let client: PersistenceClient;
let api: FastifyInstance;
let authenticator: HmacBearerAuthenticator;

interface SeededTenant extends TenantContext {
  readonly token: string;
}

function responseObject(response: LightMyRequestResponse): Record<string, unknown> {
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

function headers(tenant: SeededTenant, key?: string): Record<string, string> {
  return {
    authorization: `Bearer ${tenant.token}`,
    ...(key === undefined ? {} : { 'idempotency-key': key }),
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
      homeTerminalTimeZone: 'America/Los_Angeles',
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
      tokenId: `stage17-${suffix}`,
      issuedAt: now - 60,
      expiresAt: now + 3_600,
    }),
  };
}

async function createDriver(
  tenant: SeededTenant,
  label: string,
): Promise<string> {
  const response = await api.inject({
    method: 'POST',
    url: '/api/drivers',
    headers: headers(tenant, `driver-${label}-${randomUUID()}`),
    payload: { displayName: `${label} Driver` },
  });
  expect(response.statusCode).toBe(201);
  return requiredString(responseObject(response).driverId, 'driverId');
}

async function createTrip(
  tenant: SeededTenant,
  driverId: string,
): Promise<{ readonly tripId: string; readonly revisionNumber: number }> {
  const response = await api.inject({
    method: 'POST',
    url: '/api/trips',
    headers: headers(tenant, `trip-${randomUUID()}`),
    payload: { driverId, ruleSetVersion: 'test-rules-v1' },
  });
  expect(response.statusCode).toBe(201);
  const body = responseObject(response);
  const current = nestedObject(body.currentRevision, 'currentRevision');
  return {
    tripId: requiredString(body.tripId, 'tripId'),
    revisionNumber: requiredNumber(current.revisionNumber, 'revisionNumber'),
  };
}

function stop(
  sequence: number,
  type: 'start-location' | 'final-consignee',
  lockedPosition: boolean,
): Record<string, unknown> {
  return {
    sequence,
    type,
    required: true,
    lockedPosition,
    location: {
      description: `${type} ${String(sequence)}`,
      timeZone: 'America/Los_Angeles',
      resolutionStatus: 'user-confirmed',
    },
    appointment: { mode: 'none' },
    facilityHours: { windows: [] },
    checkInDuration: { value: 0, unit: 'minute' },
    serviceDuration: {
      mode: 'exact',
      duration: { value: 30, unit: 'minute' },
    },
    waitingDutyStatus: 'OFF_DUTY',
    checkInDutyStatus: 'ON_DUTY_NOT_DRIVING',
    serviceDutyStatus: 'ON_DUTY_NOT_DRIVING',
    earlyParkingAllowed: true,
    overnightParkingAllowed: true,
  };
}

beforeAll(() => {
  client = createPersistenceClient(databaseUrlFromEnvironment());
  authenticator = new HmacBearerAuthenticator(secret);
  const publicIds = new PublicIdCodec(secret);
  api = createStage17Api({
    application: new Stage17ApplicationService({
      client,
      publicIds,
      routingRuntime: createCommercialRoutingRuntime({}),
      now: (): Date => new Date('2026-07-21T17:00:00.000Z'),
    }),
    authenticator,
    rateLimiter: new FixedWindowRateLimiter({
      limit: 1_000,
      windowMilliseconds: 60_000,
    }),
  });
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await api.close();
  await client.$disconnect();
});

describe('Stage 17 Fastify API', () => {
  it('publishes OpenAPI publicly and requires authentication for API routes', async () => {
    const openapi = await api.inject({ method: 'GET', url: '/openapi.json' });
    expect(openapi.statusCode).toBe(200);
    expect(responseObject(openapi).openapi).toBe('3.1.0');

    const unauthorized = await api.inject({
      method: 'GET',
      url: '/api/trips/not-a-trip',
    });
    expect(unauthorized.statusCode).toBe(401);
    expect(
      nestedObject(responseObject(unauthorized).error, 'error').code,
    ).toBe('AUTHENTICATION_REQUIRED');
  });

  it('replays idempotent driver creation and rejects key reuse with different input', async () => {
    const tenant = await seedTenant('idempotency');
    const key = `driver-key-${randomUUID()}`;
    const request = {
      method: 'POST' as const,
      url: '/api/drivers',
      headers: headers(tenant, key),
      payload: { displayName: 'Repeat Driver' },
    };

    const first = await api.inject(request);
    const replay = await api.inject(request);
    expect(first.statusCode).toBe(201);
    expect(replay.statusCode).toBe(201);
    expect(responseObject(replay)).toEqual(responseObject(first));

    const mismatch = await api.inject({
      ...request,
      payload: { displayName: 'Different Driver' },
    });
    expect(mismatch.statusCode).toBe(409);
    expect(nestedObject(responseObject(mismatch).error, 'error').code).toBe(
      'IDEMPOTENCY_CONFLICT',
    );
  });

  it('creates a trip and hides it from another carrier account', async () => {
    const owner = await seedTenant('owner');
    const outsider = await seedTenant('outsider');
    const trip = await createTrip(owner, await createDriver(owner, 'Owner'));

    const owned = await api.inject({
      method: 'GET',
      url: `/api/trips/${trip.tripId}`,
      headers: headers(owner),
    });
    expect(owned.statusCode).toBe(200);

    const crossAccount = await api.inject({
      method: 'GET',
      url: `/api/trips/${trip.tripId}`,
      headers: headers(outsider),
    });
    expect(crossAccount.statusCode).toBe(404);
    expect(
      nestedObject(responseObject(crossAccount).error, 'error').code,
    ).toBe('RESOURCE_NOT_FOUND');
  });

  it('creates immutable stop revisions, rejects stale writes, and protects locked order', async () => {
    const tenant = await seedTenant('stops');
    const trip = await createTrip(
      tenant,
      await createDriver(tenant, 'Stops'),
    );

    const firstStopResponse = await api.inject({
      method: 'POST',
      url: `/api/trips/${trip.tripId}/stops`,
      headers: headers(tenant, `first-stop-${randomUUID()}`),
      payload: {
        expectedRevisionNumber: trip.revisionNumber,
        stop: stop(1, 'start-location', true),
      },
    });
    expect(firstStopResponse.statusCode).toBe(201);
    const firstStopBody = responseObject(firstStopResponse);
    const firstStopId = requiredString(
      nestedObject(firstStopBody.stop, 'stop').id,
      'first stop id',
    );
    const firstTrip = nestedObject(firstStopBody.trip, 'trip');
    const firstRevision = requiredNumber(
      nestedObject(firstTrip.currentRevision, 'currentRevision').revisionNumber,
      'first revision number',
    );

    const secondStopResponse = await api.inject({
      method: 'POST',
      url: `/api/trips/${trip.tripId}/stops`,
      headers: headers(tenant, `second-stop-${randomUUID()}`),
      payload: {
        expectedRevisionNumber: firstRevision,
        stop: stop(2, 'final-consignee', false),
      },
    });
    expect(secondStopResponse.statusCode).toBe(201);
    const secondStopBody = responseObject(secondStopResponse);
    const secondStopId = requiredString(
      nestedObject(secondStopBody.stop, 'stop').id,
      'second stop id',
    );
    const secondTrip = nestedObject(secondStopBody.trip, 'trip');
    const secondRevision = requiredNumber(
      nestedObject(secondTrip.currentRevision, 'currentRevision').revisionNumber,
      'second revision number',
    );

    const stale = await api.inject({
      method: 'POST',
      url: `/api/trips/${trip.tripId}/stops`,
      headers: headers(tenant, `stale-stop-${randomUUID()}`),
      payload: {
        expectedRevisionNumber: firstRevision,
        stop: stop(3, 'final-consignee', false),
      },
    });
    expect(stale.statusCode).toBe(409);
    expect(nestedObject(responseObject(stale).error, 'error').code).toBe(
      'REVISION_CONFLICT',
    );

    const lockedReorder = await api.inject({
      method: 'POST',
      url: `/api/trips/${trip.tripId}/stops/reorder`,
      headers: headers(tenant, `reorder-${randomUUID()}`),
      payload: {
        expectedRevisionNumber: secondRevision,
        stopIds: [secondStopId, firstStopId],
      },
    });
    expect(lockedReorder.statusCode).toBe(409);

    const revisions = await api.inject({
      method: 'GET',
      url: `/api/trips/${trip.tripId}/revisions?limit=10`,
      headers: headers(tenant),
    });
    expect(revisions.statusCode).toBe(200);
    expect(responseObject(revisions).revisions).toHaveLength(3);
  });

  it('rejects ambiguous equipment input and exposes missing routing setup as 503', async () => {
    const tenant = await seedTenant('boundaries');

    const equipment = await api.inject({
      method: 'POST',
      url: '/api/equipment/tractors',
      headers: headers(tenant, `tractor-${randomUUID()}`),
      payload: { unitNumber: 'T-100', height: 13 },
    });
    expect(equipment.statusCode).toBe(400);
    expect(nestedObject(responseObject(equipment).error, 'error').code).toBe(
      'VALIDATION_FAILED',
    );

    const route = await api.inject({
      method: 'POST',
      url: '/api/routes/validate',
      headers: headers(tenant),
      payload: {},
    });
    expect(route.statusCode).toBe(503);
    const routeError = nestedObject(responseObject(route).error, 'error');
    expect(routeError.code).toBe('PROVIDER_UNAVAILABLE');
    expect(nestedObject(routeError.details, 'details').code).toBe(
      'PROVIDER_NOT_SELECTED',
    );
  });
});
