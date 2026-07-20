
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
