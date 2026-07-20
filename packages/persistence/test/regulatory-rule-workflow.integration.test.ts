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
  const trip = await client.trip.create({
    data: { carrierId: carrier.id, driverId: driver.id },
  });
  return {
    context: { carrierId: carrier.id, actorUserId: user.id },
    tripId: trip.id,
  };
}

function rule(ruleId: string, maximumFeet: number) {
  return validateJurisdictionRule({
    ruleId,
    jurisdictionCode: 'US-CA',
    category: 'kpra',
    affectedVehicleTypes: ['tractor-semitrailer'],
    roadScope: { kind: 'jurisdiction-wide', jurisdictionCodes: ['US-CA'] },
    effectiveFrom: utcInstant('2026-07-01T00:00:00Z'),
    source,
    explanation: 'Test-only KPRA rule for persistence workflow coverage.',
    condition: {
      kind: 'length',
      fact: 'vehicle.trailer.kpra',
      operator: 'greater-than',
      value: lengthInFeet(maximumFeet),
    },
    requiredAction: {
      code: 'ADJUST-KPRA',
      instruction: 'Adjust and verify KPRA and axle weights.',
      mustCompleteBeforeSegment: true,
      requiredUpdatedFacts: [
        'vehicle.trailer.kpra',
        'load.drive-axle-weight',
        'load.trailer-axle-weight',
      ],
    },
    severity: 'action-required',
    blocksRouteFinalization: true,
    requiresManualVerification: false,
    active: true,
    version: '1',
  });
}

function ruleSet(version: string, maximumFeet = 40) {
  return validateRegulatoryRuleSet({
    ruleSetId: `test-rule-set-${version}`,
    name: 'test-only-commercial-compliance',
    version,
    status: 'draft',
    effectiveFrom: utcInstant('2026-07-01T00:00:00Z'),
    source: { ...source, version },
    coverage: {
      jurisdictionCodes: ['US-CA'],
      status: 'complete',
      limitations: [],
    },
    rules: [rule(`CA-KPRA-${version}`, maximumFeet)],
  });
}

