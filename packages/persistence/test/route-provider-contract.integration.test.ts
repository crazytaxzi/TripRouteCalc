import { randomUUID } from 'node:crypto';

import {
  assessCommercialRoute,
  distanceInMiles,
  durationInMinutes,
  ianaTimeZone,
  utcInstant,
} from '@trip-route-calc/foundation';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  RouteProviderResponseRepository,
  TenantObjectNotFoundError,
  TripRevisionRepository,
  createPersistenceClient,
  databaseUrlFromEnvironment,
} from '../src/index.js';
import type { PersistenceClient, TenantContext } from '../src/index.js';

interface SeededTenant {
  readonly context: TenantContext;
  readonly tripId: string;
}

let client: PersistenceClient;

async function resetDatabase(): Promise<void> {
  await client.$executeRawUnsafe(
    'TRUNCATE TABLE "audit_events", "route_provider_responses", "routes", "appointment_windows", "trip_stop_details", "trip_stops", "trips", "trip_revisions", "drivers", "carrier_memberships", "carriers", "users" CASCADE',
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

async function createRevision(tenant: SeededTenant): Promise<string> {
  const repository = new TripRevisionRepository(client, tenant.context);
  const revision = await repository.createRevision({
    tripId: tenant.tripId,
    calculationTimestamp: utcInstant('2026-07-20T20:00:00Z'),
    ruleSetVersion: 'stage-11-test',
    inputSnapshot: { fixture: true },
    stops: [
      {
        sequence: 10,
        type: 'final-consignee',
        required: true,
        timeZone: ianaTimeZone('America/Los_Angeles'),
        expectedServiceDuration: durationInMinutes(30),
      },
    ],
  });
  return revision.id;
}

function routeResult() {
  const geometry = {
    format: 'geojson-line-string' as const,
    coordinates: [
      [-117, 46.4],
      [-116.9, 46.4],
    ] as [number, number][],
  };
  return assessCommercialRoute({
    routeId: 'route-stage-11',
    routeKind: 'commercial-vehicle',
    provider: {
      providerName: 'test-only-provider',
      providerVersion: 'fixture-1',
      providerRequestId: 'provider-request-1',
      requestedAt: utcInstant('2026-07-20T20:00:00Z'),
      respondedAt: utcInstant('2026-07-20T20:00:01Z'),
      confidence: 'medium',
    },
    totalDistance: distanceInMiles(10),
    travelDuration: durationInMinutes(15),
    geometry,
    legs: [
      {
        legId: 'leg-1',
        sequence: 1,
        originReferenceId: 'origin',
        destinationStopId: 'destination',
        distance: distanceInMiles(10),
        travelDuration: durationInMinutes(15),
        geometry,
        segments: [
          {
            segmentId: 'segment-1',
            sequence: 1,
            distance: distanceInMiles(10),
            travelDuration: durationInMinutes(15),
            geometry,
            verificationStatus: 'verified',
            jurisdictionCodes: ['US-WA'],
            restrictions: [],
            unavailableFields: [
              {
                path: 'segments[0].terminalAccess',
                reason:
                  'The test fixture does not include terminal-access confirmation.',
                impact: 'lowers-confidence',
              },
            ],
          },
        ],
        unavailableFields: [],
      },
    ],
    restrictions: [],
    unavailableFields: [],
  });
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

describe('normalized commercial-route provider evidence', () => {
  it('preserves provider metadata, confidence, unavailable fields, and assessment', async () => {
    const tenant = await seedTenant('provider-evidence');
    const revisionId = await createRevision(tenant);
    const repository = new RouteProviderResponseRepository(client, tenant.context);

    const saved = await repository.saveNormalizedCommercialRouteEvidence({
      tripRevisionId: revisionId,
      receivedAt: utcInstant('2026-07-20T20:00:02Z'),
      result: routeResult(),
      retention: {
        mode: 'normalized-snapshot',
        normalizedSnapshotRetentionAllowed: true,
      },
    });

    expect(saved.providerName).toBe('test-only-provider');
    expect(saved.providerVersion).toBe('fixture-1');
    expect(saved.providerRequestId).toBe('provider-request-1');
    expect(saved.storageMode).toBe('NORMALIZED_SNAPSHOT');
    expect(JSON.stringify(saved.normalizedSnapshot)).toContain('terminalAccess');
    expect(JSON.stringify(saved.normalizedSnapshot)).toContain(
      'blocked-pending-regulatory-evaluation',
    );
  });

  it('does not expose a route response to another carrier', async () => {
    const owner = await seedTenant('owner');
    const outsider = await seedTenant('outsider');
    const revisionId = await createRevision(owner);
    const repository = new RouteProviderResponseRepository(
      client,
      outsider.context,
    );

    await expect(
      repository.saveNormalizedCommercialRouteEvidence({
        tripRevisionId: revisionId,
        receivedAt: utcInstant('2026-07-20T20:00:02Z'),
        result: routeResult(),
        retention: {
          mode: 'provider-reference',
          providerReference: 'provider://route/test-only-reference',
        },
      }),
    ).rejects.toBeInstanceOf(TenantObjectNotFoundError);
  });
});
