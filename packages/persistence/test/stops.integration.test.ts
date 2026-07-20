import { randomUUID } from 'node:crypto';

import {
  durationInMinutes,
  ianaTimeZone,
  localDateTime,
  utcInstant,
} from '@trip-route-calc/foundation';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  TenantObjectNotFoundError,
  TripRevisionRepository,
  createPersistenceClient,
  databaseUrlFromEnvironment,
} from '../src/index.js';
import type {
  CreateTripRevisionInput,
  CreateTripStopDetailsInput,
  PersistenceClient,
  TenantContext,
} from '../src/index.js';

interface SeededTenant {
  readonly context: TenantContext;
  readonly tripId: string;
}

let client: PersistenceClient;

async function resetDatabase(): Promise<void> {
  await client.$executeRawUnsafe(
    'TRUNCATE TABLE "audit_events", "trip_stops", "trip_revisions", "trips", "carrier_memberships", "carriers", "users" CASCADE',
  );
}

async function seedTenant(label: string): Promise<SeededTenant> {
  const suffix = randomUUID();
  const user = await client.user.create({
    data: { email: `${label}-${suffix}@example.test`, displayName: `${label} user` },
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

function details(
  description: string,
  appointmentMode: 'none' | 'window' = 'none',
): CreateTripStopDetailsInput {
  const timeZone = ianaTimeZone('America/Los_Angeles');
  return {
    lockedPosition: false,
    location: {
      description,
      timeZone,
      addressText: '100 Stage Ten Way',
      latitude: 47.6588,
      longitude: -117.426,
      resolutionStatus: 'user-confirmed',
      sourceName: 'integration fixture',
    },
    appointment:
      appointmentMode === 'none'
        ? { mode: 'none' }
        : {
            mode: 'window',
            window: {
              start: {
                localDateTime: localDateTime('2026-07-21T08:00'),
                timeZone,
              },
              end: {
                localDateTime: localDateTime('2026-07-21T10:00'),
                timeZone,
              },
            },
            lateTolerance: durationInMinutes(15),
          },
    facilityHours: {
      windows: [
        {
          start: {
            localDateTime: localDateTime('2026-07-21T07:00'),
            timeZone,
          },
          end: {
            localDateTime: localDateTime('2026-07-21T17:00'),
            timeZone,
          },
        },
      ],
    },
    checkInDuration: durationInMinutes(10),
    serviceDuration: {
      mode: 'range',
      minimum: durationInMinutes(30),
      expected: durationInMinutes(45),
      maximum: durationInMinutes(75),
    },
    waitingDutyStatus: 'OFF_DUTY',
    checkInDutyStatus: 'ON_DUTY_NOT_DRIVING',
    serviceDutyStatus: 'ON_DUTY_NOT_DRIVING',
    earlyParkingAllowed: true,
    overnightParkingAllowed: false,
    notes: 'Preserve with the immutable revision.',
    instructions: 'Check in at the shipping office.',
  };
}

function revisionInput(
  tripId: string,
  marker: string,
): CreateTripRevisionInput {
  const timeZone = ianaTimeZone('America/Los_Angeles');
  return {
    tripId,
    calculationTimestamp: utcInstant('2026-07-20T20:00:00.000Z'),
    ruleSetVersion: `stage-10-${marker}`,
    inputSnapshot: { marker, legalRouteVerified: false },
    stops: [
      {
        sequence: 2,
        type: 'final-consignee',
        required: true,
        timeZone,
        expectedServiceDuration: durationInMinutes(45),
        details: details('Final consignee'),
      },
      {
        sequence: 1,
        type: 'shipper',
        required: true,
        timeZone,
        expectedServiceDuration: durationInMinutes(45),
        appointmentWindow: {
          start: {
            localDateTime: localDateTime('2026-07-21T08:00'),
            timeZone,
          },
          end: {
            localDateTime: localDateTime('2026-07-21T10:00'),
            timeZone,
          },
        },
        details: details('Origin shipper', 'window'),
      },
    ],
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

describe('Stage 10 stop detail persistence', () => {
  it('persists ordered stop configuration inside an immutable trip revision', async () => {
    const tenant = await seedTenant('stop-details');
    const repository = new TripRevisionRepository(client, tenant.context);

    const first = await repository.createRevision(
      revisionInput(tenant.tripId, 'first'),
    );
    const secondInput = revisionInput(tenant.tripId, 'second');
    const second = await repository.createRevision({
      ...secondInput,
      stops: [...secondInput.stops].reverse().map((stop, index) => ({
        ...stop,
        sequence: index + 1,
      })),
    });

    expect(first.stops.map((stop) => stop.sequence)).toEqual([1, 2]);
    expect(first.stops[0]?.details?.appointmentMode).toBe('window');
    expect(first.stops[0]?.details?.serviceExpectedDurationValue).toBe(45n);
    expect(first.stops[0]?.details?.locationDescription).toBe('Origin shipper');
    expect(first.stops[0]?.details?.waitingDutyStatus).toBe('OFF_DUTY');
    expect(second.revisionNumber).toBe(2);
    await expect(repository.getRevision(first.id)).resolves.not.toBeNull();
    await expect(
      client.tripStopDetails.count({ where: { carrierId: tenant.context.carrierId } }),
    ).resolves.toBe(4);
  });

  it('rejects details that contradict the base stop duration before opening a transaction', async () => {
    const tenant = await seedTenant('duration-mismatch');
    const repository = new TripRevisionRepository(client, tenant.context);
    const input = revisionInput(tenant.tripId, 'invalid');
    const first = input.stops[0];
    if (first === undefined) throw new Error('Expected fixture stop.');

    await expect(
      repository.createRevision({
        ...input,
        stops: [
          {
            ...first,
            expectedServiceDuration: durationInMinutes(30),
          },
        ],
      }),
    ).rejects.toThrow(/expected service duration/iu);
    await expect(client.tripRevision.count()).resolves.toBe(0);
    await expect(client.tripStopDetails.count()).resolves.toBe(0);
  });

  it('does not expose another carrier stop revision', async () => {
    const tenantA = await seedTenant('tenant-a');
    const tenantB = await seedTenant('tenant-b');
    const repositoryA = new TripRevisionRepository(client, tenantA.context);
    const repositoryB = new TripRevisionRepository(client, tenantB.context);
    const revision = await repositoryA.createRevision(
      revisionInput(tenantA.tripId, 'tenant-a'),
    );

    await expect(repositoryB.getRevision(revision.id)).resolves.toBeNull();
    await expect(
      repositoryB.createRevision(revisionInput(tenantA.tripId, 'foreign')),
    ).rejects.toBeInstanceOf(TenantObjectNotFoundError);
  });
});
