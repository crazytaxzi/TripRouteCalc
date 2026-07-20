import { z } from 'zod';

import {
  CommercialRouteEquipmentSchema,
  CommercialRouteSegmentSchema,
} from './commercial-routing.js';
import type {
  CommercialRouteEquipment,
} from './commercial-routing.js';
import { UtcInstantSchema } from './time.js';
import type { UtcInstant } from './time.js';
import { LengthSchema, WeightSchema } from './units.js';
import type { Length, Weight } from './units.js';

const nonEmptyText = z.string().trim().min(1);
const safeNonNegativeInteger = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

export const REGULATORY_RULE_SEVERITIES = [
  'information',
  'advisory',
  'action-required',
  'route-restricted',
  'route-illegal',
  'manual-verification-required',
] as const;
export type RegulatoryRuleSeverity =
  (typeof REGULATORY_RULE_SEVERITIES)[number];

export const REGULATORY_RULE_SET_STATUSES = [
  'draft',
  'active',
  'inactive',
] as const;
export type RegulatoryRuleSetStatus =
  (typeof REGULATORY_RULE_SET_STATUSES)[number];

export const REGULATORY_AUTHORITY_TYPES = [
  'federal-regulation',
  'federal-agency',
  'state-legislature',
  'state-dot',
  'commercial-vehicle-enforcement',
  'municipal-ordinance',
  'permit-authority',
  'official-route-map',
  'contracted-commercial-routing',
  'other-official-authority',
] as const;
export type RegulatoryAuthorityType =
  (typeof REGULATORY_AUTHORITY_TYPES)[number];

export const REGULATORY_VEHICLE_TYPES = [
  'tractor-semitrailer',
  'straight-truck',
  'doubles',
  'triples',
  'passenger-carrying',
  'other-cmv',
] as const;
export type RegulatoryVehicleType =
  (typeof REGULATORY_VEHICLE_TYPES)[number];

export const REGULATORY_RULE_CATEGORIES = [
  'vehicle-dimension',
  'kpra',
  'axle-weight',
  'gross-weight',
  'bridge-weight',
  'low-clearance',
  'truck-route',
  'local-access',
  'hazmat',
  'permit',
  'seasonal',
  'closure',
  'inspection',
  'operating-time',
  'other',
] as const;
export type RegulatoryRuleCategory =
  (typeof REGULATORY_RULE_CATEGORIES)[number];

export const REGULATORY_DIRECTIONS = [
  'northbound',
  'southbound',
  'eastbound',
  'westbound',
  'both',
  'unknown',
] as const;
export type RegulatoryDirection = (typeof REGULATORY_DIRECTIONS)[number];

export const REGULATORY_COMPARISON_OPERATORS = [
  'greater-than',
  'greater-than-or-equal',
  'less-than',
  'less-than-or-equal',
  'equal',
  'not-equal',
] as const;
export type RegulatoryComparisonOperator =
  (typeof REGULATORY_COMPARISON_OPERATORS)[number];

export const REGULATORY_STRING_FACTS = [
  'segment.jurisdiction-code',
  'segment.road-identity',
  'segment.direction',
  'load.hazmat-class',
] as const;
export type RegulatoryStringFact =
  (typeof REGULATORY_STRING_FACTS)[number];

export const REGULATORY_BOOLEAN_FACTS = [
  'load.hazmat',
  'segment.local-access-verified',
] as const;
export type RegulatoryBooleanFact =
  (typeof REGULATORY_BOOLEAN_FACTS)[number];

export const REGULATORY_LENGTH_FACTS = [
  'vehicle.tractor.overall-length',
  'vehicle.tractor.height',
  'vehicle.tractor.width',
  'vehicle.trailer.length',
  'vehicle.trailer.height',
  'vehicle.trailer.width',
  'vehicle.trailer.kpra',
  'vehicle.combined.overall-length',
  'vehicle.combined.height',
  'vehicle.combined.width',
  'load.length',
  'load.height',
  'load.width',
  'load.front-overhang',
  'load.rear-overhang',
] as const;
export type RegulatoryLengthFact =
  (typeof REGULATORY_LENGTH_FACTS)[number];

