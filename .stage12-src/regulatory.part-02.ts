        code: z.ZodIssueCode.custom,
        path: ['rules'],
        message: 'Regulatory rule identifiers must be unique inside a rule set.',
      });
    }
  });
export type RegulatoryRuleSet = Readonly<z.infer<typeof RegulatoryRuleSetSchema>>;

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
