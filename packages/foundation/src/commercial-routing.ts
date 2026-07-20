import { z } from 'zod';

import { IanaTimeZoneSchema, UtcInstantSchema } from './time.js';
import type { IanaTimeZone, UtcInstant } from './time.js';
import {
  DistanceSchema,
  DurationSchema,
  LengthSchema,
  SpeedSchema,
  VolumeSchema,
  WeightSchema,
} from './units.js';
import type {
  Distance,
  Duration,
  Length,
  Speed,
  Volume,
  Weight,
} from './units.js';

const nonEmptyText = z.string().trim().min(1);
const safePositiveInteger = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const safeNonNegativeInteger = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const latitudeSchema = z.number().finite().min(-90).max(90);
const longitudeSchema = z.number().finite().min(-180).max(180);

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function freezeArray<T>(value: readonly T[]): readonly T[] {
  return Object.freeze([...value]);
}

export const COMMERCIAL_ROUTE_AVOIDANCES = [
  'tolls',
  'ferries',
  'tunnels',
  'uncontrolled-border-crossings',
  'unpaved-roads',
  'seasonal-roads',
  'hazmat-restricted-roads',
  'permit-only-roads',
] as const;
export type CommercialRouteAvoidance =
  (typeof COMMERCIAL_ROUTE_AVOIDANCES)[number];

export const COMMERCIAL_ROUTE_POLICIES = [
  'fastest-compliant',
  'shortest-compliant',
  'balanced-compliant',
] as const;
export type CommercialRoutePolicy = (typeof COMMERCIAL_ROUTE_POLICIES)[number];

export const COMMERCIAL_RESTRICTION_TYPES = [
  'commercially-prohibited-road',
  'low-clearance',
  'bridge-weight',
  'road-weight',
  'vehicle-length',
  'kpra',
  'axle',
  'truck-route-designation',
  'staa-eligibility',
  'terminal-access',
  'local-truck-prohibition',
  'seasonal-road',
  'construction-closure',
  'weather-closure',
  'chain-restriction',
  'tunnel-restriction',
  'hazmat-restriction',
  'ferry-restriction',
  'border-restriction',
  'permit-only-road',
  'other',
] as const;
export type CommercialRestrictionType =
  (typeof COMMERCIAL_RESTRICTION_TYPES)[number];

export const COMMERCIAL_RESTRICTION_SEVERITIES = [
  'information',
  'advisory',
  'manual-verification-required',
  'route-restricted',
  'prohibited',
] as const;
export type CommercialRestrictionSeverity =
  (typeof COMMERCIAL_RESTRICTION_SEVERITIES)[number];

export const ROUTE_FIELD_IMPACTS = [
  'informational',
  'lowers-confidence',
  'blocks-commercial-planning',
] as const;
export type RouteFieldImpact = (typeof ROUTE_FIELD_IMPACTS)[number];

export const RouteUnavailableFieldSchema = z
  .object({
    path: nonEmptyText,
    reason: nonEmptyText,
    impact: z.enum(ROUTE_FIELD_IMPACTS),
  })
  .strict();
export type RouteUnavailableField = Readonly<
  z.infer<typeof RouteUnavailableFieldSchema>
>;

export const TextLocationInputSchema = z
  .object({
    kind: z.literal('text'),
    text: nonEmptyText,
    countryCode: z.string().trim().length(2).toUpperCase().optional(),
  })
  .strict();

export const CoordinateLocationInputSchema = z
  .object({
    kind: z.literal('coordinates'),
    latitude: latitudeSchema,
    longitude: longitudeSchema,
  })
  .strict();

export const CommercialLocationInputSchema = z.discriminatedUnion('kind', [
  TextLocationInputSchema,
  CoordinateLocationInputSchema,
]);
export type CommercialLocationInput = Readonly<
  z.infer<typeof CommercialLocationInputSchema>
>;