export const REGULATORY_WEIGHT_FACTS = [
  'load.steer-axle-weight',
  'load.drive-axle-weight',
  'load.trailer-axle-weight',
  'load.total-gross-combination-weight',
] as const;
export type RegulatoryWeightFact =
  (typeof REGULATORY_WEIGHT_FACTS)[number];

export const REGULATORY_INTEGER_FACTS = [
  'vehicle.total-axle-count',
  'vehicle.trailer-count',
  'vehicle.tractor-axle-count',
  'vehicle.trailer-axle-count',
] as const;
export type RegulatoryIntegerFact =
  (typeof REGULATORY_INTEGER_FACTS)[number];

export const RegulatorySourceSchema = z
  .object({
    authorityType: z.enum(REGULATORY_AUTHORITY_TYPES),
    authorityName: nonEmptyText,
    title: nonEmptyText,
    reference: nonEmptyText,
    retrievedAt: UtcInstantSchema,
    version: nonEmptyText,
    lastVerifiedAt: UtcInstantSchema,
  })
  .strict();
export type RegulatorySource = Readonly<
  z.infer<typeof RegulatorySourceSchema>
>;

export const RegulatoryRequiredActionSchema = z
  .object({
    code: nonEmptyText,
    instruction: nonEmptyText,
    mustCompleteBeforeSegment: z.boolean(),
    requiredUpdatedFacts: z.array(nonEmptyText).default([]),
  })
  .strict();
export type RegulatoryRequiredAction = Readonly<
  z.infer<typeof RegulatoryRequiredActionSchema>
>;

export const RegulatoryRoadScopeSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('jurisdiction-wide'),
      jurisdictionCodes: z.array(nonEmptyText).min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('road-identity'),
      roadIdentities: z.array(nonEmptyText).min(1),
      directions: z.array(z.enum(REGULATORY_DIRECTIONS)).default([]),
    })
    .strict(),
  z
    .object({
      kind: z.literal('segment'),
      segmentIds: z.array(nonEmptyText).min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('geometry-bounds'),
      west: z.number().finite().min(-180).max(180),
      east: z.number().finite().min(-180).max(180),
      south: z.number().finite().min(-90).max(90),
      north: z.number().finite().min(-90).max(90),
    })
    .strict()
    .refine((value) => value.west <= value.east && value.south <= value.north, {
      message:
        'Regulatory geometry bounds must be ordered west-to-east and south-to-north.',
    }),
]);
export type RegulatoryRoadScope =
  | Readonly<{ kind: 'jurisdiction-wide'; jurisdictionCodes: readonly string[] }>
  | Readonly<{
      kind: 'road-identity';
      roadIdentities: readonly string[];
      directions: readonly RegulatoryDirection[];
    }>
  | Readonly<{ kind: 'segment'; segmentIds: readonly string[] }>
  | Readonly<{
      kind: 'geometry-bounds';
      west: number;
      east: number;
      south: number;
      north: number;
    }>;

export interface RegulatoryAllCondition {
  readonly kind: 'all';
  readonly conditions: readonly RegulatoryCondition[];
}

export interface RegulatoryAnyCondition {
  readonly kind: 'any';
  readonly conditions: readonly RegulatoryCondition[];
}

export interface RegulatoryNotCondition {
  readonly kind: 'not';
  readonly condition: RegulatoryCondition;
}

export interface RegulatoryStringCondition {
  readonly kind: 'string';
  readonly fact: RegulatoryStringFact;
  readonly operator: 'equal' | 'not-equal' | 'in';
  readonly value: string | readonly string[];
}

export interface RegulatoryBooleanCondition {
  readonly kind: 'boolean';
  readonly fact: RegulatoryBooleanFact;
  readonly value: boolean;
}

