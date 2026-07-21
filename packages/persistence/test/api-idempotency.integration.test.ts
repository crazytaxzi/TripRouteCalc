import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  ApiIdempotencyRepository,
  IdempotencyConflictError,
  createPersistenceClient,
  databaseUrlFromEnvironment,
} from '../src/index.js';
import type { PersistenceClient, TenantContext } from '../src/index.js';

let client: PersistenceClient;

async function resetDatabase(): Promise<void> {
  await client.$executeRawUnsafe(
    'TRUNCATE TABLE "api_idempotency_records", "carrier_memberships", "carriers", "users" CASCADE',
  );
}

async function seedTenant(label: string): Promise<TenantContext> {
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
  return { carrierId: carrier.id, actorUserId: user.id };
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

describe('ApiIdempotencyRepository', () => {
  it('replays a completed equivalent request without storing the raw key', async () => {
    const context = await seedTenant('replay');
    const repository = new ApiIdempotencyRepository(client, context);
    const key = 'stage-17-idempotency-key';
    const request = { tripId: 'public-trip', expectedRevision: 4 };

    const started = await repository.begin({
      operation: 'trip.calculate',
      key,
      request,
    });
    expect(started.status).toBe('started');
    if (started.status !== 'started') throw new Error('Expected a new claim.');

    await repository.complete(started.recordId, 201, {
      tripId: 'public-trip',
      revisionNumber: 5,
    });

    const replay = await repository.begin({
      operation: 'trip.calculate',
      key,
      request,
    });
    expect(replay).toMatchObject({
      status: 'replay',
      responseStatus: 201,
      response: { tripId: 'public-trip', revisionNumber: 5 },
    });

    const stored = await client.$queryRaw<
      readonly { readonly keyHash: string }[]
    >`
      SELECT key_hash AS "keyHash"
      FROM api_idempotency_records
      WHERE id = ${started.recordId}::uuid
    `;
    expect(stored[0]?.keyHash).toHaveLength(64);
    expect(stored[0]?.keyHash).not.toBe(key);
  });

  it('rejects request mismatches and concurrent equivalent claims', async () => {
    const context = await seedTenant('conflict');
    const repository = new ApiIdempotencyRepository(client, context);
    const key = 'stage-17-conflict-key';

    await repository.begin({
      operation: 'trip.reorder',
      key,
      request: { order: ['first', 'second'] },
    });

    await expect(
      repository.begin({
        operation: 'trip.reorder',
        key,
        request: { order: ['second', 'first'] },
      }),
    ).rejects.toMatchObject<Partial<IdempotencyConflictError>>({
      reason: 'REQUEST_MISMATCH',
    });

    await expect(
      repository.begin({
        operation: 'trip.reorder',
        key,
        request: { order: ['first', 'second'] },
      }),
    ).rejects.toMatchObject<Partial<IdempotencyConflictError>>({
      reason: 'IN_PROGRESS',
    });
  });

  it('scopes the same idempotency key to the authenticated carrier and actor', async () => {
    const first = new ApiIdempotencyRepository(
      client,
      await seedTenant('first'),
    );
    const second = new ApiIdempotencyRepository(
      client,
      await seedTenant('second'),
    );

    await expect(
      first.begin({
        operation: 'trip.create',
        key: 'shared-idempotency-key',
        request: { driverId: 'first' },
      }),
    ).resolves.toMatchObject({ status: 'started' });
    await expect(
      second.begin({
        operation: 'trip.create',
        key: 'shared-idempotency-key',
        request: { driverId: 'second' },
      }),
    ).resolves.toMatchObject({ status: 'started' });
  });
});
