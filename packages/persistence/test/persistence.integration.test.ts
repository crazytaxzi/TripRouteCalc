import { randomUUID } from 'node:crypto';

import {
  durationInMinutes,
  ianaTimeZone,
  localDateTime,
  utcInstant,
} from '@trip-route-calc/foundation';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  ProviderEvidenceError,
  RegulatoryRuleRepository,
  RouteProviderResponseRepository,
  TenantObjectNotFoundError,
  TripRevisionRepository,
  createPersistenceClient,
  databaseUrlFromEnvironment,
} from '../src/index.js';
import type { PersistenceClient, TenantContext } from '../src/index.js';

const TABLES_IN_DELETE_ORDER = [
  'audit_events',
  'export_history',
  'regulatory_rule_changes',
  'trip_revision_rules',
  'jurisdiction_rules',
  'regulatory_rule_sets',
  'route_provider_responses',
  'calculation_results',
  'user_overrides',
  'calculation_assumptions',
  'warning_acknowledgements',
  'compliance_warnings',
  'planned_events',
  'permits',
  'route_restrictions',
  'route_segments',
  'route_legs',
  'routes',
  'appointment_windows',
  'trip_stops',
  'trips',
  'trip_revisions',
  'facility_service_observations',
  'facility_service_profiles',
  'facilities',
  'loads',
  'trailers',
  'tractors',
  'driver_duty_events',
  'driver_hos_states',
  'drivers',
  'carrier_memberships',
  'carriers',
  'users',
] as const;

interface SeededTenant {
  readonly context: TenantContext;
  readonly tripId: string;
}

let client: PersistenceClient;

async function resetDatabase(): Promise<void> {
  const quotedTables = TABLES_IN_DELETE_ORDER.map((table) => `"${table}"`).join(
    ', ',
  );
  await client.$executeRawUnsafe(`TRUNCATE TABLE ${quotedTables} CASCADE`);
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
  const driver = await client.driver.create({
    data: {
      carrierId: carrier.id,
      displayName: `${label} driver`,
    },
  });
  const trip = await client.trip.create({
    data: {
      carrierId: carrier.id,
      driverId: driver.id,
    },
  });

  return {
    context: { carrierId: carrier.id, actorUserId: user.id },
    tripId: trip.id,
  };
}

