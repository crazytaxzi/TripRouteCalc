import {
  KPRA_REQUIRED_CONFIRMATIONS,
  LengthSchema,
  validateKpraAdjustmentAction,
  validateKpraAdjustmentConfirmation,
} from '@trip-route-calc/foundation';
import type {
  KpraAdjustmentAction,
  KpraAdjustmentAssessment,
  KpraAdjustmentConfirmation,
  KpraAdjustmentEvidence,
  KpraRevalidationStatus,
  Length,
  Weight,
} from '@trip-route-calc/foundation';
import {
  validateRegulatoryEvaluationInput,
} from '@trip-route-calc/foundation/regulatory';
import type {
  RegulatoryComplianceFinding,
  RegulatoryComplianceResult,
  RegulatoryEvaluationInput,
} from '@trip-route-calc/foundation/regulatory';

import { evaluateRegulatoryCompliance } from './regulatory-engine.js';

export interface AssessKpraAdjustmentInput {
  readonly originalTripRevisionId: string;
  readonly evaluationInput: RegulatoryEvaluationInput;
  readonly slidingTandemCapability: boolean;
  readonly minimumAchievableKpra?: Length;
  readonly maximumAchievableKpra?: Length;
}

export interface RevalidateKpraAdjustmentInput {
  readonly originalTripRevisionId: string;
  readonly recalculationTripRevisionId: string;
  readonly action: KpraAdjustmentAction;
  readonly confirmation: KpraAdjustmentConfirmation;
  readonly evaluationInput: RegulatoryEvaluationInput;
}

export interface KpraRevalidationResult {
  readonly status: KpraRevalidationStatus;
  readonly legalFinalizationStatus: 'allowed' | 'blocked';
  readonly evidence: KpraAdjustmentEvidence;
  readonly revisedEvaluationInput?: RegulatoryEvaluationInput;
  readonly complianceResult?: RegulatoryComplianceResult;
  readonly explanations: readonly string[];
}

interface ParsedKpraFinding {
  readonly finding: RegulatoryComplianceFinding;
  readonly allowedKpra: Length;
}

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