export const ResolvedCommercialLocationSchema = z
  .object({
    referenceId: nonEmptyText,
    description: nonEmptyText,
    latitude: latitudeSchema,
    longitude: longitudeSchema,
    timeZone: IanaTimeZoneSchema,
    resolutionSource: z.enum(['provider-resolved', 'user-confirmed']),
    providerReference: nonEmptyText.optional(),
    confidence: z.enum(['high', 'medium', 'low', 'unknown']),
    unavailableFields: z.array(RouteUnavailableFieldSchema).default([]),
  })
  .strict();
export type ResolvedCommercialLocation = Readonly<
  z.infer<typeof ResolvedCommercialLocationSchema>
>;

export interface CommercialRouteStop {
  readonly stopId: string;
  readonly sequence: number;
  readonly required: boolean;
  readonly location: ResolvedCommercialLocation;
}

export const CommercialRouteStopSchema = z
  .object({
    stopId: nonEmptyText,
    sequence: safePositiveInteger,
    required: z.boolean(),
    location: ResolvedCommercialLocationSchema,
  })
  .strict();

const routeTractorSchema = z
  .object({
    axleCount: safePositiveInteger,
    overallLength: LengthSchema,
    height: LengthSchema,
    width: LengthSchema,
    emptyWeight: WeightSchema.optional(),
    registeredGrossWeight: WeightSchema.optional(),
    fuelCapacity: VolumeSchema.optional(),
    estimatedFuelRange: DistanceSchema.optional(),
    governedSpeed: SpeedSchema.optional(),
    planningCruiseSpeed: SpeedSchema.optional(),
    hazmatEquipped: z.boolean(),
  })
  .strict();

const routeTrailerSchema = z
  .object({
    axleCount: safePositiveInteger,
    length: LengthSchema,
    height: LengthSchema,
    width: LengthSchema,
    currentKpra: LengthSchema,
    emptyWeight: WeightSchema.optional(),
    maximumPayload: WeightSchema.optional(),
    reefer: z.boolean(),
  })
  .strict();

const routeLoadSchema = z
  .object({
    hazmat: z.boolean(),
    hazmatClass: nonEmptyText.optional(),
    grossCargoWeight: WeightSchema,
    steerAxleWeight: WeightSchema,
    driveAxleWeight: WeightSchema,
    trailerAxleWeight: WeightSchema,
    totalGrossCombinationWeight: WeightSchema,
    length: LengthSchema,
    height: LengthSchema,
    width: LengthSchema,
    frontOverhang: LengthSchema.optional(),
    rearOverhang: LengthSchema.optional(),
    permitRequirement: z.enum(['not-required', 'required', 'unknown']),
    permitIdentifiers: z.array(nonEmptyText).default([]),
  })
  .strict();

export const CommercialRouteEquipmentSchema = z
  .object({
    tractor: routeTractorSchema,
    trailer: routeTrailerSchema,
    load: routeLoadSchema,
    totalAxleCount: safePositiveInteger,
    trailerCount: safePositiveInteger,
    combinedDimensions: z
      .object({
        overallLength: LengthSchema,
        height: LengthSchema,
        width: LengthSchema,
      })
      .strict(),
    legalityStatus: z.literal('not-evaluated'),
  })
  .strict();
export type CommercialRouteEquipment = Readonly<
  z.infer<typeof CommercialRouteEquipmentSchema>
>;

