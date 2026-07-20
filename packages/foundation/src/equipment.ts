import { z } from 'zod';

import { UtcInstantSchema } from './time.js';
import type { UtcInstant } from './time.js';
import {
  DistanceSchema,
  FuelRateSchema,
  LengthSchema,
  SpeedSchema,
  TemperatureSchema,
  VolumeSchema,
  WeightSchema,
} from './units.js';
import type {
  Distance,
  FuelRate,
  Length,
  Speed,
  Temperature,
  Volume,
  Weight,
} from './units.js';

const nonEmptyText = z.string().trim().min(1);
const optionalNotes = z.string().trim().min(1).optional();
const positiveSafeInteger = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const jsonMetadataSchema = z.record(z.unknown()).default({});

export const EQUIPMENT_DATA_SOURCE_TYPES = [
  'measured',
  'manufacturer-rated',
  'carrier-configured',
  'user-estimated',
] as const;
export type EquipmentDataSourceType = (typeof EQUIPMENT_DATA_SOURCE_TYPES)[number];

export const EquipmentFieldEvidenceSchema = z
  .object({
    fieldPath: nonEmptyText,
    sourceType: z.enum(EQUIPMENT_DATA_SOURCE_TYPES),
    sourceName: optionalNotes,
    observedAt: UtcInstantSchema.optional(),
    verifiedAt: UtcInstantSchema.optional(),
    explanation: optionalNotes,
  })
  .strict();

export type EquipmentFieldEvidence = Readonly<
  z.infer<typeof EquipmentFieldEvidenceSchema>
>;

export const TRACTOR_TYPES = ['day-cab', 'sleeper', 'cabover', 'other'] as const;
export type TractorType = (typeof TRACTOR_TYPES)[number];

export const CALIFORNIA_COMPLIANCE_STATUSES = [
  'not-evaluated',
  'carrier-asserted-compliant',
  'carrier-asserted-noncompliant',
  'manual-verification-required',
] as const;
export type CaliforniaComplianceStatus =
  (typeof CALIFORNIA_COMPLIANCE_STATUSES)[number];

export const CaliforniaComplianceEvidenceSchema = z
  .object({
    status: z.enum(CALIFORNIA_COMPLIANCE_STATUSES),
    sourceName: optionalNotes,
    verifiedAt: UtcInstantSchema.optional(),
    explanation: optionalNotes,
  })
  .strict();

export type CaliforniaComplianceEvidence = Readonly<
  z.infer<typeof CaliforniaComplianceEvidenceSchema>
>;

export const IdleAuxiliaryPowerAssumptionsSchema = z
  .object({
    idleAllowed: z.boolean(),
    auxiliaryPowerUnitAvailable: z.boolean(),
    estimatedIdleFuelRate: FuelRateSchema.optional(),
    estimatedAuxiliaryPowerFuelRate: FuelRateSchema.optional(),
    explanation: optionalNotes,
  })
  .strict();

export type IdleAuxiliaryPowerAssumptions = Readonly<
  z.infer<typeof IdleAuxiliaryPowerAssumptionsSchema>
>;

export const TractorProfileSchema = z
  .object({
    unitNumber: nonEmptyText,
    vin: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-HJ-NPR-Z0-9]{17}$/u, 'Expected a valid 17-character VIN.')
      .optional(),
    tractorType: z.enum(TRACTOR_TYPES),
    axleCount: positiveSafeInteger,
    overallLength: LengthSchema.optional(),
    wheelbase: LengthSchema.optional(),
    height: LengthSchema.optional(),
    width: LengthSchema.optional(),
    emptyWeight: WeightSchema.optional(),
    grossVehicleWeightRating: WeightSchema.optional(),
    registeredGrossWeight: WeightSchema.optional(),
    fuelCapacity: VolumeSchema.optional(),
    estimatedFuelRange: DistanceSchema.optional(),
    governedSpeed: SpeedSchema.optional(),
    planningCruiseSpeed: SpeedSchema.optional(),
    hazmatEquipped: z.boolean(),
    californiaCompliance: CaliforniaComplianceEvidenceSchema,
    idleAuxiliaryPower: IdleAuxiliaryPowerAssumptionsSchema,
    notes: optionalNotes,
    fieldEvidence: z.array(EquipmentFieldEvidenceSchema).default([]),
    extensionMetadata: jsonMetadataSchema,
  })
  .strict();

export type TractorProfile = Readonly<z.infer<typeof TractorProfileSchema>>;

export const TRAILER_TYPES = [
  'dry-van',
  'refrigerated',
  'flatbed',
  'similar-general-freight',
] as const;
export type TrailerType = (typeof TRAILER_TYPES)[number];

export const TRAILER_AXLE_CONFIGURATIONS = ['fixed', 'sliding'] as const;
export type TrailerAxleConfiguration =
  (typeof TRAILER_AXLE_CONFIGURATIONS)[number];

export const TrailerRailPositionMappingSchema = z
  .object({
    railPosition: nonEmptyText,
    kpra: LengthSchema,
    verificationSource: nonEmptyText,
    verifiedAt: UtcInstantSchema,
    explanation: optionalNotes,
  })
  .strict();

export type TrailerRailPositionMapping = Readonly<
  z.infer<typeof TrailerRailPositionMappingSchema>
>;

