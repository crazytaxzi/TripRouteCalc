import { randomUUID } from 'node:crypto';

import {
  durationInMinutes,
  ianaTimeZone,
  lengthInFeet,
  utcInstant,
  validateKpraAdjustmentAction,
  validateKpraAdjustmentEvidence,
  weightInPounds,
  type KpraAdjustmentAction,
  type KpraAdjustmentEvidence,
} from '@trip-route-calc/foundation';
import { validateRegulatoryComplianceResult } from '@trip-route-calc/foundation/regulatory';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  KpraAdjustmentRepository,
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
  'warning_acknowledgements',
  'compliance_warnings',
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

const source = {
  authorityType: 'state-dot' as const,
  authorityName: 'Test-only official authority',
  title: 'Test-only KPRA persistence fixture',
  reference: 'fixture://official/kpra-persistence',
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

function revisionInput(
  tripId: string,
  warning?: {
    readonly code: string;
    readonly sourceReference: string;
  },
): CreateTripRevisionInput {
  return {
    tripId,
    calculationTimestamp: utcInstant('2026-07-20T01:00:00Z'),
    ruleSetVersion: 'rules-v1',
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
    ...(warning === undefined
      ? {}
      : {
          warnings: [
            {
              severity: 'blocking' as const,
              code: warning.code,
              explanation: 'Test-only KPRA action required.',
              sourceReference: warning.sourceReference,
            },
          ],
        }),
  };
}

function action(originalTripRevisionId: string): KpraAdjustmentAction {
  return validateKpraAdjustmentAction({
    actionId: `kpra:${originalTripRevisionId}:finding-1`,
    originalTripRevisionId,
    routeId: 'route-1',
    findingId: 'finding-1',
    ruleId: 'CA-KPRA-TEST',
    ruleSetVersion: 'rules-v1',
    ruleVersion: '1',
    affectedSegmentId: 'segment-ca',
    jurisdictionCode: 'US-CA',
    evaluatedAt: utcInstant('2026-07-20T01:00:00Z'),
    source,
    enteredKpra: lengthInFeet(42),
    allowedKpra: lengthInFeet(40),
    minimumAchievableKpra: lengthInFeet(37),
    maximumAchievableKpra: lengthInFeet(43),
    slidingTandemCapability: true,
    choices: ['adjust-and-revalidate', 'reroute'],
    requiredConfirmations: [
      'vehicle.trailer.kpra',
      'load.trailer-axle-weight',
      'load.drive-axle-weight',
      'load.total-gross-combination-weight',
      'load.distribution-confirmed',
    ],
    warning: 'Test-only KPRA adjustment warning.',
  });
}

function evidence(
  originalTripRevisionId: string,
  recalculationTripRevisionId: string,
): KpraAdjustmentEvidence {
  const actionValue = action(originalTripRevisionId);
  return validateKpraAdjustmentEvidence({
    originalTripRevisionId,
    recalculationTripRevisionId,
    action: actionValue,
    confirmation: {
      actionId: actionValue.actionId,
      resolution: 'adjust-and-revalidate',
      acknowledgedAt: utcInstant('2026-07-20T02:00:00Z'),
      newVerifiedKpra: lengthInFeet(40),
      trailerAxleWeight: weightInPounds(32_000),
      driveAxleWeight: weightInPounds(33_000),
      totalGrossCombinationWeight: weightInPounds(77_000),
      loadDistributionConfirmed: true,
      measurementSource: 'Test-only physical tape and scale measurement.',
      note: 'Verified adjustment before the restricted segment.',
    },
    status: 'resolved',
    legalFinalizationStatus: 'allowed',
    recalculatedAt: utcInstant('2026-07-20T02:00:00Z'),
    complianceResult: validateRegulatoryComplianceResult({
      routeId: 'route-1',
      ruleSetId: 'rule-set-id',
      ruleSetVersion: 'rules-v1',
      evaluatedAt: utcInstant('2026-07-20T02:00:00Z'),
      status: 'compliant',
      legalFinalizationStatus: 'allowed',
      findings: [],
      evaluatedSegmentIds: ['segment-ca'],
      manualVerificationSegmentIds: [],
      lastVerifiedAt: source.lastVerifiedAt,
      sourceAttribution: [source],
      explanations: ['Test-only revalidation passed.'],
    }),
    explanations: ['Test-only KPRA and axle revalidation passed.'],
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

describe('KPRA adjustment evidence persistence', () => {
  it('links acknowledgement, source evidence, and a later immutable revision', async () => {
    const tenant = await seedTenant('kpra-capture');
    const revisions = new TripRevisionRepository(client, tenant.context);
    const originalAction = action('placeholder');
    const original = await revisions.createRevision(
      revisionInput(tenant.tripId, {
        code: originalAction.findingId,
        sourceReference: source.reference,
      }),
    );
    const recalculation = await revisions.createRevision(
      revisionInput(tenant.tripId),
    );
    const value = evidence(original.id, recalculation.id);
    const repository = new KpraAdjustmentRepository(client, tenant.context);

    const captured = await repository.captureAdjustmentEvidence({
      evidence: value,
      reason: 'Persist verified tandem adjustment and recalculation evidence.',
    });

    expect(captured.acknowledgementId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(captured.auditEventId).toMatch(/^[0-9a-f-]{36}$/u);
    await expect(
      client.warningAcknowledgement.count({
        where: {
          carrierId: tenant.context.carrierId,
          warning: { tripRevisionId: original.id },
        },
      }),
    ).resolves.toBe(1);
    const audit = await client.auditEvent.findFirstOrThrow({
      where: {
        carrierId: tenant.context.carrierId,
        entityType: 'kpra-adjustment',
        entityId: recalculation.id,
        action: 'kpra-adjustment-revalidated',
      },
    });
    expect(audit.metadata).toMatchObject({
      evidence: {
        originalTripRevisionId: original.id,
        recalculationTripRevisionId: recalculation.id,
        status: 'resolved',
        action: {
          ruleSetVersion: 'rules-v1',
          source: { reference: source.reference },
        },
      },
    });

    await expect(
      repository.captureAdjustmentEvidence({
        evidence: value,
        reason: 'Duplicate capture attempt.',
      }),
    ).rejects.toThrow(/already captured/iu);
  });

  it('does not expose or link revisions from another carrier', async () => {
    const tenantA = await seedTenant('kpra-a');
    const tenantB = await seedTenant('kpra-b');
    const revisionsB = new TripRevisionRepository(client, tenantB.context);
    const original = await revisionsB.createRevision(
      revisionInput(tenantB.tripId, {
        code: 'finding-1',
        sourceReference: source.reference,
      }),
    );
    const recalculation = await revisionsB.createRevision(
      revisionInput(tenantB.tripId),
    );

    await expect(
      new KpraAdjustmentRepository(
        client,
        tenantA.context,
      ).captureAdjustmentEvidence({
        evidence: evidence(original.id, recalculation.id),
        reason: 'Cross-tenant capture attempt.',
      }),
    ).rejects.toBeInstanceOf(TenantObjectNotFoundError);
  });
});