export interface RegulatoryLengthCondition {
  readonly kind: 'length';
  readonly fact: RegulatoryLengthFact;
  readonly operator: RegulatoryComparisonOperator;
  readonly value: Length;
}

export interface RegulatoryWeightCondition {
  readonly kind: 'weight';
  readonly fact: RegulatoryWeightFact;
  readonly operator: RegulatoryComparisonOperator;
  readonly value: Weight;
}

export interface RegulatoryIntegerCondition {
  readonly kind: 'integer';
  readonly fact: RegulatoryIntegerFact;
  readonly operator: RegulatoryComparisonOperator;
  readonly value: number;
}

export interface RegulatoryPermitCondition {
  readonly kind: 'permit';
  readonly operator: 'contains' | 'missing' | 'present';
  readonly permitIdentifier?: string;
}

export interface RegulatoryTimeWindowCondition {
  readonly kind: 'time-window';
  readonly startsAt: UtcInstant;
  readonly endsAt: UtcInstant;
}

export type RegulatoryCondition =
  | RegulatoryAllCondition
  | RegulatoryAnyCondition
  | RegulatoryNotCondition
  | RegulatoryStringCondition
  | RegulatoryBooleanCondition
  | RegulatoryLengthCondition
  | RegulatoryWeightCondition
  | RegulatoryIntegerCondition
  | RegulatoryPermitCondition
  | RegulatoryTimeWindowCondition;

const RegulatoryConditionSchemaInternal: z.ZodType<RegulatoryCondition> = z.lazy(
  () =>
    z.discriminatedUnion('kind', [
      z
        .object({
          kind: z.literal('all'),
          conditions: z.array(RegulatoryConditionSchemaInternal).min(1),
        })
        .strict(),
      z
        .object({
          kind: z.literal('any'),
          conditions: z.array(RegulatoryConditionSchemaInternal).min(1),
        })
        .strict(),
      z
        .object({
          kind: z.literal('not'),
          condition: RegulatoryConditionSchemaInternal,
        })
        .strict(),
      z
        .object({
          kind: z.literal('string'),
          fact: z.enum(REGULATORY_STRING_FACTS),
          operator: z.enum(['equal', 'not-equal', 'in']),
          value: z.union([nonEmptyText, z.array(nonEmptyText).min(1)]),
        })
        .strict(),
      z
        .object({
          kind: z.literal('boolean'),
          fact: z.enum(REGULATORY_BOOLEAN_FACTS),
          value: z.boolean(),
        })
        .strict(),
      z
        .object({
          kind: z.literal('length'),
          fact: z.enum(REGULATORY_LENGTH_FACTS),
          operator: z.enum(REGULATORY_COMPARISON_OPERATORS),
          value: LengthSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal('weight'),
          fact: z.enum(REGULATORY_WEIGHT_FACTS),
          operator: z.enum(REGULATORY_COMPARISON_OPERATORS),
          value: WeightSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal('integer'),
          fact: z.enum(REGULATORY_INTEGER_FACTS),
          operator: z.enum(REGULATORY_COMPARISON_OPERATORS),
          value: safeNonNegativeInteger,
        })
        .strict(),
      z
        .object({
          kind: z.literal('permit'),
          operator: z.enum(['contains', 'missing', 'present']),
          permitIdentifier: nonEmptyText.optional(),
        })
        .strict()
        .superRefine((value, context) => {
          if (
            value.operator === 'contains' &&
            value.permitIdentifier === undefined
          ) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['permitIdentifier'],
              message:
                'A contains permit condition requires a permit identifier.',
            });
          }
        }),
      z
        .object({
          kind: z.literal('time-window'),
          startsAt: UtcInstantSchema,
          endsAt: UtcInstantSchema,
        })
        .strict()
        .refine(
          (value) => Date.parse(value.startsAt) < Date.parse(value.endsAt),
          { message: 'A regulatory time window must end after it starts.' },
        ),
    ]),
);

export const RegulatoryConditionSchema = RegulatoryConditionSchemaInternal;

