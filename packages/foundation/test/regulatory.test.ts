import {
  lengthInFeet,
  validateJurisdictionRule,
  validateRegulatoryRuleSet,
  utcInstant,
} from '../src/index.js';
import { describe, expect, it } from 'vitest';

const source = {
  authorityType: 'state-dot' as const,
  authorityName: 'Test-only state authority',
  title: 'Test-only official source fixture',
  reference: 'fixture://official/test-only',
  retrievedAt: utcInstant('2026-07-20T00:00:00Z'),
  version: 'fixture-1',
  lastVerifiedAt: utcInstant('2026-07-20T00:00:00Z'),
};

function rule(ruleId = 'TEST-KPRA') {
  return {
    ruleId,
    jurisdictionCode: 'US-CA',
    category: 'kpra' as const,
    affectedVehicleTypes: ['tractor-semitrailer' as const],
    roadScope: {
      kind: 'jurisdiction-wide' as const,
      jurisdictionCodes: ['US-CA'],
    },
    effectiveFrom: utcInstant('2026-07-01T00:00:00Z'),
    source,
    explanation: 'Test-only KPRA rule shape.',
    condition: {
      kind: 'length' as const,
      fact: 'vehicle.trailer.kpra' as const,
      operator: 'greater-than' as const,
      value: lengthInFeet(40),
    },
    requiredAction: {
      code: 'ADJUST-KPRA',
      instruction: 'Adjust and verify KPRA before the affected segment.',
      mustCompleteBeforeSegment: true,
      requiredUpdatedFacts: [
        'vehicle.trailer.kpra',
        'load.drive-axle-weight',
        'load.trailer-axle-weight',
      ],
    },
    severity: 'action-required' as const,
    blocksRouteFinalization: true,
    requiresManualVerification: false,
    active: true,
    version: '1',
  };
}

describe('regulatory contracts', () => {
  it('preserves machine conditions separately from source and explanation metadata', () => {
    const parsed = validateJurisdictionRule(rule());
    expect(parsed.condition).toMatchObject({
      kind: 'length',
      fact: 'vehicle.trailer.kpra',
      value: lengthInFeet(40),
    });
    expect(parsed.source.reference).toBe('fixture://official/test-only');
    expect(parsed.explanation).toMatch(/test-only/iu);
    expect(Object.isFrozen(parsed)).toBe(true);
  });

  it('requires manual-verification severity to block and require verification', () => {
    expect(() =>
      validateJurisdictionRule({
        ...rule('TEST-MANUAL'),
        severity: 'manual-verification-required',
        blocksRouteFinalization: false,
        requiresManualVerification: false,
      }),
    ).toThrow(/manual|block/iu);
  });

  it('rejects duplicate rule identifiers inside one versioned rule set', () => {
    expect(() =>
      validateRegulatoryRuleSet({
        ruleSetId: 'set-1',
        name: 'test-only-rules',
        version: '2026-07-20-test',
        status: 'draft',
        effectiveFrom: utcInstant('2026-07-20T00:00:00Z'),
        source,
        coverage: {
          jurisdictionCodes: ['US-CA'],
          status: 'partial',
          limitations: ['Test-only fixture.'],
        },
        rules: [rule('DUPLICATE'), rule('DUPLICATE')],
      }),
    ).toThrow(/unique/iu);
  });

  it('rejects non-authoritative source categories rather than accepting blogs', () => {
    expect(() =>
      validateJurisdictionRule({
        ...rule('TEST-SOURCE'),
        source: { ...source, authorityType: 'blog' },
      }),
    ).toThrow();
  });
});
