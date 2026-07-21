import {
  KPRA_REQUIRED_CONFIRMATIONS,
  kpraAdjustmentEvidenceSnapshot,
  lengthInFeet,
  utcInstant,
  validateKpraAdjustmentAction,
  validateKpraAdjustmentEvidence,
  weightInPounds,
} from '../src/index.js';
import { describe, expect, it } from 'vitest';

const source = {
  authorityType: 'state-dot' as const,
  authorityName: 'Test-only official authority',
  title: 'Test-only official KPRA fixture',
  reference: 'fixture://official/kpra',
  retrievedAt: utcInstant('2026-07-20T00:00:00Z'),
  version: 'fixture-1',
  lastVerifiedAt: utcInstant('2026-07-20T00:00:00Z'),
};

function action() {
  return validateKpraAdjustmentAction({
    actionId: 'kpra:revision-1:finding-1',
    originalTripRevisionId: 'revision-1',
    routeId: 'route-1',
    findingId: 'finding-1',
    ruleId: 'CA-KPRA-TEST',
    ruleSetVersion: 'rules-v1',
    ruleVersion: '1',
    affectedSegmentId: 'segment-ca',
    jurisdictionCode: 'US-CA',
    evaluatedAt: utcInstant('2026-07-20T01:00:00Z'),
    source,
    enteredKpra: lengthInFeet(42),
    allowedKpra: lengthInFeet(40),
    minimumAchievableKpra: lengthInFeet(37),
    maximumAchievableKpra: lengthInFeet(43),
    slidingTandemCapability: true,
    actionLocation: {
      locationReferenceId: 'scale-before-segment',
      description: 'Test-only adjustment location.',
    },
    choices: ['adjust-and-revalidate', 'reroute'],
    requiredConfirmations: KPRA_REQUIRED_CONFIRMATIONS,
    warning: 'Test-only sourced KPRA action.',
  });
}

describe('KPRA adjustment contracts', () => {
  it('preserves physical measurements, source evidence, choices, and confirmations', () => {
    const value = action();
    expect(value.enteredKpra).toEqual(lengthInFeet(42));
    expect(value.allowedKpra).toEqual(lengthInFeet(40));
    expect(value.source.reference).toBe('fixture://official/kpra');
    expect(value.choices).toEqual(['adjust-and-revalidate', 'reroute']);
    expect(value.requiredConfirmations).toEqual(KPRA_REQUIRED_CONFIRMATIONS);
    expect(Object.isFrozen(value)).toBe(true);
  });

  it('rejects an action when entered KPRA does not exceed the sourced limit', () => {
    expect(() =>
      validateKpraAdjustmentAction({
        ...action(),
        enteredKpra: lengthInFeet(40),
      }),
    ).toThrow(/above the allowed KPRA/iu);
  });

  it('requires a new immutable revision and matching acknowledgement action', () => {
    expect(() =>
      validateKpraAdjustmentEvidence({
        originalTripRevisionId: 'revision-1',
        recalculationTripRevisionId: 'revision-1',
        action: action(),
        confirmation: {
          actionId: 'other-action',
          resolution: 'adjust-and-revalidate',
          acknowledgedAt: utcInstant('2026-07-20T02:00:00Z'),
          newVerifiedKpra: lengthInFeet(40),
          trailerAxleWeight: weightInPounds(32_000),
          driveAxleWeight: weightInPounds(33_000),
          totalGrossCombinationWeight: weightInPounds(77_000),
          loadDistributionConfirmed: true,
          measurementSource: 'Test-only physical measurement.',
        },
        status: 'resolved',
        legalFinalizationStatus: 'allowed',
        recalculatedAt: utcInstant('2026-07-20T02:00:00Z'),
        explanations: ['Test-only result.'],
      }),
    ).toThrow();
  });

  it('creates a JSON-safe immutable evidence snapshot', () => {
    const actionValue = action();
    const value = validateKpraAdjustmentEvidence({
      originalTripRevisionId: 'revision-1',
      recalculationTripRevisionId: 'revision-2',
      action: actionValue,
      confirmation: {
        actionId: actionValue.actionId,
        resolution: 'reroute',
        acknowledgedAt: utcInstant('2026-07-20T02:00:00Z'),
        note: 'Test-only reroute selection.',
      },
      status: 'reroute-required',
      legalFinalizationStatus: 'blocked',
      recalculatedAt: utcInstant('2026-07-20T02:00:00Z'),
      explanations: ['Test-only reroute result.'],
    });
    expect(kpraAdjustmentEvidenceSnapshot(value)).toMatchObject({
      originalTripRevisionId: 'revision-1',
      recalculationTripRevisionId: 'revision-2',
      status: 'reroute-required',
    });
  });
});
