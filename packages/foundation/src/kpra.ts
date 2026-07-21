import { z } from 'zod';

import {
  RegulatoryActionLocationSchema,
  RegulatoryComplianceResultSchema,
  RegulatorySourceSchema,
  validateRegulatoryComplianceResult,
} from './regulatory.js';
import type {
  RegulatoryActionLocation,
  RegulatoryComplianceResult,
  RegulatorySource,
} from './regulatory.js';
import { UtcInstantSchema } from './time.js';
import type { UtcInstant } from './time.js';
import { LengthSchema, WeightSchema } from './units.js';
import type { Length, Weight } from './units.js';

const nonEmptyText = z.string().trim().min(1);

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

export const KPRA_RESOLUTION_CHOICES = [
  'adjust-and-revalidate',
  'reroute',
] as const;
export type KpraResolutionChoice = (typeof KPRA_RESOLUTION_CHOICES)[number];

export const KPRA_REQUIRED_CONFIRMATIONS = [
  'vehicle.trailer.kpra',
  'load.trailer-axle-weight',
  'load.drive-axle-weight',
  'load.total-gross-combination-weight',
  'load.distribution-confirmed',
] as const;
export type KpraRequiredConfirmation =
  (typeof KPRA_REQUIRED_CONFIRMATIONS)[number];

export const KPRA_ASSESSMENT_STATUSES = [
  'no-kpra-action',
  'adjustment-required',
  'reroute-required',
  'manual-verification-required',
] as const;
export type KpraAssessmentStatus =
  (typeof KPRA_ASSESSMENT_STATUSES)[number];

export const KPRA_REVALIDATION_STATUSES = [
  'resolved',
  'adjustment-still-required',
  'axle-revalidation-blocked',
  'other-compliance-blocked',
  'reroute-required',
  'confirmation-invalid',
] as const;
export type KpraRevalidationStatus =
  (typeof KPRA_REVALIDATION_STATUSES)[number];

export const KpraAdjustmentActionSchema = z
  .object({
    actionId: nonEmptyText,
    originalTripRevisionId: nonEmptyText,
    routeId: nonEmptyText,
    findingId: nonEmptyText,
    ruleId: nonEmptyText,
    ruleSetVersion: nonEmptyText,
    ruleVersion: nonEmptyText,
    affectedSegmentId: nonEmptyText,
    jurisdictionCode: nonEmptyText,
    evaluatedAt: UtcInstantSchema,
    source: RegulatorySourceSchema,
    enteredKpra: LengthSchema,
    allowedKpra: LengthSchema,
    minimumAchievableKpra: LengthSchema.optional(),
    maximumAchievableKpra: LengthSchema.optional(),
    slidingTandemCapability: z.boolean(),
    actionLocation: RegulatoryActionLocationSchema.optional(),
    choices: z.array(z.enum(KPRA_RESOLUTION_CHOICES)).min(1),
    requiredConfirmations: z
      .array(z.enum(KPRA_REQUIRED_CONFIRMATIONS))
      .min(KPRA_REQUIRED_CONFIRMATIONS.length),
    warning: nonEmptyText,
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.choices).size !== value.choices.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['choices'],
        message: 'KPRA resolution choices must be unique.',
      });
    }
    if (
      new Set(value.requiredConfirmations).size !==
      value.requiredConfirmations.length
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['requiredConfirmations'],
        message: 'KPRA confirmation requirements must be unique.',
      });
    }
    for (const required of KPRA_REQUIRED_CONFIRMATIONS) {
      if (!value.requiredConfirmations.includes(required)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['requiredConfirmations'],
          message: `Missing required KPRA confirmation fact ${required}.`,
        });
      }
    }
    if (value.enteredKpra.value <= value.allowedKpra.value) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['enteredKpra'],
        message: 'A KPRA adjustment action requires entered KPRA above the allowed KPRA.',
      });
    }
    if (
      value.minimumAchievableKpra !== undefined &&
      value.maximumAchievableKpra !== undefined &&
      value.minimumAchievableKpra.value > value.maximumAchievableKpra.value
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minimumAchievableKpra'],
        message: 'Minimum achievable KPRA cannot exceed maximum achievable KPRA.',
      });
    }
  });