export const CommercialRouteRequestSchema = z
  .object({
    requestId: nonEmptyText,
    requestedAt: UtcInstantSchema,
    departureAt: UtcInstantSchema,
    equipment: CommercialRouteEquipmentSchema,
    origin: ResolvedCommercialLocationSchema,
    orderedStops: z.array(CommercialRouteStopSchema).min(1),
    avoidances: z.array(z.enum(COMMERCIAL_ROUTE_AVOIDANCES)).default([]),
    routePolicy: z.enum(COMMERCIAL_ROUTE_POLICIES),
    permitIdentifiers: z.array(nonEmptyText).default([]),
    comparisonMode: z.literal('commercial-route-only'),
  })
  .strict()
  .superRefine((value, context) => {
    const sequences = value.orderedStops.map((stop) => stop.sequence);
    if (new Set(sequences).size !== sequences.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['orderedStops'],
        message: 'Commercial-route stop sequence values must be unique.',
      });
    }
    for (let index = 1; index < value.orderedStops.length; index += 1) {
      const previous = value.orderedStops[index - 1];
      const current = value.orderedStops[index];
      if (
        previous !== undefined &&
        current !== undefined &&
        current.sequence <= previous.sequence
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['orderedStops', index, 'sequence'],
          message:
            'Commercial-route stops must be supplied in strictly increasing sequence order.',
        });
      }
    }
    const equipment = value.equipment;
    if (
      equipment.totalAxleCount !==
      equipment.tractor.axleCount + equipment.trailer.axleCount
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['equipment', 'totalAxleCount'],
        message: 'Total axle count must equal tractor plus trailer axle count.',
      });
    }
    if (equipment.load.hazmat && equipment.load.hazmatClass === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['equipment', 'load', 'hazmatClass'],
        message: 'Hazmat routing requires at least one stated hazmat class.',
      });
    }
    if (
      equipment.load.permitRequirement === 'required' &&
      value.permitIdentifiers.length === 0 &&
      equipment.load.permitIdentifiers.length === 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['permitIdentifiers'],
        message: 'Permit-required routing needs at least one permit identifier.',
      });
    }
  });
export type CommercialRouteRequest = Readonly<
  z.infer<typeof CommercialRouteRequestSchema>
>;

export const RouteGeometrySchema = z.discriminatedUnion('format', [
  z
    .object({
      format: z.literal('encoded-polyline'),
      encoded: nonEmptyText,
      precision: safeNonNegativeInteger.optional(),
    })
    .strict(),
  z
    .object({
      format: z.literal('geojson-line-string'),
      coordinates: z
        .array(z.tuple([longitudeSchema, latitudeSchema]))
        .min(2),
    })
    .strict(),
]);
export type RouteGeometry = Readonly<z.infer<typeof RouteGeometrySchema>>;

export const CommercialRouteRestrictionSchema = z
  .object({
    restrictionId: nonEmptyText,
    type: z.enum(COMMERCIAL_RESTRICTION_TYPES),
    severity: z.enum(COMMERCIAL_RESTRICTION_SEVERITIES),
    explanation: nonEmptyText,
    sourceTitle: nonEmptyText,
    sourceReference: nonEmptyText,
    verifiedAt: UtcInstantSchema.optional(),
    effectiveFrom: UtcInstantSchema.optional(),
    effectiveTo: UtcInstantSchema.optional(),
    jurisdictionCode: nonEmptyText.optional(),
    providerRestrictionCode: nonEmptyText.optional(),
  })
  .strict();
export type CommercialRouteRestriction = Readonly<
  z.infer<typeof CommercialRouteRestrictionSchema>
>;

export const CommercialRouteSegmentSchema = z
  .object({
    segmentId: nonEmptyText,
    sequence: safePositiveInteger,
    distance: DistanceSchema,
    travelDuration: DurationSchema,
    geometry: RouteGeometrySchema,
    expectedSpeed: SpeedSchema.optional(),
    jurisdictionCodes: z.array(nonEmptyText).default([]),
    verificationStatus: z.enum(['verified', 'unverified', 'prohibited']),
    restrictions: z.array(CommercialRouteRestrictionSchema).default([]),
    unavailableFields: z.array(RouteUnavailableFieldSchema).default([]),
  })
  .strict();
export type CommercialRouteSegment = Readonly<
  z.infer<typeof CommercialRouteSegmentSchema>
>;