export const TrailerProfileSchema = z
  .object({
    trailerNumber: nonEmptyText,
    trailerType: z.enum(TRAILER_TYPES),
    length: LengthSchema.optional(),
    width: LengthSchema.optional(),
    height: LengthSchema.optional(),
    axleCount: positiveSafeInteger,
    slidingTandemCapability: z.boolean(),
    axleConfiguration: z.enum(TRAILER_AXLE_CONFIGURATIONS),
    currentKpra: LengthSchema.optional(),
    minimumAchievableKpra: LengthSchema.optional(),
    maximumAchievableKpra: LengthSchema.optional(),
    currentRailPosition: optionalNotes,
    railPositionMappings: z.array(TrailerRailPositionMappingSchema).default([]),
    emptyWeight: WeightSchema.optional(),
    grossVehicleWeightRating: WeightSchema.optional(),
    maximumPayload: WeightSchema.optional(),
    reefer: z.boolean(),
    liftgate: z.boolean(),
    specialEquipment: z.array(nonEmptyText).default([]),
    notes: optionalNotes,
    fieldEvidence: z.array(EquipmentFieldEvidenceSchema).default([]),
    extensionMetadata: jsonMetadataSchema,
  })
  .strict();

export type TrailerProfile = Readonly<z.infer<typeof TrailerProfileSchema>>;

export const PERMIT_REQUIREMENTS = ['not-required', 'required', 'unknown'] as const;
export type PermitRequirement = (typeof PERMIT_REQUIREMENTS)[number];

export const SECURE_PARKING_REQUIREMENTS = [
  'none',
  'high-value',
  'secure-parking',
  'high-value-and-secure-parking',
] as const;
export type SecureParkingRequirement =
  (typeof SECURE_PARKING_REQUIREMENTS)[number];

export const TemperatureRequirementsSchema = z
  .object({
    reeferRequired: z.boolean(),
    minimum: TemperatureSchema.optional(),
    maximum: TemperatureSchema.optional(),
    setPoint: TemperatureSchema.optional(),
    explanation: optionalNotes,
  })
  .strict();

export type TemperatureRequirements = Readonly<
  z.infer<typeof TemperatureRequirementsSchema>
>;

export const LoadPermitSchema = z
  .object({
    identifier: nonEmptyText,
    jurisdictionCode: optionalNotes,
    restrictions: z.array(nonEmptyText).default([]),
  })
  .strict();

export type LoadPermit = Readonly<z.infer<typeof LoadPermitSchema>>;

export const LoadProfileSchema = z
  .object({
    loadIdentifier: nonEmptyText,
    commodity: nonEmptyText,
    hazmat: z.boolean(),
    hazmatClass: optionalNotes,
    grossCargoWeight: WeightSchema.optional(),
    steerAxleWeight: WeightSchema.optional(),
    driveAxleWeight: WeightSchema.optional(),
    trailerAxleWeight: WeightSchema.optional(),
    totalGrossCombinationWeight: WeightSchema.optional(),
    length: LengthSchema.optional(),
    width: LengthSchema.optional(),
    height: LengthSchema.optional(),
    frontOverhang: LengthSchema.optional(),
    rearOverhang: LengthSchema.optional(),
    temperatureRequirements: TemperatureRequirementsSchema.optional(),
    permitRequirement: z.enum(PERMIT_REQUIREMENTS),
    permits: z.array(LoadPermitSchema).default([]),
    escortRequirements: z.array(nonEmptyText).default([]),
    routeRestrictions: z.array(nonEmptyText).default([]),
    secureParkingRequirement: z.enum(SECURE_PARKING_REQUIREMENTS),
    notes: optionalNotes,
    fieldEvidence: z.array(EquipmentFieldEvidenceSchema).default([]),
    extensionMetadata: jsonMetadataSchema,
  })
  .strict();

export type LoadProfile = Readonly<z.infer<typeof LoadProfileSchema>>;

export const EQUIPMENT_VALIDATION_ISSUE_LEVELS = [
  'blocking-error',
  'action-required-warning',
  'missing-data-confidence-reason',
] as const;
export type EquipmentValidationIssueLevel =
  (typeof EQUIPMENT_VALIDATION_ISSUE_LEVELS)[number];

export type EquipmentValidationIssueCode =
  | 'INVALID_PROFILE'
  | 'INVALID_DIMENSION'
  | 'INVALID_WEIGHT'
  | 'INVALID_CAPACITY'
  | 'INVALID_SPEED'
  | 'INVALID_KPRA_RANGE'
  | 'KPRA_OUTSIDE_RANGE'
  | 'UNVERIFIED_RAIL_POSITION'
  | 'RAIL_MAPPING_MISMATCH'
  | 'DUPLICATE_RAIL_POSITION'
  | 'AXLE_WEIGHT_EXCEEDS_GROSS'
  | 'HAZMAT_CLASS_REQUIRED'
  | 'HAZMAT_METADATA_CONFLICT'
  | 'PERMIT_DATA_REQUIRED'
  | 'PERMIT_REVIEW_REQUIRED'
  | 'TEMPERATURE_RANGE_INVALID'
  | 'MISSING_ROUTE_MEASUREMENT'
  | 'MISSING_FIELD_EVIDENCE'
  | 'REGISTERED_WEIGHT_REVIEW_REQUIRED'
  | 'OVERSIZE_REVIEW_REQUIRED';

export interface EquipmentValidationIssue {
  readonly level: EquipmentValidationIssueLevel;
  readonly code: EquipmentValidationIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface EquipmentValidationResult<Profile> {
  readonly profile?: Profile;
  readonly issues: readonly EquipmentValidationIssue[];
  readonly blockingErrors: readonly EquipmentValidationIssue[];
  readonly actionRequiredWarnings: readonly EquipmentValidationIssue[];
  readonly missingDataConfidenceReasons: readonly EquipmentValidationIssue[];
  readonly canSave: boolean;
  readonly routeInputReady: boolean;
  readonly legalityStatus: 'not-evaluated';
}

export class EquipmentValidationError extends Error {
  public override readonly name = 'EquipmentValidationError';