export interface KpraAdjustmentAction {
  readonly actionId: string;
  readonly originalTripRevisionId: string;
  readonly routeId: string;
  readonly findingId: string;
  readonly ruleId: string;
  readonly ruleSetVersion: string;
  readonly ruleVersion: string;
  readonly affectedSegmentId: string;
  readonly jurisdictionCode: string;
  readonly evaluatedAt: UtcInstant;
  readonly source: RegulatorySource;
  readonly enteredKpra: Length;
  readonly allowedKpra: Length;
  readonly minimumAchievableKpra?: Length;
  readonly maximumAchievableKpra?: Length;
  readonly slidingTandemCapability: boolean;
  readonly actionLocation?: RegulatoryActionLocation;
  readonly choices: readonly KpraResolutionChoice[];
  readonly requiredConfirmations: readonly KpraRequiredConfirmation[];
  readonly warning: string;
}

export type KpraAdjustmentConfirmation =
  | Readonly<{
      actionId: string;
      resolution: 'adjust-and-revalidate';
      acknowledgedAt: UtcInstant;
      newVerifiedKpra: Length;
      trailerAxleWeight: Weight;
      driveAxleWeight: Weight;
      totalGrossCombinationWeight: Weight;
      loadDistributionConfirmed: boolean;
      measurementSource: string;
      note?: string;
    }>
  | Readonly<{
      actionId: string;
      resolution: 'reroute';
      acknowledgedAt: UtcInstant;
      note?: string;
    }>;

export const KpraAdjustmentConfirmationSchema = z.discriminatedUnion(
  'resolution',
  [
    z
      .object({
        actionId: nonEmptyText,
        resolution: z.literal('adjust-and-revalidate'),
        acknowledgedAt: UtcInstantSchema,
        newVerifiedKpra: LengthSchema,
        trailerAxleWeight: WeightSchema,
        driveAxleWeight: WeightSchema,
        totalGrossCombinationWeight: WeightSchema,
        loadDistributionConfirmed: z.boolean(),
        measurementSource: nonEmptyText,
        note: nonEmptyText.optional(),
      })
      .strict(),
    z
      .object({
        actionId: nonEmptyText,
        resolution: z.literal('reroute'),
        acknowledgedAt: UtcInstantSchema,
        note: nonEmptyText.optional(),
      })
      .strict(),
  ],
);

export interface KpraAdjustmentAssessment {
  readonly status: KpraAssessmentStatus;
  readonly legalFinalizationStatus: 'allowed' | 'blocked';
  readonly complianceResult: RegulatoryComplianceResult;
  readonly action?: KpraAdjustmentAction;
  readonly explanations: readonly string[];
}

export interface KpraAdjustmentEvidence {
  readonly originalTripRevisionId: string;
  readonly recalculationTripRevisionId: string;
  readonly action: KpraAdjustmentAction;
  readonly confirmation: KpraAdjustmentConfirmation;
  readonly status: KpraRevalidationStatus;
  readonly legalFinalizationStatus: 'allowed' | 'blocked';
  readonly recalculatedAt: UtcInstant;
  readonly complianceResult?: RegulatoryComplianceResult;
  readonly explanations: readonly string[];
}

export const KpraAdjustmentEvidenceSchema = z
  .object({
    originalTripRevisionId: nonEmptyText,
    recalculationTripRevisionId: nonEmptyText,
    action: KpraAdjustmentActionSchema,
    confirmation: KpraAdjustmentConfirmationSchema,
    status: z.enum(KPRA_REVALIDATION_STATUSES),
    legalFinalizationStatus: z.enum(['allowed', 'blocked']),
    recalculatedAt: UtcInstantSchema,
    complianceResult: RegulatoryComplianceResultSchema.optional(),
    explanations: z.array(nonEmptyText).min(1),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.originalTripRevisionId === value.recalculationTripRevisionId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recalculationTripRevisionId'],
        message: 'KPRA revalidation must create a new immutable trip revision.',
      });
    }
    if (value.action.originalTripRevisionId !== value.originalTripRevisionId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['action', 'originalTripRevisionId'],
        message: 'The KPRA action must reference the original trip revision.',
      });
    }
    if (value.confirmation.actionId !== value.action.actionId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmation', 'actionId'],
        message: 'The acknowledgement must reference the KPRA action.',
      });
    }
    if (
      value.confirmation.resolution === 'reroute' &&
      value.status !== 'reroute-required'
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['status'],
        message: 'A reroute acknowledgement must remain reroute-required.',
      });
    }
    if (
      value.confirmation.resolution === 'adjust-and-revalidate' &&
      value.status === 'resolved' &&
      value.complianceResult === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['complianceResult'],
        message: 'Resolved KPRA revalidation requires the rerun compliance result.',
      });
    }
    if (
      value.legalFinalizationStatus === 'allowed' &&
      value.status !== 'resolved'
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['legalFinalizationStatus'],
        message: 'Only a resolved KPRA revalidation may allow legal finalization.',
      });
    }
  });