function revisionInput(tripId: string): CreateTripRevisionInput {
  return {
    tripId,
    calculationTimestamp: utcInstant('2026-07-20T01:00:00Z'),
    ruleSetVersion: 'stage-12-test',
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

describe('regulatory administrative workflow', () => {
  it('creates, revises, activates, audits, and freezes an active version', async () => {
    const tenant = await seedTenant('workflow');
    const repository = new RegulatoryRuleRepository(client, tenant.context);
    const created = await repository.createValidatedRuleSet({
      ruleSet: ruleSet('v1'),
      reason: 'Initial legal-research draft.',
    });
    const revised = await repository.updateDraftRuleSet({
      ruleSetId: created.databaseId,
      ruleSet: ruleSet('v1-reviewed', 39),
      reason: 'Official-source review updated the test threshold.',
    });
    expect(revised.ruleSet.version).toBe('v1-reviewed');

    const active = await repository.setValidatedRuleSetStatus(
      created.databaseId,
      'active',
      'Administrative review completed.',
    );
    expect(active.status).toBe('active');
    await expect(
      repository.updateDraftRuleSet({
        ruleSetId: created.databaseId,
        ruleSet: ruleSet('rewrite-forbidden'),
        reason: 'Attempt to rewrite active evidence.',
      }),
    ).rejects.toThrow(/draft/iu);

    const changes = await repository.listRuleSetChanges(created.databaseId);
    expect(changes.map((change) => change.action)).toEqual([
      'created',
      'draft-revised',
      'status-changed',
    ]);
    await expect(
      client.auditEvent.count({
        where: { entityType: 'regulatory-rule-set', entityId: created.databaseId },
      }),
    ).resolves.toBe(2);
  });

  it('activates one effective version and deactivates the prior active version', async () => {
    const tenant = await seedTenant('versions');
    const repository = new RegulatoryRuleRepository(client, tenant.context);
    const first = await repository.createValidatedRuleSet({
      ruleSet: ruleSet('v1'),
      reason: 'First version.',
    });
    await repository.setValidatedRuleSetStatus(first.databaseId, 'active', 'Reviewed.');
    const second = await repository.createValidatedRuleSet({
      ruleSet: ruleSet('v2', 38),
      reason: 'Replacement version.',
    });
    await repository.setValidatedRuleSetStatus(second.databaseId, 'active', 'Reviewed.');

    expect((await repository.getValidatedRuleSet(first.databaseId))?.status).toBe(
      'inactive',
    );
    const selected = await repository.getActiveRuleSet(
      'test-only-commercial-compliance',
      utcInstant('2026-07-20T01:00:00Z'),
    );
    expect(selected?.databaseId).toBe(second.databaseId);
    expect(selected?.ruleSet.version).toBe('v2');
  });

  it('does not expose or revise another carrier rule set', async () => {
    const tenantA = await seedTenant('tenant-a');
    const tenantB = await seedTenant('tenant-b');
    const repositoryA = new RegulatoryRuleRepository(client, tenantA.context);
    const repositoryB = new RegulatoryRuleRepository(client, tenantB.context);
    const created = await repositoryB.createValidatedRuleSet({
      ruleSet: ruleSet('foreign'),
      reason: 'Foreign tenant fixture.',
    });
    await expect(repositoryA.getValidatedRuleSet(created.databaseId)).resolves.toBeNull();
    await expect(
      repositoryA.updateDraftRuleSet({
        ruleSetId: created.databaseId,
        ruleSet: ruleSet('foreign-rewrite'),
        reason: 'Cross-tenant update attempt.',
      }),
    ).rejects.toBeInstanceOf(TenantObjectNotFoundError);
  });

  it('captures rule versions, structured findings, warnings, and audit evidence for a revision', async () => {
    const tenant = await seedTenant('capture');
    const revision = await new TripRevisionRepository(
      client,
      tenant.context,
    ).createRevision(revisionInput(tenant.tripId));
    const repository = new RegulatoryRuleRepository(client, tenant.context);
    const created = await repository.createValidatedRuleSet({
      ruleSet: ruleSet('capture'),
      reason: 'Capture fixture.',
    });
    await repository.setValidatedRuleSetStatus(
      created.databaseId,
      'active',
      'Reviewed.',
    );
    const ruleValue = created.ruleSet.rules[0];
    if (ruleValue === undefined) throw new Error('Expected regulatory fixture rule.');
    const result = validateRegulatoryComplianceResult({
      routeId: 'route-capture',
      ruleSetId: created.ruleSet.ruleSetId,
      ruleSetVersion: created.ruleSet.version,
      evaluatedAt: utcInstant('2026-07-20T01:00:00Z'),
      status: 'action-required',
      legalFinalizationStatus: 'blocked',
      findings: [
        {
          findingId: 'rule:CA-KPRA-capture:segment-ca',
          ruleId: ruleValue.ruleId,
          ruleSetVersion: created.ruleSet.version,
          affectedSegmentId: 'segment-ca',
          jurisdictionCode: 'US-CA',
          category: 'kpra',
          severity: 'action-required',
          source,
          effectiveRuleVersion: ruleValue.version,
          inputFacts: {
            'vehicle.trailer.kpra': lengthInFeet(42),
            maximum: lengthInFeet(40),
          },
          explanation: 'Test-only KPRA action required.',
          requiredAction: ruleValue.requiredAction,
          blocksRouteFinalization: true,
          requiresManualVerification: false,
          lastVerifiedAt: source.lastVerifiedAt,
        },
      ],
      evaluatedSegmentIds: ['segment-ca'],
      manualVerificationSegmentIds: [],
      lastVerifiedAt: source.lastVerifiedAt,
      sourceAttribution: [source],
      explanations: ['Test-only structured compliance result.'],
    });

    await expect(
      repository.captureEvaluationEvidence({
        tripRevisionId: revision.id,
        ruleSetDatabaseId: created.databaseId,
        result,
        reason: 'Persist reproducible regulatory evidence.',
      }),
    ).resolves.toEqual({ linkedRuleCount: 1, warningCount: 1 });
    await expect(
      client.tripRevisionRule.count({ where: { tripRevisionId: revision.id } }),
    ).resolves.toBe(1);
    await expect(
      client.complianceWarning.count({ where: { tripRevisionId: revision.id } }),
    ).resolves.toBe(1);
    await expect(
      client.auditEvent.count({
        where: {
          entityType: 'trip-revision',
          entityId: revision.id,
          action: 'regulatory-evaluated',
        },
      }),
    ).resolves.toBe(1);
  });
});