export const JurisdictionRuleSchema = z
  .object({
    ruleId: nonEmptyText,
    jurisdictionCode: nonEmptyText,
    category: z.enum(REGULATORY_RULE_CATEGORIES),
    affectedVehicleTypes: z.array(z.enum(REGULATORY_VEHICLE_TYPES)).min(1),
    roadScope: RegulatoryRoadScopeSchema,
    effectiveFrom: UtcInstantSchema,
    effectiveTo: UtcInstantSchema.optional(),
    source: RegulatorySourceSchema,
    explanation: nonEmptyText,
    condition: RegulatoryConditionSchema,
    requiredAction: RegulatoryRequiredActionSchema,
    severity: z.enum(REGULATORY_RULE_SEVERITIES),
    blocksRouteFinalization: z.boolean(),
    requiresManualVerification: z.boolean(),
    active: z.boolean(),
    version: nonEmptyText,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.effectiveTo !== undefined &&
      Date.parse(value.effectiveFrom) >= Date.parse(value.effectiveTo)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['effectiveTo'],
        message: 'A jurisdiction rule must expire after it becomes effective.',
      });
    }
    if (
      (value.severity === 'route-restricted' ||
        value.severity === 'route-illegal' ||
        value.severity === 'manual-verification-required') &&
      !value.blocksRouteFinalization
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['blocksRouteFinalization'],
        message:
          'Restricted, illegal, and manual-verification findings must block finalization.',
      });
    }
    if (
      value.severity === 'manual-verification-required' &&
      !value.requiresManualVerification
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['requiresManualVerification'],
        message:
          'Manual-verification severity must require manual verification.',
      });
    }
  });
export interface JurisdictionRule {
  readonly ruleId: string;
  readonly jurisdictionCode: string;
  readonly category: RegulatoryRuleCategory;
  readonly affectedVehicleTypes: readonly RegulatoryVehicleType[];
  readonly roadScope: RegulatoryRoadScope;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveTo?: UtcInstant;
  readonly source: RegulatorySource;
  readonly explanation: string;
  readonly condition: RegulatoryCondition;
  readonly requiredAction: RegulatoryRequiredAction;
  readonly severity: RegulatoryRuleSeverity;
  readonly blocksRouteFinalization: boolean;
  readonly requiresManualVerification: boolean;
  readonly active: boolean;
  readonly version: string;
}

export const RegulatoryCoverageSchema = z
  .object({
    jurisdictionCodes: z.array(nonEmptyText).default([]),
    status: z.enum(['complete', 'partial', 'unknown']),
    limitations: z.array(nonEmptyText).default([]),
  })
  .strict();
export type RegulatoryCoverage = Readonly<
  z.infer<typeof RegulatoryCoverageSchema>
>;

export const RegulatoryRuleSetSchema = z
  .object({
    ruleSetId: nonEmptyText,
    name: nonEmptyText,
    version: nonEmptyText,
    status: z.enum(REGULATORY_RULE_SET_STATUSES),
    effectiveFrom: UtcInstantSchema,
    effectiveTo: UtcInstantSchema.optional(),
    source: RegulatorySourceSchema,
    coverage: RegulatoryCoverageSchema,
    rules: z.array(JurisdictionRuleSchema),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.effectiveTo !== undefined &&
      Date.parse(value.effectiveFrom) >= Date.parse(value.effectiveTo)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['effectiveTo'],
        message: 'A regulatory rule set must expire after it becomes effective.',
      });
    }
    const ruleIds = value.rules.map((rule) => rule.ruleId);
    if (new Set(ruleIds).size !== ruleIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rules'],
        message: 'Regulatory rule identifiers must be unique inside a rule set.',
      });
    }
  });
export interface RegulatoryRuleSet {
  readonly ruleSetId: string;
  readonly name: string;
  readonly version: string;
  readonly status: RegulatoryRuleSetStatus;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveTo?: UtcInstant;
  readonly source: RegulatorySource;
  readonly coverage: RegulatoryCoverage;
  readonly rules: readonly JurisdictionRule[];
}