  public constructor(public readonly issues: readonly EquipmentValidationIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
  }
}

export interface EquipmentCombination {
  readonly tractor: TractorProfile;
  readonly trailer: TrailerProfile;
  readonly load: LoadProfile;
}

export interface EquipmentRoutePhysicalInput {
  readonly tractor: Readonly<{
    axleCount: number;
    overallLength: Length;
    height: Length;
    width: Length;
    emptyWeight?: Weight;
    registeredGrossWeight?: Weight;
    fuelCapacity?: Volume;
    estimatedFuelRange?: Distance;
    governedSpeed?: Speed;
    planningCruiseSpeed?: Speed;
    hazmatEquipped: boolean;
  }>;
  readonly trailer: Readonly<{
    axleCount: number;
    length: Length;
    height: Length;
    width: Length;
    currentKpra: Length;
    emptyWeight?: Weight;
    maximumPayload?: Weight;
    reefer: boolean;
  }>;
  readonly load: Readonly<{
    hazmat: boolean;
    hazmatClass?: string;
    grossCargoWeight: Weight;
    steerAxleWeight: Weight;
    driveAxleWeight: Weight;
    trailerAxleWeight: Weight;
    totalGrossCombinationWeight: Weight;
    length: Length;
    height: Length;
    width: Length;
    frontOverhang?: Length;
    rearOverhang?: Length;
    permitRequirement: PermitRequirement;
    permitIdentifiers: readonly string[];
  }>;
  readonly totalAxleCount: number;
  readonly legalityStatus: 'not-evaluated';
}

export type EquipmentRouteInputResult =
  | Readonly<{
      status: 'ready';
      input: EquipmentRoutePhysicalInput;
      validation: EquipmentValidationResult<EquipmentCombination>;
    }>
  | Readonly<{
      status: 'blocked';
      validation: EquipmentValidationResult<EquipmentCombination>;
    }>;

function makeIssue(
  level: EquipmentValidationIssueLevel,
  code: EquipmentValidationIssueCode,
  path: string,
  message: string,
): EquipmentValidationIssue {
  return Object.freeze({ level, code, path, message });
}

function finishValidation<Profile>(
  profile: Profile | undefined,
  issues: readonly EquipmentValidationIssue[],
  routeInputReady: boolean,
): EquipmentValidationResult<Profile> {
  const frozenIssues = Object.freeze([...issues]);
  const blockingErrors = Object.freeze(
    frozenIssues.filter((issue) => issue.level === 'blocking-error'),
  );
  const actionRequiredWarnings = Object.freeze(
    frozenIssues.filter((issue) => issue.level === 'action-required-warning'),
  );
  const missingDataConfidenceReasons = Object.freeze(
    frozenIssues.filter(
      (issue) => issue.level === 'missing-data-confidence-reason',
    ),
  );

  const base = {
    issues: frozenIssues,
    blockingErrors,
    actionRequiredWarnings,
    missingDataConfidenceReasons,
    canSave: blockingErrors.length === 0,
    routeInputReady: blockingErrors.length === 0 && routeInputReady,
    legalityStatus: 'not-evaluated' as const,
  };

  return profile === undefined
    ? Object.freeze(base)
    : Object.freeze({ ...base, profile });
}

function schemaIssues(error: z.ZodError): readonly EquipmentValidationIssue[] {
  return error.issues.map((issue) =>
    makeIssue(
      'blocking-error',
      'INVALID_PROFILE',
      issue.path.length === 0 ? '$' : issue.path.join('.'),
      issue.message,
    ),
  );
}

function positiveMeasurement(
  value: { readonly value: number } | undefined,
  path: string,
  issues: EquipmentValidationIssue[],
): void {
  if (value !== undefined && value.value <= 0) {
    issues.push(
      makeIssue(
        'blocking-error',
        'INVALID_DIMENSION',
        path,
        'The measurement must be greater than zero.',
      ),
    );
  }
}

function positiveWeight(
  value: Weight | undefined,
  path: string,
  issues: EquipmentValidationIssue[],
): void {
  if (value !== undefined && value.value <= 0) {
    issues.push(
      makeIssue(
        'blocking-error',
        'INVALID_WEIGHT',
        path,
        'The weight must be greater than zero.',
      ),
    );
  }
}

function evidencePaths(
  evidence: readonly EquipmentFieldEvidence[],
): ReadonlySet<string> {
  return new Set(evidence.map((item) => item.fieldPath));
}

function requireEvidence(
  evidence: ReadonlySet<string>,
  fieldPath: string,
  value: unknown,
  issues: EquipmentValidationIssue[],
): void {
  if (value !== undefined && !evidence.has(fieldPath)) {
    issues.push(
      makeIssue(
        'missing-data-confidence-reason',
        'MISSING_FIELD_EVIDENCE',
        `fieldEvidence.${fieldPath}`,
        `The source classification for ${fieldPath} is missing. Record whether it was measured, manufacturer-rated, carrier-configured, or user-estimated.`,
      ),
    );
  }
}

function requireRouteMeasurement(
  value: unknown,
  path: string,
  message: string,
  issues: EquipmentValidationIssue[],
): boolean {
  if (value !== undefined) {
    return true;
  }

  issues.push(
    makeIssue(
      'missing-data-confidence-reason',
      'MISSING_ROUTE_MEASUREMENT',
      path,
      message,
    ),
  );
  return false;
}

function checkEvidenceDuplicates(
  evidence: readonly EquipmentFieldEvidence[],
  issues: EquipmentValidationIssue[],
): void {
  const seen = new Set<string>();
  for (const [index, item] of evidence.entries()) {
    if (seen.has(item.fieldPath)) {
      issues.push(
        makeIssue(
          'action-required-warning',
          'MISSING_FIELD_EVIDENCE',
          `fieldEvidence.${String(index)}.fieldPath`,
          `More than one evidence record describes ${item.fieldPath}; confirm which source should control.`,
        ),
      );
    }
    seen.add(item.fieldPath);
  }
}

export function validateTractorProfile(
  input: unknown,
): EquipmentValidationResult<TractorProfile> {
  const parsed = TractorProfileSchema.safeParse(input);
  if (!parsed.success) {
    return finishValidation<TractorProfile>(undefined, schemaIssues(parsed.error), false);
  }

  const profile = parsed.data;
  const issues: EquipmentValidationIssue[] = [];
  const evidence = evidencePaths(profile.fieldEvidence);

  positiveMeasurement(profile.overallLength, 'overallLength', issues);
  positiveMeasurement(profile.wheelbase, 'wheelbase', issues);
  positiveMeasurement(profile.height, 'height', issues);
  positiveMeasurement(profile.width, 'width', issues);
  positiveWeight(profile.emptyWeight, 'emptyWeight', issues);
  positiveWeight(
    profile.grossVehicleWeightRating,
    'grossVehicleWeightRating',
    issues,
  );
  positiveWeight(profile.registeredGrossWeight, 'registeredGrossWeight', issues);
  positiveMeasurement(profile.fuelCapacity, 'fuelCapacity', issues);
  positiveMeasurement(profile.estimatedFuelRange, 'estimatedFuelRange', issues);
  positiveMeasurement(profile.governedSpeed, 'governedSpeed', issues);
  positiveMeasurement(profile.planningCruiseSpeed, 'planningCruiseSpeed', issues);

  if (
    profile.overallLength !== undefined &&
    profile.wheelbase !== undefined &&
    profile.wheelbase.value > profile.overallLength.value
  ) {
    issues.push(
      makeIssue(
        'blocking-error',
        'INVALID_DIMENSION',
        'wheelbase',
        'Wheelbase cannot exceed the overall tractor length.',
      ),
    );
  }

  if (
    profile.emptyWeight !== undefined &&
    profile.grossVehicleWeightRating !== undefined &&
    profile.emptyWeight.value > profile.grossVehicleWeightRating.value
  ) {
    issues.push(
      makeIssue(
        'blocking-error',
        'INVALID_CAPACITY',
        'emptyWeight',
        'Empty tractor weight cannot exceed the tractor gross vehicle weight rating.',
      ),
    );
  }

  if (
    profile.planningCruiseSpeed !== undefined &&
    profile.governedSpeed !== undefined &&
    profile.planningCruiseSpeed.value > profile.governedSpeed.value
  ) {
    issues.push(
      makeIssue(
        'blocking-error',
        'INVALID_SPEED',
        'planningCruiseSpeed',
        'Planning cruise speed cannot exceed the governed speed.',
      ),
    );
  }

  if (
    profile.californiaCompliance.status === 'carrier-asserted-compliant' &&
    (profile.californiaCompliance.sourceName === undefined ||
      profile.californiaCompliance.verifiedAt === undefined)
  ) {
    issues.push(
      makeIssue(
        'action-required-warning',
        'PERMIT_REVIEW_REQUIRED',
        'californiaCompliance',
        'A carrier compliance assertion needs a source and verification timestamp before later compliance stages may rely on it.',
      ),
    );
  }

  checkEvidenceDuplicates(profile.fieldEvidence, issues);
  for (const [fieldPath, value] of [
    ['overallLength', profile.overallLength],
    ['wheelbase', profile.wheelbase],
    ['height', profile.height],
    ['width', profile.width],
    ['emptyWeight', profile.emptyWeight],
    ['grossVehicleWeightRating', profile.grossVehicleWeightRating],
    ['registeredGrossWeight', profile.registeredGrossWeight],
    ['fuelCapacity', profile.fuelCapacity],
    ['estimatedFuelRange', profile.estimatedFuelRange],
    ['governedSpeed', profile.governedSpeed],
    ['planningCruiseSpeed', profile.planningCruiseSpeed],
  ] as const) {
    requireEvidence(evidence, fieldPath, value, issues);
  }

  const routeRequirements = [
    requireRouteMeasurement(
      profile.overallLength,
      'overallLength',
      'Overall tractor length is required for commercial-route physical input.',
      issues,
    ),
    requireRouteMeasurement(
      profile.height,
      'height',
      'Tractor height is required for commercial-route physical input.',
      issues,
    ),
    requireRouteMeasurement(
      profile.width,
      'width',
      'Tractor width is required for commercial-route physical input.',
      issues,
    ),
  ];

  return finishValidation(profile, issues, routeRequirements.every(Boolean));
}

export function validateTrailerProfile(
  input: unknown,
): EquipmentValidationResult<TrailerProfile> {
  const parsed = TrailerProfileSchema.safeParse(input);
  if (!parsed.success) {
    return finishValidation<TrailerProfile>(undefined, schemaIssues(parsed.error), false);
  }

  const profile = parsed.data;
  const issues: EquipmentValidationIssue[] = [];
  const evidence = evidencePaths(profile.fieldEvidence);

  positiveMeasurement(profile.length, 'length', issues);
  positiveMeasurement(profile.width, 'width', issues);
  positiveMeasurement(profile.height, 'height', issues);
  positiveMeasurement(profile.currentKpra, 'currentKpra', issues);
  positiveMeasurement(
    profile.minimumAchievableKpra,
    'minimumAchievableKpra',
    issues,
  );
  positiveMeasurement(
    profile.maximumAchievableKpra,
    'maximumAchievableKpra',
    issues,
  );
  positiveWeight(profile.emptyWeight, 'emptyWeight', issues);
  positiveWeight(
    profile.grossVehicleWeightRating,
    'grossVehicleWeightRating',
    issues,
  );
  positiveWeight(profile.maximumPayload, 'maximumPayload', issues);

  if (profile.axleConfiguration === 'fixed' && profile.slidingTandemCapability) {
    issues.push(
      makeIssue(
        'blocking-error',
        'INVALID_PROFILE',
        'slidingTandemCapability',
        'A fixed axle configuration cannot claim sliding-tandem capability.',
      ),
    );
  }
  if (profile.axleConfiguration === 'sliding' && !profile.slidingTandemCapability) {
    issues.push(
      makeIssue(
        'blocking-error',
        'INVALID_PROFILE',
        'slidingTandemCapability',
        'A sliding axle configuration must record sliding-tandem capability.',
      ),
    );
  }

  const minimum = profile.minimumAchievableKpra?.value;
  const current = profile.currentKpra?.value;
  const maximum = profile.maximumAchievableKpra?.value;
  const trailerLength = profile.length?.value;

  if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
    issues.push(
      makeIssue(
        'blocking-error',
        'INVALID_KPRA_RANGE',
        'minimumAchievableKpra',
        'Minimum achievable KPRA cannot exceed maximum achievable KPRA.',
      ),
    );
  }
  if (
    current !== undefined &&
    ((minimum !== undefined && current < minimum) ||
      (maximum !== undefined && current > maximum))
  ) {
    issues.push(
      makeIssue(
        'blocking-error',
        'KPRA_OUTSIDE_RANGE',
        'currentKpra',
        'Current KPRA must fall inside the physically achievable KPRA range.',
      ),
    );
  }
  for (const [path, value] of [
    ['currentKpra', current],
    ['minimumAchievableKpra', minimum],
    ['maximumAchievableKpra', maximum],
  ] as const) {
    if (trailerLength !== undefined && value !== undefined && value > trailerLength) {
      issues.push(
        makeIssue(
          'blocking-error',
          'INVALID_KPRA_RANGE',
          path,
          'KPRA cannot exceed the physical trailer length.',
        ),
      );
    }
  }

