import type { UtcInstant } from '@trip-route-calc/foundation';

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
        await transaction.regulatoryRuleSet.updateMany({
          where: {
            carrierId: this.context.carrierId,
            name: existing.name,
            status: PRISMA_RULE_SET_STATUSES.active,
            NOT: { id: existing.id },
          },
          data: { status: PRISMA_RULE_SET_STATUSES.inactive },
        });
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
}
