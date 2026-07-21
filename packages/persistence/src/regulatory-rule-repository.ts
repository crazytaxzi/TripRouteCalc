import { utcInstant } from '@trip-route-calc/foundation';
import type { UtcInstant } from '@trip-route-calc/foundation';
import {
  regulatoryComplianceResultSnapshot,
  regulatoryRuleSetSnapshot,
  regulatoryRuleSnapshot,
  validateJurisdictionRule,
  validateRegulatoryComplianceResult,
  validateRegulatoryRuleSet,
} from '@trip-route-calc/foundation/regulatory';
import type {
  RegulatoryComplianceResult,
  RegulatoryRuleSet,
  RegulatoryRuleSetStatus,
} from '@trip-route-calc/foundation/regulatory';

import type { PersistenceClient } from './client.js';
import { TenantObjectNotFoundError } from './errors.js';
import type { Prisma } from './generated/prisma/client.js';
import {
  PRISMA_RULE_SET_STATUSES,
  asInputJson,
  toDate,
} from './repository-shared.js';
import type { TenantContext } from './tenant.js';
import { assertTenantMembership } from './tenant.js';

export interface CreateRegulatoryRuleInput {
  readonly jurisdictionCode: string;
  readonly ruleType: string;
  readonly version: string;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveTo?: UtcInstant;
  readonly sourceTitle: string;
  readonly sourceReference: string;
  readonly sourceMetadata: Readonly<Record<string, unknown>>;
  readonly lastVerifiedAt: UtcInstant;
  readonly active: boolean;
  readonly ruleDefinition: Readonly<Record<string, unknown>>;
}

export interface CreateRegulatoryRuleSetInput {
  readonly name: string;
  readonly version: string;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveTo?: UtcInstant;
  readonly sourceTitle: string;
  readonly sourceReference: string;
  readonly sourceMetadata: Readonly<Record<string, unknown>>;
  readonly lastVerifiedAt: UtcInstant;
  readonly rules: readonly CreateRegulatoryRuleInput[];
  readonly reason: string;
}

export interface CreateValidatedRegulatoryRuleSetInput {
  readonly ruleSet: RegulatoryRuleSet;
  readonly reason: string;
}

export interface UpdateDraftRegulatoryRuleSetInput {
  readonly ruleSetId: string;
  readonly ruleSet: RegulatoryRuleSet;
  readonly reason: string;
}

export interface CaptureRegulatoryEvaluationInput {
  readonly tripRevisionId: string;
  readonly ruleSetDatabaseId: string;
  readonly result: RegulatoryComplianceResult;
  readonly reason: string;
}

export interface PersistedRegulatoryRuleSet {
  readonly databaseId: string;
  readonly ruleSet: RegulatoryRuleSet;
}

export interface CapturedRegulatoryEvaluation {
  readonly linkedRuleCount: number;
  readonly warningCount: number;
}

type RuleSetWithRules = Prisma.RegulatoryRuleSetGetPayload<{
  include: { rules: true };
}>;