  if (
    profile.axleConfiguration === 'fixed' &&
    minimum !== undefined &&
    maximum !== undefined &&
    minimum !== maximum
  ) {
    issues.push(
      makeIssue(
        'blocking-error',
        'INVALID_KPRA_RANGE',
        'minimumAchievableKpra',
        'A fixed axle configuration cannot have different minimum and maximum achievable KPRA values.',
      ),
    );
  }

  if (
    profile.emptyWeight !== undefined &&
    profile.maximumPayload !== undefined &&
    profile.grossVehicleWeightRating !== undefined &&
    profile.emptyWeight.value + profile.maximumPayload.value >
      profile.grossVehicleWeightRating.value
  ) {
    issues.push(
      makeIssue(
        'blocking-error',
        'INVALID_CAPACITY',
        'maximumPayload',
        'Empty trailer weight plus maximum payload cannot exceed trailer gross vehicle weight rating.',
      ),
    );
  }

  const mappedPositions = new Map<string, TrailerRailPositionMapping>();
  for (const [index, mapping] of profile.railPositionMappings.entries()) {
    if (mappedPositions.has(mapping.railPosition)) {
      issues.push(
        makeIssue(
          'blocking-error',
          'DUPLICATE_RAIL_POSITION',
          `railPositionMappings.${String(index)}.railPosition`,
          'Each verified rail position may appear only once.',
        ),
      );
    }
    mappedPositions.set(mapping.railPosition, mapping);
    if (
      (minimum !== undefined && mapping.kpra.value < minimum) ||
      (maximum !== undefined && mapping.kpra.value > maximum) ||
      (trailerLength !== undefined && mapping.kpra.value > trailerLength)
    ) {
      issues.push(
        makeIssue(
          'blocking-error',
          'INVALID_KPRA_RANGE',
          `railPositionMappings.${String(index)}.kpra`,
          'A verified rail-position mapping must fall inside the physical KPRA range and trailer length.',
        ),
      );
    }
  }