function revisionInput(tripId: string, marker: string) {
  return {
    tripId,
    calculationTimestamp: utcInstant('2026-07-19T20:00:00Z'),
    ruleSetVersion: `federal-${marker}`,
    inputSnapshot: { marker, source: 'integration-test' },
    stops: [
      {
        sequence: 20,
        type: 'final-consignee' as const,
        required: true,
        timeZone: ianaTimeZone('America/Chicago'),
        expectedServiceDuration: durationInMinutes(90),
      },
      {
        sequence: 10,
        type: 'shipper' as const,
        required: true,
        timeZone: ianaTimeZone('America/Los_Angeles'),
        expectedServiceDuration: durationInMinutes(60),
        appointmentWindow: {
          start: {
            localDateTime: localDateTime('2026-07-20T08:00'),
            timeZone: ianaTimeZone('America/Los_Angeles'),
          },
          end: {
            localDateTime: localDateTime('2026-07-20T10:00'),
            timeZone: ianaTimeZone('America/Los_Angeles'),
          },
        },
      },
    ],
    assumptions: [
      {
        key: 'average-speed-policy',
        value: { milesPerHour: 50 },
        explanation: 'Carrier planning policy supplied for the test.',
        source: 'carrier-policy' as const,
      },
    ],
    warnings: [
      {
        severity: 'information' as const,
        code: `TEST-${marker}`,
        explanation: 'Test warning preserved with the revision.',
      },
    ],
    overrides: [
      {
        key: 'service-duration-review',
        value: { reviewed: true },
        reason: 'Integration-test evidence.',
      },
    ],
    result: {
      confidence: 'low' as const,
      confidenceReasons: ['No commercial route provider is configured.'],
      explanation: ['This is persistence evidence, not a legal route result.'],
      snapshot: { marker, legalRouteVerified: false },
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

describe('tenant-scoped persistence', () => {
  it('does not expose another carrier trip', async () => {
    const tenantA = await seedTenant('tenant-a');
    const tenantB = await seedTenant('tenant-b');
    const repository = new TripRevisionRepository(client, tenantA.context);

    await expect(repository.getTrip(tenantB.tripId)).resolves.toBeNull();
    await expect(
      repository.createRevision(revisionInput(tenantB.tripId, 'foreign')),
    ).rejects.toBeInstanceOf(TenantObjectNotFoundError);
  });
});

describe('trip revisions', () => {
  it('preserves prior revisions and returns stops by explicit sequence', async () => {
    const tenant = await seedTenant('revision');
    const repository = new TripRevisionRepository(client, tenant.context);

    const first = await repository.createRevision(
      revisionInput(tenant.tripId, 'one'),
    );
    const second = await repository.createRevision({
      ...revisionInput(tenant.tripId, 'two'),
      stops: [revisionInput(tenant.tripId, 'two').stops[0]],
    });

    expect(first.revisionNumber).toBe(1);
    expect(first.stops.map((stop) => stop.sequence)).toEqual([10, 20]);
    expect(second.revisionNumber).toBe(2);

    const trip = await repository.getTrip(tenant.tripId);
    expect(trip?.currentRevisionId).toBe(second.id);
    await expect(
      client.tripRevision.count({ where: { tripId: tenant.tripId } }),
    ).resolves.toBe(2);
    await expect(repository.getRevision(first.id)).resolves.not.toBeNull();
  });

  it('blocks update and deletion of an auditable revision', async () => {
    const tenant = await seedTenant('immutable');
    const repository = new TripRevisionRepository(client, tenant.context);
    const revision = await repository.createRevision(
      revisionInput(tenant.tripId, 'immutable'),
    );

    await expect(
      client.tripRevision.update({
        where: { id: revision.id },
        data: { ruleSetVersion: 'rewritten' },
      }),
    ).rejects.toThrow(/append-only|immutable/iu);
    await expect(
      client.tripRevision.delete({ where: { id: revision.id } }),
    ).rejects.toThrow(/append-only|immutable/iu);
  });

  it('rolls back the entire revision when a child constraint fails', async () => {
    const tenant = await seedTenant('rollback');
    const repository = new TripRevisionRepository(client, tenant.context);
    const first = await repository.createRevision(
      revisionInput(tenant.tripId, 'baseline'),
    );
    const invalid = revisionInput(tenant.tripId, 'invalid');

    await expect(
      repository.createRevision({
        ...invalid,
        assumptions: [
          {
            key: 'duplicate-key',
            value: { index: 1 },
            explanation: 'First insert.',
            source: 'user',
          },
          {
            key: 'duplicate-key',
            value: { index: 2 },
            explanation: 'Unique constraint must reject this insert.',
            source: 'user',
          },
        ],
      }),
    ).rejects.toThrow();

    await expect(
      client.tripRevision.count({ where: { tripId: tenant.tripId } }),
    ).resolves.toBe(1);
    const trip = await repository.getTrip(tenant.tripId);
    expect(trip?.currentRevisionId).toBe(first.id);
  });
});

describe('provider and regulatory evidence', () => {
  it('refuses raw provider payloads when retention is not licensed', async () => {
    const tenant = await seedTenant('provider');
    const tripRepository = new TripRevisionRepository(client, tenant.context);
    const revision = await tripRepository.createRevision(
      revisionInput(tenant.tripId, 'provider'),
    );
    const providerRepository = new RouteProviderResponseRepository(
      client,
      tenant.context,
    );

    await expect(
      providerRepository.save({
        tripRevisionId: revision.id,
        providerName: 'unconfigured-test-provider',
        receivedAt: utcInstant('2026-07-19T21:00:00Z'),
        storageMode: 'raw-json',
        licenseAllowsRawStorage: false,
        rawResponse: { secretLikePayload: 'must-not-be-stored' },
      }),
    ).rejects.toBeInstanceOf(ProviderEvidenceError);
    await expect(client.routeProviderResponse.count()).resolves.toBe(0);
  });

  it('records rule-set versions and status change history', async () => {
    const tenant = await seedTenant('rules');
    const repository = new RegulatoryRuleRepository(client, tenant.context);
    const ruleSet = await repository.createRuleSet({
      name: 'federal-property-carrying',
      version: '2026-07-19-test',
      effectiveFrom: utcInstant('2026-07-19T00:00:00Z'),
      sourceTitle: 'Integration-test authority fixture',
      sourceReference: 'fixture://official-source-placeholder-not-production',
      sourceMetadata: { fixture: true },
      lastVerifiedAt: utcInstant('2026-07-19T00:00:00Z'),
      reason: 'Create versioned persistence evidence.',
      rules: [
        {
          jurisdictionCode: 'US',
          ruleType: 'test-only-shape',
          version: '1',
          effectiveFrom: utcInstant('2026-07-19T00:00:00Z'),
          sourceTitle: 'Integration-test authority fixture',
          sourceReference: 'fixture://official-source-placeholder-not-production',
          sourceMetadata: { fixture: true },
          lastVerifiedAt: utcInstant('2026-07-19T00:00:00Z'),
          active: true,
          ruleDefinition: { testOnly: true },
        },
      ],
    });

    const active = await repository.setRuleSetStatus(
      ruleSet.id,
      'active',
      'Administrative review completed for the fixture.',
    );

    expect(active.status).toBe('active');
    await expect(
      client.regulatoryRuleChange.count({ where: { ruleSetId: ruleSet.id } }),
    ).resolves.toBe(2);
  });
});
