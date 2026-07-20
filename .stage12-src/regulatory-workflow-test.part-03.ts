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