  if (profile.currentRailPosition !== undefined) {
    const mapping = mappedPositions.get(profile.currentRailPosition);
    if (mapping === undefined) {
      issues.push(
        makeIssue(
          'missing-data-confidence-reason',
          'UNVERIFIED_RAIL_POSITION',
          'currentRailPosition',
          'The printed rail position has no verified physical KPRA mapping and cannot be used to infer KPRA.',
        ),
      );
    } else if (
      profile.currentKpra !== undefined &&
      Math.abs(mapping.kpra.value - profile.currentKpra.value) > 0.000_001
    ) {
      issues.push(
        makeIssue(
          'blocking-error',
          'RAIL_MAPPING_MISMATCH',
          'currentKpra',
          'Current KPRA does not match the verified mapping for the selected rail position.',
        ),
      );
    }
  }

  checkEvidenceDuplicates(profile.fieldEvidence, issues);
  for (const [fieldPath, value] of [
    ['length', profile.length],
    ['width', profile.width],
    ['height', profile.height],
    ['currentKpra', profile.currentKpra],
    ['minimumAchievableKpra', profile.minimumAchievableKpra],
    ['maximumAchievableKpra', profile.maximumAchievableKpra],
    ['emptyWeight', profile.emptyWeight],
    ['grossVehicleWeightRating', profile.grossVehicleWeightRating],
    ['maximumPayload', profile.maximumPayload],
  ] as const) {
    requireEvidence(evidence, fieldPath, value, issues);
  }

