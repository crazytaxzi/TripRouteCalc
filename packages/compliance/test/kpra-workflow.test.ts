import {
  lengthInFeet,
  utcInstant,
  weightInPounds,
} from '@trip-route-calc/foundation';
import { validateJurisdictionRule } from '@trip-route-calc/foundation/regulatory';
import { describe, expect, it } from 'vitest';

import {
  assessKpraAdjustment,
  revalidateKpraAdjustment,
} from '../src/index.js';
import {
  equipment,
  input,
  kpraRule,
  ruleSet,
  segment,
} from './regulatory-fixtures.js';

const source = {
  authorityType: 'state-dot' as const,
  authorityName: 'Test-only official authority',
  title: 'Test-only axle fixture',
  reference: 'fixture://official/axle',
  retrievedAt: utcInstant('2026-07-20T00:00:00Z'),
  version: 'fixture-1',
  lastVerifiedAt: utcInstant('2026-07-20T00:00:00Z'),
};

function axleRule(maximumDriveWeight: number) {
  return validateJurisdictionRule({
    ruleId: 'CA-AXLE-TEST',
    jurisdictionCode: 'US-CA',
    category: 'axle-weight',
    affectedVehicleTypes: ['tractor-semitrailer'],
    roadScope: {
      kind: 'road-identity',
      roadIdentities: ['I-5'],
      directions: ['southbound'],
    },
    effectiveFrom: utcInstant('2026-07-01T00:00:00Z'),
    source,
    explanation: 'Test-only drive axle threshold after tandem adjustment.',
    condition: {
      kind: 'weight',
      fact: 'load.drive-axle-weight',
      operator: 'greater-than',
      value: weightInPounds(maximumDriveWeight),
    },
    requiredAction: {
      code: 'REWEIGH-AFTER-ADJUSTMENT',
      instruction: 'Reweigh and resolve the axle finding before finalization.',
      mustCompleteBeforeSegment: true,
      requiredUpdatedFacts: [
        'load.drive-axle-weight',
        'load.trailer-axle-weight',
        'load.total-gross-combination-weight',
      ],
    },
    severity: 'action-required',
    blocksRouteFinalization: true,
    requiresManualVerification: false,
    active: true,
    version: '1',
  });
}

function excessiveInput(rules = [kpraRule('CA-KPRA-40', 40)]) {
  return input(rules, { equipment: equipment(42) });
}

