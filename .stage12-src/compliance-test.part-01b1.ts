    evaluationAt: utcInstant('2026-07-20T01:00:00Z'),
    segments: [segment('or-1', 'US-OR', 'I-5'), segment('ca-1', 'US-CA', 'I-5')],
    ruleSet: ruleSet(rules),
    ...options,
  };
}

describe('regulatory compliance engine', () => {
  it('applies a California KPRA action only to the exact California segment', () => {
    const result = evaluateRegulatoryCompliance(
      input([kpraRule('CA-KPRA-40', 40)], { equipment: equipment(42.5) }),
    );
    expect(result.status).toBe('action-required');
    expect(result.legalFinalizationStatus).toBe('blocked');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      ruleId: 'CA-KPRA-40',
      affectedSegmentId: 'ca-1',
      jurisdictionCode: 'US-CA',
      actionLocation: { locationReferenceId: 'last-scale-before-ca' },
