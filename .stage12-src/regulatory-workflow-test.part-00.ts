import { randomUUID } from 'node:crypto';

import {
  durationInMinutes,
  ianaTimeZone,
  lengthInFeet,
  utcInstant,
  validateJurisdictionRule,
  validateRegulatoryComplianceResult,
  validateRegulatoryRuleSet,
} from '@trip-route-calc/foundation';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  RegulatoryRuleRepository,
  TenantObjectNotFoundError,
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
  'regulatory_rule_changes',
  'trip_revision_rules',
  'jurisdiction_rules',
  'regulatory_rule_sets',
  'compliance_warnings',
  'trip_stops',
  'trips',
  'trip_revisions',
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

const source = {
  authorityType: 'state-dot' as const,
  authorityName: 'Test-only official authority',
  title: 'Test-only official regulatory fixture',
  reference: 'fixture://official/regulatory-workflow',
  retrievedAt: utcInstant('2026-07-20T00:00:00Z'),
  version: 'fixture-1',
  lastVerifiedAt: utcInstant('2026-07-20T00:00:00Z'),
};

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