  const routeRequirements = [
    requireRouteMeasurement(
      profile.length,
      'length',
      'Trailer length is required for commercial-route physical input.',
      issues,
    ),
    requireRouteMeasurement(
      profile.height,
      'height',
      'Trailer height is required for commercial-route physical input.',
      issues,
    ),
    requireRouteMeasurement(
      profile.width,
      'width',
      'Trailer width is required for commercial-route physical input.',
      issues,
    ),
    requireRouteMeasurement(
      profile.currentKpra,
      'currentKpra',
      'A physically measured current KPRA is required; a printed rail marker alone is insufficient.',
      issues,
    ),
  ];

  return finishValidation(profile, issues, routeRequirements.every(Boolean));
}

export function validateLoadProfile(
  input: unknown,
): EquipmentValidationResult<LoadProfile> {
  const parsed = LoadProfileSchema.safeParse(input);
  if (!parsed.success) {
    return finishValidation<LoadProfile>(undefined, schemaIssues(parsed.error), false);
  }

  const profile = parsed.data;
  const issues: EquipmentValidationIssue[] = [];
  const evidence = evidencePaths(profile.fieldEvidence);

  positiveWeight(profile.grossCargoWeight, 'grossCargoWeight', issues);
  positiveWeight(profile.steerAxleWeight, 'steerAxleWeight', issues);
  positiveWeight(profile.driveAxleWeight, 'driveAxleWeight', issues);
  positiveWeight(profile.trailerAxleWeight, 'trailerAxleWeight', issues);
  positiveWeight(
    profile.totalGrossCombinationWeight,
    'totalGrossCombinationWeight',
    issues,
  );
  positiveMeasurement(profile.length, 'length', issues);
  positiveMeasurement(profile.width, 'width', issues);
  positiveMeasurement(profile.height, 'height', issues);

  if (profile.hazmat && profile.hazmatClass === undefined) {
    issues.push(
      makeIssue(
        'blocking-error',
        'HAZMAT_CLASS_REQUIRED',
        'hazmatClass',
        'Hazmat class is required when the load is marked as hazmat.',
      ),
    );
  }
  if (!profile.hazmat && profile.hazmatClass !== undefined) {
    issues.push(
      makeIssue(
        'action-required-warning',
        'HAZMAT_METADATA_CONFLICT',
        'hazmatClass',
        'A hazmat class is present while hazmat is disabled; confirm the load classification.',
      ),
    );
  }

  if (profile.permitRequirement === 'required' && profile.permits.length === 0) {
    issues.push(
      makeIssue(
        'blocking-error',
        'PERMIT_DATA_REQUIRED',
        'permits',
        'Permit identifiers and restrictions are required when the configuration is explicitly marked permit-required.',
      ),
    );
  }
  if (profile.permitRequirement === 'unknown') {
    issues.push(
      makeIssue(
        'missing-data-confidence-reason',
        'PERMIT_REVIEW_REQUIRED',
        'permitRequirement',
        'Permit applicability is unknown and must be verified before route legality can be evaluated.',
      ),
    );
  }

  const knownAxleWeights = [
    profile.steerAxleWeight,
    profile.driveAxleWeight,
    profile.trailerAxleWeight,
  ].filter((value): value is Weight => value !== undefined);
  const knownAxleTotal = knownAxleWeights.reduce(
    (total, weight) => total + weight.value,
    0,
  );
  if (
    profile.totalGrossCombinationWeight !== undefined &&
    profile.totalGrossCombinationWeight.value < knownAxleTotal
  ) {
    issues.push(
      makeIssue(
        'blocking-error',
        'AXLE_WEIGHT_EXCEEDS_GROSS',
        'totalGrossCombinationWeight',
        'Total gross combination weight cannot be less than the sum of known axle weights.',
      ),
    );
  }
  if (
    profile.totalGrossCombinationWeight !== undefined &&
    profile.grossCargoWeight !== undefined &&
    profile.totalGrossCombinationWeight.value < profile.grossCargoWeight.value
  ) {
    issues.push(
      makeIssue(
        'blocking-error',
        'INVALID_WEIGHT',
        'totalGrossCombinationWeight',
        'Total gross combination weight cannot be less than cargo weight.',
      ),
    );
  }

  const temperature = profile.temperatureRequirements;
  if (temperature !== undefined) {
    const minimum = temperature.minimum?.value;
    const maximum = temperature.maximum?.value;
    const setPoint = temperature.setPoint?.value;
    if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
      issues.push(
        makeIssue(
          'blocking-error',
          'TEMPERATURE_RANGE_INVALID',
          'temperatureRequirements.minimum',
          'Minimum cargo temperature cannot exceed maximum cargo temperature.',
        ),
      );
    }
    if (
      setPoint !== undefined &&
      ((minimum !== undefined && setPoint < minimum) ||
        (maximum !== undefined && setPoint > maximum))
    ) {
      issues.push(
        makeIssue(
          'blocking-error',
          'TEMPERATURE_RANGE_INVALID',
          'temperatureRequirements.setPoint',
          'Temperature set point must fall inside the entered range.',
        ),
      );
    }
  }

  if (
    profile.length !== undefined &&
    profile.frontOverhang !== undefined &&
    profile.frontOverhang.value > profile.length.value
  ) {
    issues.push(
      makeIssue(
        'blocking-error',
        'INVALID_DIMENSION',
        'frontOverhang',
        'Front overhang cannot exceed the entered load length.',
      ),
    );
  }
  if (
    profile.length !== undefined &&
    profile.rearOverhang !== undefined &&
    profile.rearOverhang.value > profile.length.value
  ) {
    issues.push(
      makeIssue(
        'blocking-error',
        'INVALID_DIMENSION',
        'rearOverhang',
        'Rear overhang cannot exceed the entered load length.',
      ),
    );
  }
  if (
    profile.permitRequirement === 'not-required' &&
    ((profile.frontOverhang?.value ?? 0) > 0 ||
      (profile.rearOverhang?.value ?? 0) > 0)
  ) {
    issues.push(
      makeIssue(
        'action-required-warning',
        'PERMIT_REVIEW_REQUIRED',
        'permitRequirement',
        'Entered overhang requires jurisdiction-specific permit review; the profile cannot establish that no permit is required.',
      ),
    );
  }

  checkEvidenceDuplicates(profile.fieldEvidence, issues);
  for (const [fieldPath, value] of [
    ['grossCargoWeight', profile.grossCargoWeight],
    ['steerAxleWeight', profile.steerAxleWeight],
    ['driveAxleWeight', profile.driveAxleWeight],
    ['trailerAxleWeight', profile.trailerAxleWeight],
    ['totalGrossCombinationWeight', profile.totalGrossCombinationWeight],
    ['length', profile.length],
    ['width', profile.width],
    ['height', profile.height],
    ['frontOverhang', profile.frontOverhang],
    ['rearOverhang', profile.rearOverhang],
  ] as const) {
    requireEvidence(evidence, fieldPath, value, issues);
  }

  const routeRequirements = [
    requireRouteMeasurement(
      profile.grossCargoWeight,
      'grossCargoWeight',
      'Cargo weight is required for capacity and route-weight validation.',
      issues,
    ),
    requireRouteMeasurement(
      profile.steerAxleWeight,
      'steerAxleWeight',
      'Steer axle weight is required for route-weight validation.',
      issues,
    ),
    requireRouteMeasurement(
      profile.driveAxleWeight,
      'driveAxleWeight',
      'Drive axle weight is required for route-weight validation.',
      issues,
    ),
    requireRouteMeasurement(
      profile.trailerAxleWeight,
      'trailerAxleWeight',
      'Trailer axle weight is required for route-weight validation.',
      issues,
    ),
    requireRouteMeasurement(
      profile.totalGrossCombinationWeight,
      'totalGrossCombinationWeight',
      'Total gross combination weight is required for commercial-route input.',
      issues,
    ),
    requireRouteMeasurement(
      profile.length,
      'length',
      'Load length is required to identify possible overhang or oversize conditions.',
      issues,
    ),
    requireRouteMeasurement(
      profile.width,
      'width',
      'Load width is required to identify possible oversize conditions.',
      issues,
    ),
    requireRouteMeasurement(
      profile.height,
      'height',
      'Load height is required to identify possible oversize conditions.',
      issues,
    ),
  ];

  return finishValidation(profile, issues, routeRequirements.every(Boolean));
}