export const RegulatoryActionLocationSchema = z
  .object({
    locationReferenceId: nonEmptyText,
    description: nonEmptyText,
  })
  .strict();
export type RegulatoryActionLocation = Readonly<
  z.infer<typeof RegulatoryActionLocationSchema>
>;

export const RegulatoryRouteSegmentContextSchema = z
  .object({
    segment: CommercialRouteSegmentSchema,
    roadIdentity: nonEmptyText.optional(),
    direction: z.enum(REGULATORY_DIRECTIONS).optional(),
    localAccessSegment: z.boolean().default(false),
    localAccessVerified: z.boolean().default(false),
    lastReasonableActionLocation: RegulatoryActionLocationSchema.optional(),
  })
  .strict();
export type RegulatoryRouteSegmentContext = Readonly<
  z.infer<typeof RegulatoryRouteSegmentContextSchema>
>;

export interface RegulatoryEvaluationInput {
  readonly routeId: string;
  readonly routeKind: 'commercial-vehicle' | 'consumer-comparison';
  readonly providerName: string;
  readonly providerVersion?: string;
  readonly providerRequestId?: string;
  readonly providerRespondedAt: UtcInstant;
  readonly providerVerificationStatus:
    | 'commercial-provider-verified'
    | 'partially-verified'
    | 'unverified'
    | 'consumer-comparison-only';
  readonly vehicleType: RegulatoryVehicleType;
  readonly equipment: CommercialRouteEquipment;
  readonly permitIdentifiers: readonly string[];
  readonly evaluationAt: UtcInstant;
  readonly segments: readonly RegulatoryRouteSegmentContext[];
  readonly ruleSet: RegulatoryRuleSet;
}

export const RegulatoryEvaluationInputSchema = z
  .object({
    routeId: nonEmptyText,
    routeKind: z.enum(['commercial-vehicle', 'consumer-comparison']),
    providerName: nonEmptyText,
    providerVersion: nonEmptyText.optional(),
    providerRequestId: nonEmptyText.optional(),
    providerRespondedAt: UtcInstantSchema,
    providerVerificationStatus: z.enum([
      'commercial-provider-verified',
      'partially-verified',
      'unverified',
      'consumer-comparison-only',
    ]),
    vehicleType: z.enum(REGULATORY_VEHICLE_TYPES),
    equipment: CommercialRouteEquipmentSchema,
    permitIdentifiers: z.array(nonEmptyText).default([]),
    evaluationAt: UtcInstantSchema,
    segments: z.array(RegulatoryRouteSegmentContextSchema).min(1),
    ruleSet: RegulatoryRuleSetSchema,
  })
  .strict();

export const REGULATORY_EVALUATION_STATUSES = [
  'compliant',
  'advisory',
  'action-required',
  'route-restricted',
  'route-illegal',
  'manual-verification-required',
  'blocked',
] as const;
export type RegulatoryEvaluationStatus =
  (typeof REGULATORY_EVALUATION_STATUSES)[number];

export interface RegulatoryComplianceFinding {
  readonly findingId: string;
  readonly ruleId?: string;
  readonly ruleSetVersion: string;
  readonly affectedSegmentId: string;
  readonly jurisdictionCode: string;
  readonly category: RegulatoryRuleCategory | 'provider-evidence';
  readonly severity: RegulatoryRuleSeverity;
  readonly source: RegulatorySource;
  readonly effectiveRuleVersion?: string;
  readonly inputFacts: Readonly<Record<string, unknown>>;
  readonly explanation: string;
  readonly requiredAction: RegulatoryRequiredAction;
  readonly actionLocation?: RegulatoryActionLocation;
  readonly blocksRouteFinalization: boolean;
  readonly requiresManualVerification: boolean;
  readonly lastVerifiedAt: UtcInstant;
}

