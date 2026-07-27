import { randomUUID } from 'node:crypto';

import {
  createPersistenceClient,
  databaseUrlFromEnvironment,
} from '@trip-route-calc/persistence';
import type {
  PersistenceClient,
  TenantContext,
} from '@trip-route-calc/persistence';
import { createCommercialRoutingRuntime } from '@trip-route-calc/routing';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  FixedWindowRateLimiter,
  HmacBearerAuthenticator,
  PublicIdCodec,
  Stage17ApplicationService,
  Stage18ProfileService,
  createStage18Api,
} from '../src/index.js';

const secret = 'stage-18-profile-secret-with-at-least-thirty-two-characters';
const objectSchema = z.record(z.unknown());
const objectArraySchema = z.array(objectSchema);

let client: PersistenceClient;
let api: FastifyInstance;
let authenticator: HmacBearerAuthenticator;

interface SeededTenant extends TenantContext {
  readonly token: string;
}

function body(response: LightMyRequestResponse): Record<string, unknown> {
  return objectSchema.parse(response.json());
}

function nested(value: unknown, label: string): Record<string, unknown> {
  const result = objectSchema.safeParse(value);
  if (!result.success) throw new Error(`${label} was not an object.`);
  return result.data;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} was not a non-empty string.`);
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
  await client.$executeRawUnsafe('TRUNCATE TABLE "carriers", "users" CASCADE');
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
    data: { carrierId: carrier.id, userId: user.id, role: 'OWNER' },
  });
  const now = Math.floor(Date.now() / 1_000);
  return {
    carrierId: carrier.id,
    actorUserId: user.id,
    token: authenticator.issue({
      version: 1,
      carrierId: carrier.id,
      actorUserId: user.id,
      tokenId: `stage18-${suffix}`,
      issuedAt: now - 60,
      expiresAt: now + 3_600,
    }),
  };
}

function tractorProfile(unitNumber: string): Readonly<Record<string, unknown>> {
  return {
    unitNumber,
    tractorType: 'sleeper',
    axleCount: 3,
    hazmatEquipped: false,
    californiaCompliance: { status: 'not-evaluated' },
    idleAuxiliaryPower: {
      idleAllowed: false,
      auxiliaryPowerUnitAvailable: true,
    },
    fieldEvidence: [],
    extensionMetadata: {},
  };
}

beforeAll(() => {
  client = createPersistenceClient(databaseUrlFromEnvironment());
  authenticator = new HmacBearerAuthenticator(secret);
  const publicIds = new PublicIdCodec(secret);
  api = createStage18Api({
    application: new Stage17ApplicationService({
      client,
      publicIds,
      routingRuntime: createCommercialRoutingRuntime({}),
    }),
    profiles: new Stage18ProfileService({ client, publicIds }),
    planning: {
      planTrip: (): Promise<never> =>
        Promise.reject(new Error('Planning is not exercised by profile tests.')),
    },
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

describe('Stage 18 reusable profile API', () => {
  it('lists and edits drivers and equipment within the authenticated carrier', async () => {
    const owner = await seedTenant('profile-owner');
    const outsider = await seedTenant('profile-outsider');

    const createdDriver = await api.inject({
      method: 'POST',
      url: '/api/drivers',
      headers: headers(owner, `driver-create-${randomUUID()}`),
      payload: { displayName: 'Original Driver' },
    });
    expect(createdDriver.statusCode).toBe(201);
    const driverId = requiredString(body(createdDriver).driverId, 'driverId');

    const listedDrivers = await api.inject({
      method: 'GET',
      url: '/api/drivers',
      headers: headers(owner),
    });
    expect(listedDrivers.statusCode).toBe(200);
    const driverRows = objectArraySchema.parse(body(listedDrivers).drivers);
    expect(driverRows).toHaveLength(1);
    expect(driverRows[0]?.displayName).toBe('Original Driver');

    const updatedDriver = await api.inject({
      method: 'PATCH',
      url: `/api/drivers/${driverId}`,
      headers: headers(owner, `driver-update-${randomUUID()}`),
      payload: { displayName: 'Updated Driver' },
    });
    expect(updatedDriver.statusCode).toBe(200);
    expect(body(updatedDriver).displayName).toBe('Updated Driver');

    const createdTractor = await api.inject({
      method: 'POST',
      url: '/api/equipment/tractors',
      headers: headers(owner, `tractor-create-${randomUUID()}`),
      payload: tractorProfile('TR-180'),
    });
    expect(createdTractor.statusCode).toBe(201);
    const tractorId = requiredString(
      body(createdTractor).tractorId,
      'tractorId',
    );

    const listedTractors = await api.inject({
      method: 'GET',
      url: '/api/equipment/tractors',
      headers: headers(owner),
    });
    expect(listedTractors.statusCode).toBe(200);
    const tractorRows = objectArraySchema.parse(body(listedTractors).tractors);
    expect(tractorRows).toHaveLength(1);
    expect(nested(tractorRows[0]?.profile, 'tractor profile').unitNumber).toBe(
      'TR-180',
    );

    const updatedTractor = await api.inject({
      method: 'PATCH',
      url: `/api/equipment/tractors/${tractorId}`,
      headers: headers(owner, `tractor-update-${randomUUID()}`),
      payload: tractorProfile('TR-181'),
    });
    expect(updatedTractor.statusCode).toBe(200);
    expect(nested(body(updatedTractor).profile, 'updated profile').unitNumber).toBe(
      'TR-181',
    );

    const outsiderList = await api.inject({
      method: 'GET',
      url: '/api/equipment/tractors',
      headers: headers(outsider),
    });
    expect(outsiderList.statusCode).toBe(200);
    expect(body(outsiderList).tractors).toHaveLength(0);

    const outsiderUpdate = await api.inject({
      method: 'PATCH',
      url: `/api/equipment/tractors/${tractorId}`,
      headers: headers(outsider, `cross-account-${randomUUID()}`),
      payload: tractorProfile('NOPE'),
    });
    expect(outsiderUpdate.statusCode).toBe(404);
  });

  it('replays identical equipment updates and rejects key reuse with a different body', async () => {
    const owner = await seedTenant('profile-idempotency');
    const created = await api.inject({
      method: 'POST',
      url: '/api/equipment/tractors',
      headers: headers(owner, `tractor-create-${randomUUID()}`),
      payload: tractorProfile('TR-200'),
    });
    const tractorId = requiredString(body(created).tractorId, 'tractorId');
    const key = `tractor-update-${randomUUID()}`;

    const first = await api.inject({
      method: 'PATCH',
      url: `/api/equipment/tractors/${tractorId}`,
      headers: headers(owner, key),
      payload: tractorProfile('TR-201'),
    });
    const replay = await api.inject({
      method: 'PATCH',
      url: `/api/equipment/tractors/${tractorId}`,
      headers: headers(owner, key),
      payload: tractorProfile('TR-201'),
    });
    const conflict = await api.inject({
      method: 'PATCH',
      url: `/api/equipment/tractors/${tractorId}`,
      headers: headers(owner, key),
      payload: tractorProfile('TR-202'),
    });

    expect(first.statusCode).toBe(200);
    expect(replay.statusCode).toBe(200);
    expect(replay.body).toBe(first.body);
    expect(conflict.statusCode).toBe(409);
  });
});
