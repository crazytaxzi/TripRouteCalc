import {
  regulatoryComplianceResultSnapshot,
  regulatoryRuleSetSnapshot,
  regulatoryRuleSnapshot,
  utcInstant,
  validateJurisdictionRule,
  validateRegulatoryComplianceResult,
  validateRegulatoryRuleSet,
} from '@trip-route-calc/foundation';
import type {
  RegulatoryComplianceResult,
  RegulatoryRuleSet,
  RegulatoryRuleSetStatus,
  UtcInstant,
} from '@trip-route-calc/foundation';

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