export interface RegulatoryComplianceResult {
  readonly routeId: string;
  readonly ruleSetId: string;
  readonly ruleSetVersion: string;
  readonly evaluatedAt: UtcInstant;
  readonly status: RegulatoryEvaluationStatus;
  readonly legalFinalizationStatus: 'allowed' | 'blocked';
  readonly findings: readonly RegulatoryComplianceFinding[];
  readonly evaluatedSegmentIds: readonly string[];
  readonly manualVerificationSegmentIds: readonly string[];
  readonly lastVerifiedAt: UtcInstant;
  readonly sourceAttribution: readonly RegulatorySource[];
  readonly explanations: readonly string[];
}

export function validateJurisdictionRule(input: unknown): JurisdictionRule {
  return freeze(JurisdictionRuleSchema.parse(input));
}

export function validateRegulatoryRuleSet(input: unknown): RegulatoryRuleSet {
  const parsed = RegulatoryRuleSetSchema.parse(input);
  const normalized: RegulatoryRuleSet = {
    ...parsed,
    rules: freezeArray(parsed.rules.map((rule) => freeze(rule))),
    coverage: freeze({
      ...parsed.coverage,
      jurisdictionCodes: freezeArray(parsed.coverage.jurisdictionCodes),
      limitations: freezeArray(parsed.coverage.limitations),
    }),
  };
  return freeze(normalized);
}

export function validateRegulatoryEvaluationInput(
  input: unknown,
): RegulatoryEvaluationInput {
  const parsed = RegulatoryEvaluationInputSchema.parse(input);
  const normalized: RegulatoryEvaluationInput = {
    ...parsed,
    permitIdentifiers: freezeArray(parsed.permitIdentifiers),
    segments: freezeArray(parsed.segments.map((segment) => freeze(segment))),
    ruleSet: validateRegulatoryRuleSet(parsed.ruleSet),
  };
  return freeze(normalized);
}

export function regulatoryRuleSnapshot(
  rule: JurisdictionRule,
): Readonly<Record<string, unknown>> {
  return freeze({
    ruleId: rule.ruleId,
    jurisdictionCode: rule.jurisdictionCode,
    category: rule.category,
    affectedVehicleTypes: freezeArray(rule.affectedVehicleTypes),
    roadScope: rule.roadScope,
    effectiveFrom: rule.effectiveFrom,
    ...(rule.effectiveTo === undefined ? {} : { effectiveTo: rule.effectiveTo }),
    source: rule.source,
    explanation: rule.explanation,
    condition: rule.condition,
    requiredAction: rule.requiredAction,
    severity: rule.severity,
    blocksRouteFinalization: rule.blocksRouteFinalization,
    requiresManualVerification: rule.requiresManualVerification,
    active: rule.active,
    version: rule.version,
  });
}

export function regulatoryRuleSetSnapshot(
  ruleSet: RegulatoryRuleSet,
): Readonly<Record<string, unknown>> {
  return freeze({
    ruleSetId: ruleSet.ruleSetId,
    name: ruleSet.name,
    version: ruleSet.version,
    status: ruleSet.status,
    effectiveFrom: ruleSet.effectiveFrom,
    ...(ruleSet.effectiveTo === undefined
      ? {}
      : { effectiveTo: ruleSet.effectiveTo }),
    source: ruleSet.source,
    coverage: ruleSet.coverage,
    rules: freezeArray(ruleSet.rules.map(regulatoryRuleSnapshot)),
  });
}

export const RegulatoryComplianceFindingSchema = z
  .object({
    findingId: nonEmptyText,
    ruleId: nonEmptyText.optional(),
    ruleSetVersion: nonEmptyText,
    affectedSegmentId: nonEmptyText,
    jurisdictionCode: nonEmptyText,
    category: z.union([
      z.enum(REGULATORY_RULE_CATEGORIES),
      z.literal('provider-evidence'),
    ]),
    severity: z.enum(REGULATORY_RULE_SEVERITIES),
    source: RegulatorySourceSchema,
    effectiveRuleVersion: nonEmptyText.optional(),
    inputFacts: z.record(z.string(), z.unknown()),
    explanation: nonEmptyText,
    requiredAction: RegulatoryRequiredActionSchema,
    actionLocation: RegulatoryActionLocationSchema.optional(),
    blocksRouteFinalization: z.boolean(),
    requiresManualVerification: z.boolean(),
    lastVerifiedAt: UtcInstantSchema,
  })
  .strict();