describe('California KPRA adjustment workflow', () => {
  it('needs no KPRA action for a compliant Oregon-to-California route', () => {
    const result = assessKpraAdjustment({
      originalTripRevisionId: 'revision-1',
      evaluationInput: input([kpraRule('CA-KPRA-40', 40)], {
        equipment: equipment(40),
      }),
      slidingTandemCapability: true,
      minimumAchievableKpra: lengthInFeet(37),
      maximumAchievableKpra: lengthInFeet(43),
    });

    expect(result.status).toBe('no-kpra-action');
    expect(result.legalFinalizationStatus).toBe('allowed');
    expect(result.action).toBeUndefined();
  });

  it('produces a sourced segment-specific adjustment action before California', () => {
    const result = assessKpraAdjustment({
      originalTripRevisionId: 'revision-1',
      evaluationInput: excessiveInput(),
      slidingTandemCapability: true,
      minimumAchievableKpra: lengthInFeet(37),
      maximumAchievableKpra: lengthInFeet(43),
    });

    expect(result.status).toBe('adjustment-required');
    expect(result.action).toMatchObject({
      affectedSegmentId: 'ca-1',
      enteredKpra: lengthInFeet(42),
      allowedKpra: lengthInFeet(40),
      actionLocation: {
        locationReferenceId: 'last-scale-before-ca',
      },
      choices: ['adjust-and-revalidate', 'reroute'],
    });
    expect(result.action?.warning).toContain(
      'kingpin-to-rearmost-axle measurement',
    );
    expect(result.action?.warning).toContain('42 ft');
    expect(result.action?.warning).toContain('40 ft');
  });

  it('selects a stricter 38-foot exact road limit over a general fixture rule', () => {
    const rules = [
      kpraRule('CA-KPRA-GENERAL-40', 40),
      kpraRule('CA-KPRA-I5-38', 38, 'I-5'),
    ];
    const result = assessKpraAdjustment({
      originalTripRevisionId: 'revision-1',
      evaluationInput: excessiveInput(rules),
      slidingTandemCapability: true,
      minimumAchievableKpra: lengthInFeet(37),
      maximumAchievableKpra: lengthInFeet(43),
    });

    expect(result.status).toBe('adjustment-required');
    expect(result.action?.ruleId).toBe('CA-KPRA-I5-38');
    expect(result.action?.allowedKpra).toEqual(lengthInFeet(38));
  });

  it('requires rerouting when the physical configuration cannot reach the limit', () => {
    const result = assessKpraAdjustment({
      originalTripRevisionId: 'revision-1',
      evaluationInput: excessiveInput(),
      slidingTandemCapability: true,
      minimumAchievableKpra: lengthInFeet(41),
      maximumAchievableKpra: lengthInFeet(43),
    });

    expect(result.status).toBe('reroute-required');
    expect(result.action?.choices).toEqual(['reroute']);
    expect(result.legalFinalizationStatus).toBe('blocked');
  });

  it('resolves the action only after a new revision confirms KPRA, weights, and distribution', () => {
    const evaluationInput = excessiveInput();
    const assessment = assessKpraAdjustment({
      originalTripRevisionId: 'revision-1',
      evaluationInput,
      slidingTandemCapability: true,
      minimumAchievableKpra: lengthInFeet(37),
      maximumAchievableKpra: lengthInFeet(43),
    });
    if (assessment.action === undefined) throw new Error('Expected KPRA action.');

    const result = revalidateKpraAdjustment({
      originalTripRevisionId: 'revision-1',
      recalculationTripRevisionId: 'revision-2',
      action: assessment.action,
      confirmation: {
        actionId: assessment.action.actionId,
        resolution: 'adjust-and-revalidate',
        acknowledgedAt: utcInstant('2026-07-20T02:00:00Z'),
        newVerifiedKpra: lengthInFeet(40),
        trailerAxleWeight: weightInPounds(32_000),
        driveAxleWeight: weightInPounds(33_000),
        totalGrossCombinationWeight: weightInPounds(77_000),
        loadDistributionConfirmed: true,
        measurementSource: 'Test-only physical tape measurement.',
      },
      evaluationInput,
    });

    expect(result.status).toBe('resolved');
    expect(result.legalFinalizationStatus).toBe('allowed');
    expect(result.revisedEvaluationInput?.equipment.trailer.currentKpra).toEqual(
      lengthInFeet(40),
    );
    expect(result.evidence.recalculationTripRevisionId).toBe('revision-2');
  });

  it('blocks after KPRA resolves when axle revalidation produces a warning', () => {
    const rules = [kpraRule('CA-KPRA-40', 40), axleRule(32_000)];
    const evaluationInput = input(rules, {
      equipment: equipment(42),
      segments: [
        segment('or-1', 'US-OR', 'I-5'),
        segment('ca-1', 'US-CA', 'I-5'),
      ],
      ruleSet: ruleSet(rules),
    });
    const assessment = assessKpraAdjustment({
      originalTripRevisionId: 'revision-1',
      evaluationInput,
      slidingTandemCapability: true,
      minimumAchievableKpra: lengthInFeet(37),
      maximumAchievableKpra: lengthInFeet(43),
    });
    if (assessment.action === undefined) throw new Error('Expected KPRA action.');

    const result = revalidateKpraAdjustment({
      originalTripRevisionId: 'revision-1',
      recalculationTripRevisionId: 'revision-2',
      action: assessment.action,
      confirmation: {
        actionId: assessment.action.actionId,
        resolution: 'adjust-and-revalidate',
        acknowledgedAt: utcInstant('2026-07-20T02:00:00Z'),
        newVerifiedKpra: lengthInFeet(40),
        trailerAxleWeight: weightInPounds(31_000),
        driveAxleWeight: weightInPounds(34_000),
        totalGrossCombinationWeight: weightInPounds(77_000),
        loadDistributionConfirmed: true,
        measurementSource: 'Test-only physical tape and scale measurement.',
      },
      evaluationInput,
    });

    expect(result.status).toBe('axle-revalidation-blocked');
    expect(result.legalFinalizationStatus).toBe('blocked');
    expect(
      result.complianceResult?.findings.some(
        (finding) => finding.category === 'axle-weight',
      ),
    ).toBe(true);
  });

  it('does not accept tandem movement without load-distribution confirmation', () => {
    const evaluationInput = excessiveInput();
    const assessment = assessKpraAdjustment({
      originalTripRevisionId: 'revision-1',
      evaluationInput,
      slidingTandemCapability: true,
      minimumAchievableKpra: lengthInFeet(37),
      maximumAchievableKpra: lengthInFeet(43),
    });
    if (assessment.action === undefined) throw new Error('Expected KPRA action.');

    const result = revalidateKpraAdjustment({
      originalTripRevisionId: 'revision-1',
      recalculationTripRevisionId: 'revision-2',
      action: assessment.action,
      confirmation: {
        actionId: assessment.action.actionId,
        resolution: 'adjust-and-revalidate',
        acknowledgedAt: utcInstant('2026-07-20T02:00:00Z'),
        newVerifiedKpra: lengthInFeet(40),
        trailerAxleWeight: weightInPounds(32_000),
        driveAxleWeight: weightInPounds(33_000),
        totalGrossCombinationWeight: weightInPounds(77_000),
        loadDistributionConfirmed: false,
        measurementSource: 'Test-only physical tape measurement.',
      },
      evaluationInput,
    });

    expect(result.status).toBe('confirmation-invalid');
    expect(result.legalFinalizationStatus).toBe('blocked');
  });
});