export const CommercialRouteLegSchema = z
  .object({
    legId: nonEmptyText,
    sequence: safePositiveInteger,
    originReferenceId: nonEmptyText,
    destinationStopId: nonEmptyText,
    distance: DistanceSchema,
    travelDuration: DurationSchema,
    geometry: RouteGeometrySchema,
    segments: z.array(CommercialRouteSegmentSchema).min(1),
    unavailableFields: z.array(RouteUnavailableFieldSchema).default([]),
  })
  .strict();
export type CommercialRouteLeg = Readonly<
  z.infer<typeof CommercialRouteLegSchema>
>;

export const CommercialRouteProviderMetadataSchema = z
  .object({
    providerName: nonEmptyText,
    providerVersion: nonEmptyText.optional(),
    providerRequestId: nonEmptyText.optional(),
    requestedAt: UtcInstantSchema,
    respondedAt: UtcInstantSchema,
    confidence: z.enum(['high', 'medium', 'low', 'unknown']),
  })
  .strict();
export type CommercialRouteProviderMetadata = Readonly<
  z.infer<typeof CommercialRouteProviderMetadataSchema>
>;

export const CommercialRoutePayloadSchema = z
  .object({
    routeId: nonEmptyText,
    routeKind: z.enum(['commercial-vehicle', 'consumer-comparison']),
    provider: CommercialRouteProviderMetadataSchema,
    totalDistance: DistanceSchema,
    travelDuration: DurationSchema,
    geometry: RouteGeometrySchema,
    legs: z.array(CommercialRouteLegSchema).min(1),
    restrictions: z.array(CommercialRouteRestrictionSchema).default([]),
    unavailableFields: z.array(RouteUnavailableFieldSchema).default([]),
  })
  .strict();
export type CommercialRoutePayload = Readonly<
  z.infer<typeof CommercialRoutePayloadSchema>
>;

export interface CommercialRouteAssessment {
  readonly commercialPlanningStatus: 'usable' | 'blocked';
  readonly providerVerificationStatus:
    | 'commercial-provider-verified'
    | 'partially-verified'
    | 'unverified'
    | 'consumer-comparison-only';
  readonly legalFinalizationStatus: 'blocked-pending-regulatory-evaluation';
  readonly blockingReasons: readonly string[];
  readonly confidenceReasons: readonly string[];
}

export interface NormalizedCommercialRouteResult extends CommercialRoutePayload {
  readonly assessment: CommercialRouteAssessment;
}

function allRestrictions(
  payload: CommercialRoutePayload,
): readonly CommercialRouteRestriction[] {
  return freezeArray([
    ...payload.restrictions,
    ...payload.legs.flatMap((leg) =>
      leg.segments.flatMap((segment) => segment.restrictions),
    ),
  ]);
}

function allUnavailableFields(
  payload: CommercialRoutePayload,
): readonly RouteUnavailableField[] {
  return freezeArray([
    ...payload.unavailableFields,
    ...payload.legs.flatMap((leg) => [
      ...leg.unavailableFields,
      ...leg.segments.flatMap((segment) => segment.unavailableFields),
    ]),
  ]);
}

