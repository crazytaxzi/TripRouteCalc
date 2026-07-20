    active: true,
    version: '1',
  });
}

function ruleSet(
  rules: readonly JurisdictionRule[],
  status: 'draft' | 'active' | 'inactive' = 'active',
): RegulatoryRuleSet {
  return validateRegulatoryRuleSet({
    ruleSetId: 'ruleset-test-1',
    name: 'test-only-regulatory-rules',
    version: '2026-07-20-test',
    status,
    effectiveFrom: utcInstant('2026-07-01T00:00:00Z'),
    source,
    coverage: {
      jurisdictionCodes: ['US-OR', 'US-CA'],
      status: 'complete',
      limitations: [],
    },
    rules,
  });
}

function input(
  rules: readonly JurisdictionRule[],
  options: Partial<RegulatoryEvaluationInput> = {},
): RegulatoryEvaluationInput {
  return {
    routeId: 'route-test-1',
    routeKind: 'commercial-vehicle',
    providerName: 'test-only-commercial-provider',
    providerVersion: 'fixture-1',
    providerRequestId: 'provider-request-1',
    providerRespondedAt: utcInstant('2026-07-20T00:00:01Z'),
    providerVerificationStatus: 'commercial-provider-verified',
    vehicleType: 'tractor-semitrailer',
    equipment: equipment(),
    permitIdentifiers: [],