function objectRecord(value: unknown, path: string): Record<string, unknown> {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new TypeError(`${path} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

function statusFromPrisma(status: RuleSetWithRules['status']): RegulatoryRuleSetStatus {
  switch (status) {
    case 'DRAFT':
      return 'draft';
    case 'ACTIVE':
      return 'active';
    case 'INACTIVE':
      return 'inactive';
  }
}

function hydratedRuleSet(row: RuleSetWithRules): RegulatoryRuleSet {
  const metadata = objectRecord(row.sourceMetadata, 'ruleSet.sourceMetadata');
  return validateRegulatoryRuleSet({
    ruleSetId: metadata.ruleSetId,
    name: row.name,
    version: row.version,
    status: statusFromPrisma(row.status),
    effectiveFrom: utcInstant(row.effectiveFrom.toISOString()),
    ...(row.effectiveTo === null
      ? {}
      : { effectiveTo: utcInstant(row.effectiveTo.toISOString()) }),
    source: metadata.source,
    coverage: metadata.coverage,
    rules: row.rules.map((rule) => validateJurisdictionRule(rule.ruleDefinition)),
  });
}

function validatedCreateInput(
  ruleSetValue: RegulatoryRuleSet,
  reason: string,
): CreateRegulatoryRuleSetInput {
  const ruleSet = validateRegulatoryRuleSet(ruleSetValue);
  if (ruleSet.status !== 'draft') {
    throw new RangeError('A new regulatory rule set must begin in draft status.');
  }
  return {
    name: ruleSet.name,
    version: ruleSet.version,
    effectiveFrom: ruleSet.effectiveFrom,
    ...(ruleSet.effectiveTo === undefined
      ? {}
      : { effectiveTo: ruleSet.effectiveTo }),
    sourceTitle: ruleSet.source.title,
    sourceReference: ruleSet.source.reference,
    sourceMetadata: {
      ruleSetId: ruleSet.ruleSetId,
      source: ruleSet.source,
      coverage: ruleSet.coverage,
    },
    lastVerifiedAt: ruleSet.source.lastVerifiedAt,
    rules: ruleSet.rules.map((rule) => ({
      jurisdictionCode: rule.jurisdictionCode,
      ruleType: rule.ruleId,
      version: rule.version,
      effectiveFrom: rule.effectiveFrom,
      ...(rule.effectiveTo === undefined
        ? {}
        : { effectiveTo: rule.effectiveTo }),
      sourceTitle: rule.source.title,
      sourceReference: rule.source.reference,
      sourceMetadata: { source: rule.source },
      lastVerifiedAt: rule.source.lastVerifiedAt,
      active: rule.active,
      ruleDefinition: regulatoryRuleSnapshot(rule),
    })),
    reason,
  };
}

function warningSeverity(
  finding: RegulatoryComplianceResult['findings'][number],
): 'INFORMATION' | 'WARNING' | 'BLOCKING' {
  if (finding.blocksRouteFinalization) return 'BLOCKING';
  return finding.severity === 'information' ? 'INFORMATION' : 'WARNING';
}

export class RegulatoryRuleRepository {
  public constructor(
    private readonly client: PersistenceClient,
    private readonly context: TenantContext,
  ) {}

  public async createRuleSet(
    input: CreateRegulatoryRuleSetInput,
  ): Promise<Prisma.RegulatoryRuleSetGetPayload<{ include: { rules: true } }>> {
    await assertTenantMembership(this.client, this.context);

    return this.client.$transaction(async (transaction) => {
      const createdRuleSet = await transaction.regulatoryRuleSet.create({
        data: {
          carrierId: this.context.carrierId,
          name: input.name,
          version: input.version,
          status: PRISMA_RULE_SET_STATUSES.draft,
          effectiveFrom: toDate(input.effectiveFrom),
          effectiveTo:
            input.effectiveTo === undefined ? null : toDate(input.effectiveTo),
          sourceTitle: input.sourceTitle,
          sourceReference: input.sourceReference,
          sourceMetadata: asInputJson(input.sourceMetadata, 'sourceMetadata'),
          lastVerifiedAt: toDate(input.lastVerifiedAt),
        },
        select: { id: true },
      });

      if (input.rules.length > 0) {
        await transaction.jurisdictionRule.createMany({
          data: input.rules.map((rule, index) => ({
            carrierId: this.context.carrierId,
            ruleSetId: createdRuleSet.id,
            jurisdictionCode: rule.jurisdictionCode,
            ruleType: rule.ruleType,
            version: rule.version,
            effectiveFrom: toDate(rule.effectiveFrom),
            effectiveTo:
              rule.effectiveTo === undefined ? null : toDate(rule.effectiveTo),
            sourceTitle: rule.sourceTitle,
            sourceReference: rule.sourceReference,
            sourceMetadata: asInputJson(
              rule.sourceMetadata,
              `rules[${String(index)}].sourceMetadata`,
            ),
            lastVerifiedAt: toDate(rule.lastVerifiedAt),
            active: rule.active,
            ruleDefinition: asInputJson(
              rule.ruleDefinition,
              `rules[${String(index)}].ruleDefinition`,
            ),
          })),
        });
      }

      const ruleSet = await transaction.regulatoryRuleSet.findUniqueOrThrow({
        where: { id: createdRuleSet.id },
        include: { rules: true },
      });

      await transaction.regulatoryRuleChange.create({
        data: {
          carrierId: this.context.carrierId,
          ruleSetId: ruleSet.id,
          changedByUserId: this.context.actorUserId,
          action: 'created',
          afterSnapshot: asInputJson(
            {
              name: ruleSet.name,
              version: ruleSet.version,
              status: ruleSet.status,
              ruleCount: ruleSet.rules.length,
            },
            'regulatoryRuleChange.afterSnapshot',
          ),
          reason: input.reason,
        },
      });

      return ruleSet;
    });
  }

  public async createValidatedRuleSet(
    input: CreateValidatedRegulatoryRuleSetInput,
  ): Promise<PersistedRegulatoryRuleSet> {
    const created = await this.createRuleSet(
      validatedCreateInput(input.ruleSet, input.reason),
    );
    return { databaseId: created.id, ruleSet: hydratedRuleSet(created) };
  }

  public async getValidatedRuleSet(
    ruleSetId: string,
  ): Promise<RegulatoryRuleSet | null> {
    await assertTenantMembership(this.client, this.context);
    const row = await this.client.regulatoryRuleSet.findFirst({
      where: { id: ruleSetId, carrierId: this.context.carrierId },
      include: { rules: { orderBy: [{ jurisdictionCode: 'asc' }, { ruleType: 'asc' }] } },
    });
    return row === null ? null : hydratedRuleSet(row);
  }

  public async getActiveRuleSet(
    name: string,
    evaluationAt: UtcInstant,
  ): Promise<{ readonly databaseId: string; readonly ruleSet: RegulatoryRuleSet } | null> {
    await assertTenantMembership(this.client, this.context);
    const at = toDate(evaluationAt);
    const row = await this.client.regulatoryRuleSet.findFirst({
      where: {
        carrierId: this.context.carrierId,
        name,
        status: PRISMA_RULE_SET_STATUSES.active,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
      include: { rules: { orderBy: [{ jurisdictionCode: 'asc' }, { ruleType: 'asc' }] } },
    });
    return row === null
      ? null
      : { databaseId: row.id, ruleSet: hydratedRuleSet(row) };
  }

  public async updateDraftRuleSet(
    input: UpdateDraftRegulatoryRuleSetInput,
  ): Promise<PersistedRegulatoryRuleSet> {
    await assertTenantMembership(this.client, this.context);
    const next = validateRegulatoryRuleSet(input.ruleSet);
    if (next.status !== 'draft') {
      throw new RangeError('A draft update must retain draft status.');
    }

    const updated = await this.client.$transaction(async (transaction) => {
      const existing = await transaction.regulatoryRuleSet.findFirst({
        where: { id: input.ruleSetId, carrierId: this.context.carrierId },
        include: { rules: true },
      });
      if (existing === null) {
        throw new TenantObjectNotFoundError(
          'Regulatory rule set was not found in the requested carrier account.',
        );
      }
      if (existing.status !== PRISMA_RULE_SET_STATUSES.draft) {
        throw new RangeError('Only draft regulatory rule sets may be revised.');
      }

      await transaction.jurisdictionRule.deleteMany({
        where: { ruleSetId: existing.id, carrierId: this.context.carrierId },
      });
      await transaction.regulatoryRuleSet.update({
        where: { id: existing.id },
        data: {
          name: next.name,
          version: next.version,
          effectiveFrom: toDate(next.effectiveFrom),
          effectiveTo:
            next.effectiveTo === undefined ? null : toDate(next.effectiveTo),
          sourceTitle: next.source.title,
          sourceReference: next.source.reference,
          sourceMetadata: asInputJson(
            {
              ruleSetId: next.ruleSetId,
              source: next.source,
              coverage: next.coverage,
            },
            'sourceMetadata',
          ),
          lastVerifiedAt: toDate(next.source.lastVerifiedAt),
        },
      });
      if (next.rules.length > 0) {
        await transaction.jurisdictionRule.createMany({
          data: validatedCreateInput(next, input.reason).rules.map((rule, index) => ({
            carrierId: this.context.carrierId,
            ruleSetId: existing.id,
            jurisdictionCode: rule.jurisdictionCode,
            ruleType: rule.ruleType,
            version: rule.version,
            effectiveFrom: toDate(rule.effectiveFrom),
            effectiveTo:
              rule.effectiveTo === undefined ? null : toDate(rule.effectiveTo),
            sourceTitle: rule.sourceTitle,
            sourceReference: rule.sourceReference,
            sourceMetadata: asInputJson(
              rule.sourceMetadata,
              `rules[${String(index)}].sourceMetadata`,
            ),
            lastVerifiedAt: toDate(rule.lastVerifiedAt),
            active: rule.active,
            ruleDefinition: asInputJson(
              rule.ruleDefinition,
              `rules[${String(index)}].ruleDefinition`,
            ),
          })),
        });
      }

      await transaction.regulatoryRuleChange.create({
        data: {
          carrierId: this.context.carrierId,
          ruleSetId: existing.id,
          changedByUserId: this.context.actorUserId,
          action: 'draft-revised',
          beforeSnapshot: asInputJson(
            {
              name: existing.name,
              version: existing.version,
              status: existing.status,
              ruleCount: existing.rules.length,
            },
            'regulatoryRuleChange.beforeSnapshot',
          ),
          afterSnapshot: asInputJson(
            regulatoryRuleSetSnapshot(next),
            'regulatoryRuleChange.afterSnapshot',
          ),
          reason: input.reason,
        },
      });
      await transaction.auditEvent.create({
        data: {
          carrierId: this.context.carrierId,
          actorUserId: this.context.actorUserId,
          entityType: 'regulatory-rule-set',
          entityId: existing.id,
          action: 'draft-revised',
          metadata: asInputJson(
            { version: next.version, ruleCount: next.rules.length, reason: input.reason },
            'audit.metadata',
          ),
        },
      });

      return transaction.regulatoryRuleSet.findUniqueOrThrow({
        where: { id: existing.id },
        include: { rules: { orderBy: [{ jurisdictionCode: 'asc' }, { ruleType: 'asc' }] } },
      });
    });

    return { databaseId: updated.id, ruleSet: hydratedRuleSet(updated) };
  }

  public async setRuleSetStatus(
    ruleSetId: string,
    status: 'draft' | 'active' | 'inactive',
    reason: string,
  ): Promise<Prisma.RegulatoryRuleSetGetPayload<Record<string, never>>> {
    await assertTenantMembership(this.client, this.context);

    return this.client.$transaction(async (transaction) => {
      const existing = await transaction.regulatoryRuleSet.findFirst({
        where: { id: ruleSetId, carrierId: this.context.carrierId },
      });
      if (existing === null) {
        throw new TenantObjectNotFoundError(
          'Regulatory rule set was not found in the requested carrier account.',
        );
      }

      const prismaStatus = PRISMA_RULE_SET_STATUSES[status];

      if (prismaStatus === PRISMA_RULE_SET_STATUSES.active) {
        const superseded = await transaction.regulatoryRuleSet.findMany({
          where: {
            carrierId: this.context.carrierId,
            name: existing.name,
            status: PRISMA_RULE_SET_STATUSES.active,
            NOT: { id: existing.id },
          },
        });
        for (const prior of superseded) {
          await transaction.regulatoryRuleSet.update({
            where: { id: prior.id },
            data: { status: PRISMA_RULE_SET_STATUSES.inactive },
          });
          await transaction.regulatoryRuleChange.create({
            data: {
              carrierId: this.context.carrierId,
              ruleSetId: prior.id,
              changedByUserId: this.context.actorUserId,
              action: 'superseded',
              beforeSnapshot: asInputJson(
                { status: prior.status },
                'regulatoryRuleChange.beforeSnapshot',
              ),
              afterSnapshot: asInputJson(
                { status: PRISMA_RULE_SET_STATUSES.inactive },
                'regulatoryRuleChange.afterSnapshot',
              ),
              reason: `Superseded by rule set ${existing.id}: ${reason}`,
            },
          });
          await transaction.auditEvent.create({
            data: {
              carrierId: this.context.carrierId,
              actorUserId: this.context.actorUserId,
              entityType: 'regulatory-rule-set',
              entityId: prior.id,
              action: 'superseded',
              metadata: asInputJson(
                { replacementRuleSetId: existing.id, reason },
                'audit.metadata',
              ),
            },
          });
        }
      }

      const updated = await transaction.regulatoryRuleSet.update({
        where: { id: existing.id },
        data: { status: prismaStatus },
      });

      await transaction.regulatoryRuleChange.create({
        data: {
          carrierId: this.context.carrierId,
          ruleSetId: existing.id,
          changedByUserId: this.context.actorUserId,
          action: 'status-changed',
          beforeSnapshot: asInputJson(
            { status: existing.status },
            'regulatoryRuleChange.beforeSnapshot',
          ),
          afterSnapshot: asInputJson(
            { status: updated.status },
            'regulatoryRuleChange.afterSnapshot',
          ),
          reason,
        },
      });

      await transaction.auditEvent.create({
        data: {
          carrierId: this.context.carrierId,
          actorUserId: this.context.actorUserId,
          entityType: 'regulatory-rule-set',
          entityId: existing.id,
          action: 'status-changed',
          metadata: asInputJson(
            { from: existing.status, to: updated.status, reason },
            'audit.metadata',
          ),
        },
      });

      return updated;
    });
  }

  public async setValidatedRuleSetStatus(
    ruleSetId: string,
    status: 'active' | 'inactive',
    reason: string,
  ): Promise<RegulatoryRuleSet> {
    const existing = await this.getValidatedRuleSet(ruleSetId);
    if (existing === null) {
      throw new TenantObjectNotFoundError(
        'Regulatory rule set was not found in the requested carrier account.',
      );
    }
    if (status === 'active' && existing.status !== 'draft') {
      throw new RangeError('Only a reviewed draft may be activated.');
    }
    if (status === 'inactive' && existing.status !== 'active') {
      throw new RangeError('Only an active regulatory rule set may be deactivated.');
    }
    await this.setRuleSetStatus(ruleSetId, status, reason);
    const updated = await this.getValidatedRuleSet(ruleSetId);
    if (updated === null) {
      throw new TenantObjectNotFoundError(
        'Regulatory rule set disappeared after its status changed.',
      );
    }
    return updated;
  }

  public async listRuleSetChanges(
    ruleSetId: string,
  ): Promise<readonly Prisma.RegulatoryRuleChangeGetPayload<Record<string, never>>[]> {
    await assertTenantMembership(this.client, this.context);
    const exists = await this.client.regulatoryRuleSet.findFirst({
      where: { id: ruleSetId, carrierId: this.context.carrierId },
      select: { id: true },
    });
    if (exists === null) {
      throw new TenantObjectNotFoundError(
        'Regulatory rule set was not found in the requested carrier account.',
      );
    }
    return this.client.regulatoryRuleChange.findMany({
      where: { ruleSetId, carrierId: this.context.carrierId },
      orderBy: [{ changedAt: 'asc' }, { id: 'asc' }],
    });
  }

  public async captureEvaluationEvidence(
    input: CaptureRegulatoryEvaluationInput,
  ): Promise<CapturedRegulatoryEvaluation> {
    await assertTenantMembership(this.client, this.context);
    const result = validateRegulatoryComplianceResult(input.result);

    return this.client.$transaction(async (transaction) => {
      const revision = await transaction.tripRevision.findFirst({
        where: {
          id: input.tripRevisionId,
          carrierId: this.context.carrierId,
        },
        select: { id: true },
      });
      if (revision === null) {
        throw new TenantObjectNotFoundError(
          'Trip revision was not found in the requested carrier account.',
        );
      }
      const ruleSetRow = await transaction.regulatoryRuleSet.findFirst({
        where: {
          id: input.ruleSetDatabaseId,
          carrierId: this.context.carrierId,
        },
        include: { rules: true },
      });
      if (ruleSetRow === null) {
        throw new TenantObjectNotFoundError(
          'Regulatory rule set was not found in the requested carrier account.',
        );
      }
      const ruleSet = hydratedRuleSet(ruleSetRow);
      if (
        ruleSet.ruleSetId !== result.ruleSetId ||
        ruleSet.version !== result.ruleSetVersion
      ) {
        throw new RangeError(
          'The compliance result does not match the selected persisted rule-set version.',
        );
      }

      const findingsByRule = new Map<string, RegulatoryComplianceResult['findings']>();
      for (const finding of result.findings) {
        if (finding.ruleId === undefined) continue;
        findingsByRule.set(
          finding.ruleId,
          Object.freeze([
            ...(findingsByRule.get(finding.ruleId) ?? []),
            finding,
          ]),
        );
      }

      if (ruleSetRow.rules.length > 0) {
        await transaction.tripRevisionRule.createMany({
          data: ruleSetRow.rules.map((ruleRow) => {
            const rule = validateJurisdictionRule(ruleRow.ruleDefinition);
            return {
              carrierId: this.context.carrierId,
              tripRevisionId: revision.id,
              jurisdictionRuleId: ruleRow.id,
              capturedVersion: rule.version,
              capturedSourceMetadata: asInputJson(
                {
                  ruleSetId: ruleSet.ruleSetId,
                  ruleSetVersion: ruleSet.version,
                  rule: regulatoryRuleSnapshot(rule),
                  findings: findingsByRule.get(rule.ruleId) ?? [],
                },
                'tripRevisionRule.capturedSourceMetadata',
              ),
            };
          }),
          skipDuplicates: true,
        });
      }

      if (result.findings.length > 0) {
        await transaction.complianceWarning.createMany({
          data: result.findings.map((finding) => ({
            carrierId: this.context.carrierId,
            tripRevisionId: revision.id,
            severity: warningSeverity(finding),
            code: finding.findingId,
            explanation: finding.explanation,
            sourceReference: finding.source.reference,
          })),
          skipDuplicates: true,
        });
      }

      await transaction.auditEvent.create({
        data: {
          carrierId: this.context.carrierId,
          actorUserId: this.context.actorUserId,
          entityType: 'trip-revision',
          entityId: revision.id,
          action: 'regulatory-evaluated',
          metadata: asInputJson(
            {
              result: regulatoryComplianceResultSnapshot(result),
              reason: input.reason,
            },
            'audit.metadata',
          ),
        },
      });

      return {
        linkedRuleCount: ruleSetRow.rules.length,
        warningCount: result.findings.length,
      };
    });
  }
}