export function assessCommercialRoute(
  payloadInput: unknown,
): NormalizedCommercialRouteResult {
  const payload = CommercialRoutePayloadSchema.parse(payloadInput);
  const restrictions = allRestrictions(payload);
  const unavailableFields = allUnavailableFields(payload);
  const blockingReasons: string[] = [];
  const confidenceReasons: string[] = [];

  if (payload.routeKind === 'consumer-comparison') {
    blockingReasons.push(
      'A consumer-route comparison is excluded from commercial planning and legal finalization.',
    );
  }

  const segments = payload.legs.flatMap((leg) => leg.segments);
  if (segments.some((segment) => segment.verificationStatus === 'prohibited')) {
    blockingReasons.push('At least one route segment is explicitly prohibited.');
  }
  if (segments.some((segment) => segment.verificationStatus === 'unverified')) {
    blockingReasons.push('At least one route segment is not commercially verified.');
  }
  if (restrictions.some((restriction) => restriction.severity === 'prohibited')) {
    blockingReasons.push('A provider restriction prohibits part of the route.');
  }
  if (
    restrictions.some(
      (restriction) =>
        restriction.severity === 'route-restricted' ||
        restriction.severity === 'manual-verification-required',
    )
  ) {
    blockingReasons.push(
      'A route restriction requires rerouting or manual verification before commercial planning may proceed.',
    );
  }
  if (
    unavailableFields.some(
      (field) => field.impact === 'blocks-commercial-planning',
    )
  ) {
    blockingReasons.push(
      'Provider data required for commercial planning is unavailable.',
    );
  }
  confidenceReasons.push(
    ...unavailableFields
      .filter((field) => field.impact !== 'informational')
      .map((field) => `${field.path}: ${field.reason}`),
  );

  const allSegmentsVerified = segments.every(
    (segment) => segment.verificationStatus === 'verified',
  );
  const providerVerificationStatus =
    payload.routeKind === 'consumer-comparison'
      ? 'consumer-comparison-only'
      : allSegmentsVerified && blockingReasons.length === 0
        ? 'commercial-provider-verified'
        : segments.some((segment) => segment.verificationStatus === 'verified')
          ? 'partially-verified'
          : 'unverified';

  const assessment = freeze({
    commercialPlanningStatus:
      blockingReasons.length === 0 ? ('usable' as const) : ('blocked' as const),
    providerVerificationStatus,
    legalFinalizationStatus: 'blocked-pending-regulatory-evaluation' as const,
    blockingReasons: freezeArray(blockingReasons),
    confidenceReasons: freezeArray(confidenceReasons),
  });

  return freeze({
    ...payload,
    legs: freezeArray(payload.legs),
    restrictions: freezeArray(payload.restrictions),
    unavailableFields: freezeArray(payload.unavailableFields),
    assessment,
  });
}

export function validateCommercialRouteRequest(
  input: unknown,
): CommercialRouteRequest {
  return freeze(CommercialRouteRequestSchema.parse(input));
}

export interface TrafficEstimateRequest {
  readonly routeId: string;
  readonly departureAt: UtcInstant;
}

export interface TrafficEstimate {
  readonly routeId: string;
  readonly additionalDuration: Duration;
  readonly confidence: 'high' | 'medium' | 'low' | 'unknown';
  readonly sourceReference?: string;
  readonly unavailableFields: readonly RouteUnavailableField[];
}

export interface RoadClosureRequest {
  readonly routeId: string;
  readonly from: UtcInstant;
  readonly to: UtcInstant;
}

export interface RoadClosure {
  readonly closureId: string;
  readonly segmentId?: string;
  readonly startsAt?: UtcInstant;
  readonly endsAt?: UtcInstant;
  readonly explanation: string;
  readonly sourceReference: string;
  readonly verificationStatus: 'verified' | 'unverified';
}

export interface CommercialRoutingContractSummary {
  readonly distance: Distance;
  readonly duration: Duration;
  readonly maximumHeight: Length;
  readonly maximumWidth: Length;
  readonly overallLength: Length;
  readonly grossWeight: Weight;
  readonly fuelCapacity?: Volume;
  readonly planningSpeed?: Speed;
  readonly originTimeZone: IanaTimeZone;
}

export function commercialRouteResultSnapshot(
  input: unknown,
): Readonly<Record<string, unknown>> {
  const result = assessCommercialRoute(input);
  return freeze({
    routeId: result.routeId,
    routeKind: result.routeKind,
    provider: result.provider,
    totalDistance: result.totalDistance,
    travelDuration: result.travelDuration,
    geometry: result.geometry,
    legs: result.legs,
    restrictions: result.restrictions,
    unavailableFields: result.unavailableFields,
    assessment: result.assessment,
  });
}
