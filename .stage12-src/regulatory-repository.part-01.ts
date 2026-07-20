
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