function parseExpectedKpra(
  finding: RegulatoryComplianceFinding,
): Length | undefined {
  const value = finding.inputFacts['vehicle.trailer.kpra.expected'];
  const parsed = LengthSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function strictestKpraFinding(
  findings: readonly RegulatoryComplianceFinding[],
): ParsedKpraFinding | undefined {
  const parsed = findings.flatMap((finding) => {
    const allowedKpra = parseExpectedKpra(finding);
    return allowedKpra === undefined ? [] : [{ finding, allowedKpra }];
  });
  return parsed.reduce<ParsedKpraFinding | undefined>(
    (strictest, candidate) =>
      strictest === undefined ||
      candidate.allowedKpra.value < strictest.allowedKpra.value
        ? candidate
        : strictest,
    undefined,
  );
}

function formatLength(value: Length): string {
  const totalInches = value.value;
  const wholeFeet = Math.floor(totalInches / 12);
  const remainingInches = Math.round((totalInches - wholeFeet * 12) * 100) / 100;
  return remainingInches === 0
    ? `${String(wholeFeet)} ft`
    : `${String(wholeFeet)} ft ${String(remainingInches)} in`;
}

function actionWarning(
  enteredKpra: Length,
  allowedKpra: Length,
  affectedSegmentId: string,
  canAdjust: boolean,
): string {
  const resolution = canAdjust
    ? `Move the sliding tandem to achieve a verified KPRA of ${formatLength(allowedKpra)} or less, confirm axle weights and load distribution remain acceptable, or select another verified route.`
    : 'The entered configuration cannot be confirmed adjustable to the supported limit; select another verified route.';
  return `Route compliance action required before segment ${affectedSegmentId}. Entered kingpin-to-rearmost-axle measurement: ${formatLength(enteredKpra)}. Maximum supported by the selected segment: ${formatLength(allowedKpra)}. ${resolution}`;
}

function buildAction(
  input: AssessKpraAdjustmentInput,
  parsed: ParsedKpraFinding,
): KpraAdjustmentAction {
  const enteredKpra = input.evaluationInput.equipment.trailer.currentKpra;
  const canAdjust =
    input.slidingTandemCapability &&
    input.minimumAchievableKpra !== undefined &&
    input.minimumAchievableKpra.value <= parsed.allowedKpra.value;
  const finding = parsed.finding;
  if (
    finding.ruleId === undefined ||
    finding.effectiveRuleVersion === undefined
  ) {
    throw new RangeError(
      'A KPRA adjustment action requires a sourced rule identifier and version.',
    );
  }

  return validateKpraAdjustmentAction({
    actionId: `kpra:${input.originalTripRevisionId}:${finding.findingId}`,
    originalTripRevisionId: input.originalTripRevisionId,
    routeId: input.evaluationInput.routeId,
    findingId: finding.findingId,
    ruleId: finding.ruleId,
    ruleSetVersion: finding.ruleSetVersion,
    ruleVersion: finding.effectiveRuleVersion,
    affectedSegmentId: finding.affectedSegmentId,
    jurisdictionCode: finding.jurisdictionCode,
    evaluatedAt: input.evaluationInput.evaluationAt,
    source: finding.source,
    enteredKpra,
    allowedKpra: parsed.allowedKpra,
    ...(input.minimumAchievableKpra === undefined
      ? {}
      : { minimumAchievableKpra: input.minimumAchievableKpra }),
    ...(input.maximumAchievableKpra === undefined
      ? {}
      : { maximumAchievableKpra: input.maximumAchievableKpra }),
    slidingTandemCapability: input.slidingTandemCapability,
    ...(finding.actionLocation === undefined
      ? {}
      : { actionLocation: finding.actionLocation }),
    choices: canAdjust
      ? ['adjust-and-revalidate', 'reroute']
      : ['reroute'],
    requiredConfirmations: KPRA_REQUIRED_CONFIRMATIONS,
    warning: actionWarning(
      enteredKpra,
      parsed.allowedKpra,
      finding.affectedSegmentId,
      canAdjust,
    ),
  });
}

export function assessKpraAdjustment(
  inputValue: AssessKpraAdjustmentInput,
): KpraAdjustmentAssessment {
  const evaluationInput = validateRegulatoryEvaluationInput(
    inputValue.evaluationInput,
  );
  const input: AssessKpraAdjustmentInput = {
    ...inputValue,
    evaluationInput,
  };
  const complianceResult = evaluateRegulatoryCompliance(evaluationInput);
  const kpraFindings = complianceResult.findings.filter(
    (finding) => finding.category === 'kpra' && finding.blocksRouteFinalization,
  );

  if (kpraFindings.length === 0) {
    return freeze({
      status: 'no-kpra-action',
      legalFinalizationStatus: complianceResult.legalFinalizationStatus,
      complianceResult,
      explanations: freezeArray([
        'No active segment-specific KPRA rule produced a blocking action for the entered physical measurement.',
        ...(complianceResult.legalFinalizationStatus === 'blocked'
          ? ['Other compliance findings still block legal finalization.']
          : []),
      ]),
    });
  }

  const strictest = strictestKpraFinding(kpraFindings);
  if (strictest === undefined) {
    return freeze({
      status: 'manual-verification-required',
      legalFinalizationStatus: 'blocked',
      complianceResult,
      explanations: freezeArray([
        'A KPRA finding did not preserve the sourced maximum as a typed length fact.',
        'Manual regulatory verification is required before the route can be finalized.',
      ]),
    });
  }

  let action: KpraAdjustmentAction;
  try {
    action = buildAction(input, strictest);
  } catch (error) {
    return freeze({
      status: 'manual-verification-required',
      legalFinalizationStatus: 'blocked',
      complianceResult,
      explanations: freezeArray([
        error instanceof Error
          ? error.message
          : 'The sourced KPRA action could not be constructed.',
        'Manual regulatory verification is required before the route can be finalized.',
      ]),
    });
  }

  const canAdjust = action.choices.includes('adjust-and-revalidate');
  return freeze({
    status: canAdjust ? 'adjustment-required' : 'reroute-required',
    legalFinalizationStatus: 'blocked',
    complianceResult,
    action,
    explanations: freezeArray([
      action.warning,
      canAdjust
        ? 'Adjustment does not establish legality until a new verified KPRA, axle weights, total gross weight, and load-distribution confirmation are revalidated in a new trip revision.'
        : 'The entered trailer configuration cannot be confirmed adjustable to the strictest selected-segment limit.',
    ]),
  });
}

function revisedEvaluationInput(
  input: RegulatoryEvaluationInput,
  confirmation: Extract<
    KpraAdjustmentConfirmation,
    { readonly resolution: 'adjust-and-revalidate' }
  >,
): RegulatoryEvaluationInput {
  return validateRegulatoryEvaluationInput({
    ...input,
    evaluationAt: confirmation.acknowledgedAt,
    equipment: {
      ...input.equipment,
      trailer: {
        ...input.equipment.trailer,
        currentKpra: confirmation.newVerifiedKpra,
      },
      load: {
        ...input.equipment.load,
        driveAxleWeight: confirmation.driveAxleWeight,
        trailerAxleWeight: confirmation.trailerAxleWeight,
        totalGrossCombinationWeight:
          confirmation.totalGrossCombinationWeight,
      },
    },
  });
}

function weightTotalIsConsistent(
  steer: Weight,
  drive: Weight,
  trailer: Weight,
  total: Weight,
): boolean {
  return total.value >= steer.value + drive.value + trailer.value;
}

function buildEvidence(
  input: RevalidateKpraAdjustmentInput,
  confirmation: KpraAdjustmentConfirmation,
  status: KpraRevalidationStatus,
  legalFinalizationStatus: 'allowed' | 'blocked',
  explanations: readonly string[],
  complianceResult?: RegulatoryComplianceResult,
): KpraAdjustmentEvidence {
  return freeze({
    originalTripRevisionId: input.originalTripRevisionId,
    recalculationTripRevisionId: input.recalculationTripRevisionId,
    action: input.action,
    confirmation,
    status,
    legalFinalizationStatus,
    recalculatedAt: confirmation.acknowledgedAt,
    ...(complianceResult === undefined ? {} : { complianceResult }),
    explanations: freezeArray(explanations),
  });
}

export function revalidateKpraAdjustment(
  inputValue: RevalidateKpraAdjustmentInput,
): KpraRevalidationResult {
  const action = validateKpraAdjustmentAction(inputValue.action);
  const confirmation = validateKpraAdjustmentConfirmation(
    inputValue.confirmation,
  );
  const evaluationInput = validateRegulatoryEvaluationInput(
    inputValue.evaluationInput,
  );
  const input: RevalidateKpraAdjustmentInput = {
    ...inputValue,
    action,
    confirmation,
    evaluationInput,
  };

  const baseProblems: string[] = [];
  if (input.originalTripRevisionId !== action.originalTripRevisionId) {
    baseProblems.push('The revalidation does not reference the action original revision.');
  }
  if (
    input.recalculationTripRevisionId === input.originalTripRevisionId
  ) {
    baseProblems.push('KPRA revalidation requires a new immutable trip revision.');
  }
  if (confirmation.actionId !== action.actionId) {
    baseProblems.push('The acknowledgement does not reference the selected KPRA action.');
  }
  if (
    evaluationInput.routeId !== action.routeId ||
    evaluationInput.ruleSet.version !== action.ruleSetVersion
  ) {
    baseProblems.push(
      'The revalidation route and rule-set version must match the action evidence.',
    );
  }

  if (confirmation.resolution === 'reroute') {
    const explanations = freezeArray([
      ...baseProblems,
      'Rerouting was selected. The original route remains blocked until a newly verified route is evaluated in a new revision.',
    ]);
    const evidence = buildEvidence(
      input,
      confirmation,
      'reroute-required',
      'blocked',
      explanations,
    );
    return freeze({
      status: 'reroute-required',
      legalFinalizationStatus: 'blocked',
      evidence,
      explanations,
    });
  }

  if (confirmation.newVerifiedKpra.value > action.allowedKpra.value) {
    baseProblems.push(
      `Verified KPRA ${formatLength(confirmation.newVerifiedKpra)} still exceeds the selected-segment maximum ${formatLength(action.allowedKpra)}.`,
    );
  }
  if (
    action.minimumAchievableKpra !== undefined &&
    confirmation.newVerifiedKpra.value <
      action.minimumAchievableKpra.value
  ) {
    baseProblems.push('Verified KPRA is below the recorded physically achievable range.');
  }
  if (
    action.maximumAchievableKpra !== undefined &&
    confirmation.newVerifiedKpra.value >
      action.maximumAchievableKpra.value
  ) {
    baseProblems.push('Verified KPRA is above the recorded physically achievable range.');
  }
  if (!confirmation.loadDistributionConfirmed) {
    baseProblems.push(
      'Load distribution was not confirmed after tandem movement.',
    );
  }
  if (
    !weightTotalIsConsistent(
      evaluationInput.equipment.load.steerAxleWeight,
      confirmation.driveAxleWeight,
      confirmation.trailerAxleWeight,
      confirmation.totalGrossCombinationWeight,
    )
  ) {
    baseProblems.push(
      'Total gross combination weight is below the sum of the confirmed axle weights.',
    );
  }

  if (baseProblems.length > 0) {
    const explanations = freezeArray([
      ...baseProblems,
      'Legal finalization remains blocked until every post-adjustment confirmation is valid.',
    ]);
    const evidence = buildEvidence(
      input,
      confirmation,
      'confirmation-invalid',
      'blocked',
      explanations,
    );
    return freeze({
      status: 'confirmation-invalid',
      legalFinalizationStatus: 'blocked',
      evidence,
      explanations,
    });
  }

  const revisedInput = revisedEvaluationInput(evaluationInput, confirmation);
  const complianceResult = evaluateRegulatoryCompliance(revisedInput);
  const blockingKpra = complianceResult.findings.some(
    (finding) => finding.category === 'kpra' && finding.blocksRouteFinalization,
  );
  const axleFindings = complianceResult.findings.filter((finding) =>
    ['axle-weight', 'gross-weight', 'bridge-weight'].includes(finding.category),
  );
  const blockingAxle = axleFindings.some(
    (finding) => finding.blocksRouteFinalization,
  );

  let status: KpraRevalidationStatus;
  if (blockingKpra) {
    status = 'adjustment-still-required';
  } else if (blockingAxle) {
    status = 'axle-revalidation-blocked';
  } else if (complianceResult.legalFinalizationStatus === 'blocked') {
    status = 'other-compliance-blocked';
  } else {
    status = 'resolved';
  }
  const legalFinalizationStatus =
    status === 'resolved' ? 'allowed' : 'blocked';
  const explanations = freezeArray([
    `The measured KPRA and confirmed axle facts were re-evaluated against rule set ${action.ruleSetVersion}.`,
    ...(axleFindings.length > 0
      ? [
          `Post-adjustment axle revalidation produced ${String(axleFindings.length)} axle or weight finding(s).`,
        ]
      : ['Post-adjustment axle revalidation produced no axle or weight finding.']),
    ...(status === 'resolved'
      ? ['The KPRA action is resolved on the new revision.']
      : ['The new revision remains blocked by the stated compliance findings.']),
  ]);
  const evidence = buildEvidence(
    input,
    confirmation,
    status,
    legalFinalizationStatus,
    explanations,
    complianceResult,
  );

  return freeze({
    status,
    legalFinalizationStatus,
    evidence,
    revisedEvaluationInput: revisedInput,
    complianceResult,
    explanations,
  });
}
