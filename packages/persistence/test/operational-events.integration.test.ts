import { randomUUID } from 'node:crypto';

import {
  distanceInMiles,
  durationInMinutes,
  ianaTimeZone,
  operationalPlanSnapshot,
  utcInstant,
  validateOperationalEventPlan,
} from '@trip-route-calc/foundation';
import type { OperationalEventPlan } from '@trip-route-calc/foundation';
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

function fuelEvent(): OperationalEventPlan {
  return validateOperationalEventPlan({
    eventId: 'fuel-event-1',
    type: 'FUEL',
    duration: { mode: 'EXACT', duration: durationInMinutes(35) },
    dutyStatus: 'ON_DUTY_NOT_DRIVING',
    source: {
      type: 'USER_OVERRIDE',
      sourceName: 'Test-only dispatcher override',
      observedAt: utcInstant('2026-07-20T01:00:00Z'),
      explanation: 'User selected a longer fuel-service duration.',
    },
    location: {
      locationId: 'fuel-location-1',
      description: 'Test-only verified truck stop',
      timeZone: ianaTimeZone('America/Los_Angeles'),
      routeDistance: distanceInMiles(250),
      truckCompatible: true,
      capabilities: ['FUEL', 'PARKING', 'MEAL'],
      source: {
        type: 'VERIFIED_LOCATION_PROVIDER',
        sourceName: 'Test-only truck location provider',
        reference: 'fixture://truck-locations/fuel-location-1',
        verifiedAt: utcInstant('2026-07-20T00:00:00Z'),
        explanation: 'Test-only location capability evidence.',
      },
    },
    placement: {
      kind: 'AT_ROUTE_DISTANCE',
      routeDistance: distanceInMiles(250),
      requiredCapability: 'FUEL',
    },
    planningBuffer: {
      duration: durationInMinutes(10),
      source: {
        type: 'CARRIER_POLICY',
        sourceName: 'Test-only carrier fuel buffer',
        explanation: 'Adds checkout variability outside legal requirements.',
      },
      explanation: 'Test-only operational planning buffer.',
      legalRequirement: false,
    },
    allowThirtyMinuteInterruptionOverlap: true,
    allowRestOverlap: false,
    required: true,
    userOverride: true,
    explanation: 'Fueling remains on duty and explicit in the timeline.',
  });
}

function revisionInput(tripId: string): CreateTripRevisionInput {
  const event = fuelEvent();
  return {
    tripId,
    calculationTimestamp: utcInstant('2026-07-20T01:00:00Z'),
    ruleSetVersion: 'rules-v1',
    inputSnapshot: operationalPlanSnapshot([event]),
    stops: [
      {
        sequence: 10,
        type: 'fuel',
        required: true,
        timeZone: 'America/Los_Angeles',
        expectedServiceDuration: durationInMinutes(35),
      },
    ],
    overrides: [
      {
        key: 'operational-event.fuel-event-1.duration',
        value: {
          duration: event.duration,
          source: event.source,
          planningBuffer: event.planningBuffer,
        },
        reason: 'Dispatcher confirmed a 35-minute fuel event plus a separate buffer.',
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

describe('operational event revision persistence', () => {
  it('preserves event source evidence, explicit buffer, and user override', async () => {
    const tenant = await seedTenant('operational');
    const repository = new TripRevisionRepository(client, tenant.context);
    const created = await repository.createRevision(revisionInput(tenant.tripId));
    const stored = await repository.getRevision(created.id);

    expect(stored?.inputSnapshot).toMatchObject({
      operationalEvents: [
        {
          eventId: 'fuel-event-1',
          type: 'FUEL',
          dutyStatus: 'ON_DUTY_NOT_DRIVING',
          userOverride: true,
          source: {
            type: 'USER_OVERRIDE',
            sourceName: 'Test-only dispatcher override',
          },
          location: {
            source: {
              type: 'VERIFIED_LOCATION_PROVIDER',
              reference: 'fixture://truck-locations/fuel-location-1',
            },
          },
          planningBuffer: {
            legalRequirement: false,
            duration: durationInMinutes(10),
          },
        },
      ],
    });
    expect(stored?.overrides).toHaveLength(1);
    expect(stored?.overrides[0]).toMatchObject({
      key: 'operational-event.fuel-event-1.duration',
      reason:
        'Dispatcher confirmed a 35-minute fuel event plus a separate buffer.',
      value: {
        duration: { mode: 'EXACT', duration: durationInMinutes(35) },
        source: { type: 'USER_OVERRIDE' },
        planningBuffer: { legalRequirement: false },
      },
    });
  });

  it('does not expose another carrier revision', async () => {
    const tenantA = await seedTenant('operational-a');
    const tenantB = await seedTenant('operational-b');
    const created = await new TripRevisionRepository(
      client,
      tenantB.context,
    ).createRevision(revisionInput(tenantB.tripId));

    await expect(
      new TripRevisionRepository(client, tenantA.context).getRevision(created.id),
    ).resolves.toBeNull();
  });
});
