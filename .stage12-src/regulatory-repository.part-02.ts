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
