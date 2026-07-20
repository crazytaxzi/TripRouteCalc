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