export function validateKpraAdjustmentAction(
  input: unknown,
): KpraAdjustmentAction {
  const value = KpraAdjustmentActionSchema.parse(input);
  return freeze({
    actionId: value.actionId,
    originalTripRevisionId: value.originalTripRevisionId,
    routeId: value.routeId,
    findingId: value.findingId,
    ruleId: value.ruleId,
    ruleSetVersion: value.ruleSetVersion,
    ruleVersion: value.ruleVersion,
    affectedSegmentId: value.affectedSegmentId,
    jurisdictionCode: value.jurisdictionCode,
    evaluatedAt: value.evaluatedAt,
    source: freeze(value.source),
    enteredKpra: value.enteredKpra,
    allowedKpra: value.allowedKpra,
    ...(value.minimumAchievableKpra === undefined
      ? {}
      : { minimumAchievableKpra: value.minimumAchievableKpra }),
    ...(value.maximumAchievableKpra === undefined
      ? {}
      : { maximumAchievableKpra: value.maximumAchievableKpra }),
    slidingTandemCapability: value.slidingTandemCapability,
    ...(value.actionLocation === undefined
      ? {}
      : { actionLocation: freeze(value.actionLocation) }),
    choices: freezeArray(value.choices),
    requiredConfirmations: freezeArray(value.requiredConfirmations),
    warning: value.warning,
  });
}

export function validateKpraAdjustmentConfirmation(
  input: unknown,
): KpraAdjustmentConfirmation {
  const value = KpraAdjustmentConfirmationSchema.parse(input);
  if (value.resolution === 'reroute') {
    return freeze({
      actionId: value.actionId,
      resolution: value.resolution,
      acknowledgedAt: value.acknowledgedAt,
      ...(value.note === undefined ? {} : { note: value.note }),
    });
  }
  return freeze({
    actionId: value.actionId,
    resolution: value.resolution,
    acknowledgedAt: value.acknowledgedAt,
    newVerifiedKpra: value.newVerifiedKpra,
    trailerAxleWeight: value.trailerAxleWeight,
    driveAxleWeight: value.driveAxleWeight,
    totalGrossCombinationWeight: value.totalGrossCombinationWeight,
    loadDistributionConfirmed: value.loadDistributionConfirmed,
    measurementSource: value.measurementSource,
    ...(value.note === undefined ? {} : { note: value.note }),
  });
}

export function validateKpraAdjustmentEvidence(
  input: unknown,
): KpraAdjustmentEvidence {
  const value = KpraAdjustmentEvidenceSchema.parse(input);
  return freeze({
    originalTripRevisionId: value.originalTripRevisionId,
    recalculationTripRevisionId: value.recalculationTripRevisionId,
    action: validateKpraAdjustmentAction(value.action),
    confirmation: validateKpraAdjustmentConfirmation(value.confirmation),
    status: value.status,
    legalFinalizationStatus: value.legalFinalizationStatus,
    recalculatedAt: value.recalculatedAt,
    ...(value.complianceResult === undefined
      ? {}
      : {
          complianceResult: validateRegulatoryComplianceResult(
            value.complianceResult,
          ),
        }),
    explanations: freezeArray(value.explanations),
  });
}

export function kpraAdjustmentEvidenceSnapshot(
  input: KpraAdjustmentEvidence,
): Readonly<Record<string, unknown>> {
  const value = validateKpraAdjustmentEvidence(input);
  return freeze({
    originalTripRevisionId: value.originalTripRevisionId,
    recalculationTripRevisionId: value.recalculationTripRevisionId,
    action: value.action,
    confirmation: value.confirmation,
    status: value.status,
    legalFinalizationStatus: value.legalFinalizationStatus,
    recalculatedAt: value.recalculatedAt,
    ...(value.complianceResult === undefined
      ? {}
      : { complianceResult: value.complianceResult }),
    explanations: value.explanations,
  });
}