export const RegulatoryComplianceResultSchema = z
  .object({
    routeId: nonEmptyText,
    ruleSetId: nonEmptyText,
    ruleSetVersion: nonEmptyText,
    evaluatedAt: UtcInstantSchema,
    status: z.enum(REGULATORY_EVALUATION_STATUSES),
    legalFinalizationStatus: z.enum(['allowed', 'blocked']),
    findings: z.array(RegulatoryComplianceFindingSchema),
    evaluatedSegmentIds: z.array(nonEmptyText).min(1),
    manualVerificationSegmentIds: z.array(nonEmptyText),
    lastVerifiedAt: UtcInstantSchema,
    sourceAttribution: z.array(RegulatorySourceSchema).min(1),
    explanations: z.array(nonEmptyText).min(1),
  })
  .strict();

export function validateRegulatoryComplianceResult(
  input: unknown,
): RegulatoryComplianceResult {
  const parsed = RegulatoryComplianceResultSchema.parse(input);
  return freeze({
    ...parsed,
    findings: freezeArray(
      parsed.findings.map((finding) =>
        freeze({
          ...finding,
          inputFacts: freeze({ ...finding.inputFacts }),
          requiredAction: freeze({
            ...finding.requiredAction,
            requiredUpdatedFacts: freezeArray(
              finding.requiredAction.requiredUpdatedFacts,
            ),
          }),
        }),
      ),
    ),
    evaluatedSegmentIds: freezeArray(parsed.evaluatedSegmentIds),
    manualVerificationSegmentIds: freezeArray(
      parsed.manualVerificationSegmentIds,
    ),
    sourceAttribution: freezeArray(parsed.sourceAttribution.map((source) => freeze(source))),
    explanations: freezeArray(parsed.explanations),
  });
}


export function regulatoryComplianceResultSnapshot(
  input: RegulatoryComplianceResult,
): Readonly<Record<string, unknown>> {
  const result = validateRegulatoryComplianceResult(input);
  return freeze({
    routeId: result.routeId,
    ruleSetId: result.ruleSetId,
    ruleSetVersion: result.ruleSetVersion,
    evaluatedAt: result.evaluatedAt,
    status: result.status,
    legalFinalizationStatus: result.legalFinalizationStatus,
    findings: freezeArray(
      result.findings.map((finding) =>
        freeze({
          findingId: finding.findingId,
          ...(finding.ruleId === undefined ? {} : { ruleId: finding.ruleId }),
          ruleSetVersion: finding.ruleSetVersion,
          affectedSegmentId: finding.affectedSegmentId,
          jurisdictionCode: finding.jurisdictionCode,
          category: finding.category,
          severity: finding.severity,
          source: finding.source,
          ...(finding.effectiveRuleVersion === undefined
            ? {}
            : { effectiveRuleVersion: finding.effectiveRuleVersion }),
          inputFacts: finding.inputFacts,
          explanation: finding.explanation,
          requiredAction: finding.requiredAction,
          ...(finding.actionLocation === undefined
            ? {}
            : { actionLocation: finding.actionLocation }),
          blocksRouteFinalization: finding.blocksRouteFinalization,
          requiresManualVerification: finding.requiresManualVerification,
          lastVerifiedAt: finding.lastVerifiedAt,
        }),
      ),
    ),
    evaluatedSegmentIds: result.evaluatedSegmentIds,
    manualVerificationSegmentIds: result.manualVerificationSegmentIds,
    lastVerifiedAt: result.lastVerifiedAt,
    sourceAttribution: result.sourceAttribution,
    explanations: result.explanations,
  });
}