export function validateEquipmentCombination(
  input: EquipmentCombination,
): EquipmentValidationResult<EquipmentCombination> {
  const tractor = validateTractorProfile(input.tractor);
  const trailer = validateTrailerProfile(input.trailer);
  const load = validateLoadProfile(input.load);
  const issues = [...tractor.issues, ...trailer.issues, ...load.issues];

  if (
    load.profile?.grossCargoWeight !== undefined &&
    trailer.profile?.maximumPayload !== undefined &&
    load.profile.grossCargoWeight.value > trailer.profile.maximumPayload.value
  ) {
    issues.push(
      makeIssue(
        'blocking-error',
        'INVALID_CAPACITY',
        'load.grossCargoWeight',
        'Cargo weight exceeds the selected trailer maximum payload.',
      ),
    );
  }

  if (
    load.profile?.totalGrossCombinationWeight !== undefined &&
    tractor.profile?.emptyWeight !== undefined &&
    trailer.profile?.emptyWeight !== undefined &&
    load.profile.grossCargoWeight !== undefined &&
    load.profile.totalGrossCombinationWeight.value <
      tractor.profile.emptyWeight.value +
        trailer.profile.emptyWeight.value +
        load.profile.grossCargoWeight.value
  ) {
    issues.push(
      makeIssue(
        'blocking-error',
        'INVALID_WEIGHT',
        'load.totalGrossCombinationWeight',
        'Total gross combination weight cannot be less than the known tractor, trailer, and cargo weights.',
      ),
    );
  }

  if (
    load.profile?.totalGrossCombinationWeight !== undefined &&
    tractor.profile?.registeredGrossWeight !== undefined &&
    load.profile.totalGrossCombinationWeight.value >
      tractor.profile.registeredGrossWeight.value
  ) {
    issues.push(
      makeIssue(
        'action-required-warning',
        'REGISTERED_WEIGHT_REVIEW_REQUIRED',
        'tractor.registeredGrossWeight',
        'Entered total gross combination weight exceeds the tractor registered gross weight. Registration and jurisdiction applicability require verification.',
      ),
    );
  }

  if (
    load.profile !== undefined &&
    trailer.profile !== undefined &&
    (load.profile.width?.value ?? 0) > (trailer.profile.width?.value ?? Infinity)
  ) {
    issues.push(
      makeIssue(
        'action-required-warning',
        'OVERSIZE_REVIEW_REQUIRED',
        'load.width',
        'Load width exceeds the entered trailer width. Securement, overwidth, and permit requirements need manual verification.',
      ),
    );
  }

  const profile =
    tractor.profile === undefined ||
    trailer.profile === undefined ||
    load.profile === undefined
      ? undefined
      : Object.freeze({
          tractor: tractor.profile,
          trailer: trailer.profile,
          load: load.profile,
        });

  return finishValidation(
    profile,
    issues,
    tractor.routeInputReady && trailer.routeInputReady && load.routeInputReady,
  );
}

