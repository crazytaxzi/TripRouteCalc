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
export type RegulatoryRoadScope = Readonly<
  z.infer<typeof RegulatoryRoadScopeSchema>
>;

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
export type JurisdictionRule = Readonly<z.infer<typeof JurisdictionRuleSchema>>;

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