export function tractorProfile(input: unknown): TractorProfile {
  const result = validateTractorProfile(input);
  if (!result.canSave || result.profile === undefined) {
    throw new EquipmentValidationError(result.blockingErrors);
  }
  return result.profile;
}

export function trailerProfile(input: unknown): TrailerProfile {
  const result = validateTrailerProfile(input);
  if (!result.canSave || result.profile === undefined) {
    throw new EquipmentValidationError(result.blockingErrors);
  }
  return result.profile;
}

export function loadProfile(input: unknown): LoadProfile {
  const result = validateLoadProfile(input);
  if (!result.canSave || result.profile === undefined) {
    throw new EquipmentValidationError(result.blockingErrors);
  }
  return result.profile;
}

export function buildEquipmentRoutePhysicalInput(
  input: EquipmentCombination,
): EquipmentRouteInputResult {
  const validation = validateEquipmentCombination(input);
  if (!validation.routeInputReady || validation.profile === undefined) {
    return Object.freeze({ status: 'blocked', validation });
  }

  const { tractor, trailer, load } = validation.profile;
  if (
    tractor.overallLength === undefined ||
    tractor.height === undefined ||
    tractor.width === undefined ||
    trailer.length === undefined ||
    trailer.height === undefined ||
    trailer.width === undefined ||
    trailer.currentKpra === undefined ||
    load.grossCargoWeight === undefined ||
    load.steerAxleWeight === undefined ||
    load.driveAxleWeight === undefined ||
    load.trailerAxleWeight === undefined ||
    load.totalGrossCombinationWeight === undefined ||
    load.length === undefined ||
    load.height === undefined ||
    load.width === undefined
  ) {
    throw new Error('Route-ready validation did not preserve required measurements.');
  }

  const tractorInput: EquipmentRoutePhysicalInput['tractor'] = {
    axleCount: tractor.axleCount,
    overallLength: tractor.overallLength,
    height: tractor.height,
    width: tractor.width,
    ...(tractor.emptyWeight === undefined
      ? {}
      : { emptyWeight: tractor.emptyWeight }),
    ...(tractor.registeredGrossWeight === undefined
      ? {}
      : { registeredGrossWeight: tractor.registeredGrossWeight }),
    ...(tractor.fuelCapacity === undefined
      ? {}
      : { fuelCapacity: tractor.fuelCapacity }),
    ...(tractor.estimatedFuelRange === undefined
      ? {}
      : { estimatedFuelRange: tractor.estimatedFuelRange }),
    ...(tractor.governedSpeed === undefined
      ? {}
      : { governedSpeed: tractor.governedSpeed }),
    ...(tractor.planningCruiseSpeed === undefined
      ? {}
      : { planningCruiseSpeed: tractor.planningCruiseSpeed }),
    hazmatEquipped: tractor.hazmatEquipped,
  };

  const trailerInput: EquipmentRoutePhysicalInput['trailer'] = {
    axleCount: trailer.axleCount,
    length: trailer.length,
    height: trailer.height,
    width: trailer.width,
    currentKpra: trailer.currentKpra,
    ...(trailer.emptyWeight === undefined
      ? {}
      : { emptyWeight: trailer.emptyWeight }),
    ...(trailer.maximumPayload === undefined
      ? {}
      : { maximumPayload: trailer.maximumPayload }),
    reefer: trailer.reefer,
  };

  const loadInput: EquipmentRoutePhysicalInput['load'] = {
    hazmat: load.hazmat,
    ...(load.hazmatClass === undefined ? {} : { hazmatClass: load.hazmatClass }),
    grossCargoWeight: load.grossCargoWeight,
    steerAxleWeight: load.steerAxleWeight,
    driveAxleWeight: load.driveAxleWeight,
    trailerAxleWeight: load.trailerAxleWeight,
    totalGrossCombinationWeight: load.totalGrossCombinationWeight,
    length: load.length,
    height: load.height,
    width: load.width,
    ...(load.frontOverhang === undefined
      ? {}
      : { frontOverhang: load.frontOverhang }),
    ...(load.rearOverhang === undefined
      ? {}
      : { rearOverhang: load.rearOverhang }),
    permitRequirement: load.permitRequirement,
    permitIdentifiers: Object.freeze(
      load.permits.map((permit) => permit.identifier),
    ),
  };

  return Object.freeze({
    status: 'ready',
    input: Object.freeze({
      tractor: Object.freeze(tractorInput),
      trailer: Object.freeze(trailerInput),
      load: Object.freeze(loadInput),
      totalAxleCount: tractor.axleCount + trailer.axleCount,
      legalityStatus: 'not-evaluated',
    }),
    validation,
  });
}

export type TractorProfileApiModel = TractorProfile;
export type TrailerProfileApiModel = TrailerProfile;
export type LoadProfileApiModel = LoadProfile;
export type TractorProfileFormModel = TractorProfile;
export type TrailerProfileFormModel = TrailerProfile;
export type LoadProfileFormModel = LoadProfile;

export type EquipmentMeasurement =
  | Distance
  | FuelRate
  | Length
  | Speed
  | Temperature
  | Volume
  | Weight;

export type EquipmentEvidenceTimestamp = UtcInstant;
