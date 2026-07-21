import { z } from 'zod';

import { calculateHosCore } from './hos-core.js';
import type { HosCoreCalculationResult } from './hos-core.js';
import {
  validateDriverHosDepartureState,
  validateDutyEvent,
} from './hos.js';
import type {
  DriverHosDepartureState,
  DutyEvent,
  DutyEventSource,
  DutyEventType,
  HosDutyStatus,
} from './hos.js';
import {
  IanaTimeZoneSchema,
  UtcInstantSchema,
  utcInstant,
} from './time.js';
import type { UtcInstant } from './time.js';
import {
  DistanceSchema,
  DurationSchema,
  VolumeSchema,
  distanceInMiles,
  durationInMinutes,
  toMiles,
  volumeInUsGallons,
} from './units.js';
import type { Distance, Duration, Volume } from './units.js';

const nonEmptyText = z.string().trim().min(1);
const positiveFinite = z.number().finite().positive();
const nonNegativeFinite = z.number().finite().nonnegative();

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

function addMinutes(instant: UtcInstant, minutes: number): UtcInstant {
  return utcInstant(new Date(Date.parse(instant) + minutes * 60_000).toISOString());
}

export const OPERATIONAL_EVENT_TYPES = [
  'PRE_TRIP_INSPECTION',
  'POST_TRIP_INSPECTION',
  'FUEL',
  'SCALE',
  'CARGO_SECUREMENT_CHECK',
  'REEFER_CHECK',
  'MAINTENANCE',
  'BORDER_OR_AGRICULTURAL_INSPECTION',
  'PARKING_SEARCH',
  'MEAL',
  'SHOWER',
] as const;
export type OperationalEventType = (typeof OPERATIONAL_EVENT_TYPES)[number];

export const OPERATIONAL_LOCATION_CAPABILITIES = [
  'FUEL',
  'SCALE',
  'CARGO_SECUREMENT_CHECK',
  'REEFER_CHECK',
  'MAINTENANCE',
  'BORDER_OR_AGRICULTURAL_INSPECTION',
  'PARKING',
  'MEAL',
  'SHOWER',
] as const;
export type OperationalLocationCapability =
  (typeof OPERATIONAL_LOCATION_CAPABILITIES)[number];

export const OPERATIONAL_EVENT_SOURCE_TYPES = [
  'USER_OVERRIDE',
  'CARRIER_POLICY',
  'VERIFIED_LOCATION_PROVIDER',
  'VERIFIED_RECORD',
  'SYSTEM_SUGGESTION',
] as const;
export type OperationalEventSourceType =
  (typeof OPERATIONAL_EVENT_SOURCE_TYPES)[number];

export const OPERATIONAL_PLACEMENT_KINDS = [
  'BEFORE_FIRST_DRIVE',
  'AFTER_FINAL_DRIVE',
  'AT_ROUTE_DISTANCE',
  'BEFORE_SEGMENT',
  'AFTER_SEGMENT',
  'AT_STOP',
  'FLEXIBLE',
] as const;
export type OperationalPlacementKind =
  (typeof OPERATIONAL_PLACEMENT_KINDS)[number];

export const OPERATIONAL_EVENT_STATUSES = [
  'SCHEDULED',
  'PLACEMENT_UNAVAILABLE',
  'HOS_BLOCKED',
] as const;
export type OperationalEventStatus =
  (typeof OPERATIONAL_EVENT_STATUSES)[number];

export const FUEL_PLAN_STATUSES = [
  'NOT_REQUIRED',
  'PLANNED',
  'BLOCKED',
] as const;
export type FuelPlanStatus = (typeof FUEL_PLAN_STATUSES)[number];

export const FUEL_PLAN_BLOCKING_REASONS = [
  'INVALID_FUEL_INPUT',
  'CURRENT_LEVEL_BELOW_RESERVE',
  'INSUFFICIENT_RANGE',
  'NO_TRUCK_COMPATIBLE_LOCATION',
] as const;
export type FuelPlanBlockingReason =
  (typeof FUEL_PLAN_BLOCKING_REASONS)[number];

export const OperationalEventSourceSchema = z
  .object({
    type: z.enum(OPERATIONAL_EVENT_SOURCE_TYPES),
    sourceName: nonEmptyText,
    reference: nonEmptyText.optional(),
    observedAt: UtcInstantSchema.optional(),
    verifiedAt: UtcInstantSchema.optional(),
    explanation: nonEmptyText,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.type === 'VERIFIED_LOCATION_PROVIDER' &&
      (value.reference === undefined || value.verifiedAt === undefined)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reference'],
        message:
          'A verified location-provider source requires a reference and verified timestamp.',
      });
    }
  });
export type OperationalEventSource = Readonly<
  z.infer<typeof OperationalEventSourceSchema>
>;

export const OperationalLocationSchema = z
  .object({
    locationId: nonEmptyText,
    description: nonEmptyText,
    timeZone: IanaTimeZoneSchema,
    routeDistance: DistanceSchema,
    truckCompatible: z.boolean(),
    capabilities: z
      .array(z.enum(OPERATIONAL_LOCATION_CAPABILITIES))
      .default([]),
    source: OperationalEventSourceSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.capabilities).size !== value.capabilities.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['capabilities'],
        message: 'Operational location capabilities must be unique.',
      });
    }
  });
export type OperationalLocation = Readonly<
  z.infer<typeof OperationalLocationSchema>
>;

const PositiveOperationalDurationSchema = DurationSchema.refine(
  (value) => value.value > 0,
  'Operational durations must be at least one minute.',
);

export const OperationalDurationPlanSchema = z
  .discriminatedUnion('mode', [
    z
      .object({
        mode: z.literal('EXACT'),
        duration: PositiveOperationalDurationSchema,
      })
      .strict(),
    z
      .object({
        mode: z.literal('RANGE'),
        minimum: PositiveOperationalDurationSchema,
        expected: PositiveOperationalDurationSchema,
        maximum: PositiveOperationalDurationSchema,
      })
      .strict(),
  ])
  .superRefine((value, context) => {
    if (
      value.mode === 'RANGE' &&
      (value.minimum.value > value.expected.value ||
        value.expected.value > value.maximum.value)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expected'],
        message:
          'Operational duration range must satisfy minimum <= expected <= maximum.',
      });
    }
  });
export type OperationalDurationPlan = Readonly<
  z.infer<typeof OperationalDurationPlanSchema>
>;

export const OperationalPlanningBufferSchema = z
  .object({
    duration: DurationSchema.refine((value) => value.value > 0),
    source: OperationalEventSourceSchema,
    explanation: nonEmptyText,
    legalRequirement: z.literal(false),
  })
  .strict();
export type OperationalPlanningBuffer = Readonly<
  z.infer<typeof OperationalPlanningBufferSchema>
>;

export const OperationalPlacementConstraintSchema = z
  .object({
    kind: z.enum(OPERATIONAL_PLACEMENT_KINDS),
    routeDistance: DistanceSchema.optional(),
    segmentId: nonEmptyText.optional(),
    stopId: nonEmptyText.optional(),
    earliestRouteDistance: DistanceSchema.optional(),
    latestRouteDistance: DistanceSchema.optional(),
    requiredCapability: z
      .enum(OPERATIONAL_LOCATION_CAPABILITIES)
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.kind === 'AT_ROUTE_DISTANCE' &&
      value.routeDistance === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['routeDistance'],
        message: 'AT_ROUTE_DISTANCE placement requires route distance.',
      });
    }
    if (
      (value.kind === 'BEFORE_SEGMENT' || value.kind === 'AFTER_SEGMENT') &&
      value.segmentId === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['segmentId'],
        message: 'Segment-relative placement requires a segment identifier.',
      });
    }
    if (value.kind === 'AT_STOP' && value.stopId === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stopId'],
        message: 'AT_STOP placement requires a stop identifier.',
      });
    }
    if (
      value.earliestRouteDistance !== undefined &&
      value.latestRouteDistance !== undefined &&
      value.earliestRouteDistance.value > value.latestRouteDistance.value
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['earliestRouteDistance'],
        message: 'Earliest route distance cannot follow latest route distance.',
      });
    }
  });
export type OperationalPlacementConstraint = Readonly<
  z.infer<typeof OperationalPlacementConstraintSchema>
>;

export const LegalDutyStatusSupportSchema = z
  .object({
    sourceName: nonEmptyText,
    reference: nonEmptyText,
    explanation: nonEmptyText,
    verifiedAt: UtcInstantSchema,
  })
  .strict();
export type LegalDutyStatusSupport = Readonly<
  z.infer<typeof LegalDutyStatusSupportSchema>
>;

export const OperationalEventPlanSchema = z
  .object({
    eventId: nonEmptyText,
    type: z.enum(OPERATIONAL_EVENT_TYPES),
    duration: OperationalDurationPlanSchema,
    dutyStatus: z.enum([
      'OFF_DUTY',
      'SLEEPER_BERTH',
      'ON_DUTY_NOT_DRIVING',
    ]),
    source: OperationalEventSourceSchema,
    location: OperationalLocationSchema.optional(),
    placement: OperationalPlacementConstraintSchema,
    planningBuffer: OperationalPlanningBufferSchema.optional(),
    allowThirtyMinuteInterruptionOverlap: z.boolean(),
    allowRestOverlap: z.boolean(),
    required: z.boolean(),
    userOverride: z.boolean(),
    legalDutyStatusSupport: LegalDutyStatusSupportSchema.optional(),
    explanation: nonEmptyText,
  })
  .strict()
  .superRefine((value, context) => {
    const normallyOnDuty = [
      'PRE_TRIP_INSPECTION',
      'POST_TRIP_INSPECTION',
      'FUEL',
      'SCALE',
      'CARGO_SECUREMENT_CHECK',
      'REEFER_CHECK',
      'MAINTENANCE',
      'BORDER_OR_AGRICULTURAL_INSPECTION',
      'PARKING_SEARCH',
    ].includes(value.type);
    if (
      normallyOnDuty &&
      value.dutyStatus !== 'ON_DUTY_NOT_DRIVING' &&
      value.legalDutyStatusSupport === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dutyStatus'],
        message:
          'This operational event normally requires on-duty-not-driving unless authoritative legal support is recorded.',
      });
    }
    if (
      value.type === 'PRE_TRIP_INSPECTION' &&
      value.placement.kind !== 'BEFORE_FIRST_DRIVE'
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['placement', 'kind'],
        message: 'Pre-trip inspection must be placed before first driving.',
      });
    }
    if (
      value.type === 'POST_TRIP_INSPECTION' &&
      value.placement.kind !== 'AFTER_FINAL_DRIVE'
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['placement', 'kind'],
        message: 'Post-trip inspection must be placed after final driving.',
      });
    }
    if (
      value.allowRestOverlap &&
      value.dutyStatus === 'ON_DUTY_NOT_DRIVING'
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['allowRestOverlap'],
        message: 'On-duty operational time cannot overlap qualifying rest.',
      });
    }
  });
export type OperationalEventPlan = Readonly<
  z.infer<typeof OperationalEventPlanSchema>
>;

export interface OperationalTimelineEvent {
  readonly status: OperationalEventStatus;
  readonly plan: OperationalEventPlan;
  readonly location?: OperationalLocation;
  readonly dutyEvent?: DutyEvent;
  readonly planningBufferEvent?: DutyEvent;
  readonly hosResult?: HosCoreCalculationResult;
  readonly explanations: readonly string[];
}

export interface OperationalLocationSelection {
  readonly status: 'SELECTED' | 'UNAVAILABLE';
  readonly location?: OperationalLocation;
  readonly explanations: readonly string[];
}

export interface FuelPlanningInput {
  readonly fuelCapacity: Volume;
  readonly currentFuelLevel: Volume;
  readonly estimatedMilesPerGallon: number;
  readonly routeDistance: Distance;
  readonly requiredReserve: Volume;
  readonly locations: readonly OperationalLocation[];
}

export interface PlannedFuelStop {
  readonly sequence: number;
  readonly location: OperationalLocation;
  readonly routeDistance: Distance;
  readonly arrivalFuel: Volume;
  readonly gallonsAdded: Volume;
  readonly departureFuel: Volume;
  readonly explanation: string;
}

export interface FuelPlan {
  readonly status: FuelPlanStatus;
  readonly blockingReason?: FuelPlanBlockingReason;
  readonly routeDistance: Distance;
  readonly initialUsableFuel: Volume;
  readonly initialRange: Distance;
  readonly estimatedFuelConsumed: Volume;
  readonly stops: readonly PlannedFuelStop[];
  readonly explanations: readonly string[];
}

const EVENT_TO_DUTY_TYPE: Readonly<
  Record<OperationalEventType, DutyEventType>
> = Object.freeze({
  PRE_TRIP_INSPECTION: 'PRE_TRIP_INSPECTION',
  POST_TRIP_INSPECTION: 'POST_TRIP_INSPECTION',
  FUEL: 'FUEL',
  SCALE: 'SCALE',
  CARGO_SECUREMENT_CHECK: 'CARGO_SECUREMENT_CHECK',
  REEFER_CHECK: 'REEFER_CHECK',
  MAINTENANCE: 'MAINTENANCE',
  BORDER_OR_AGRICULTURAL_INSPECTION:
    'BORDER_OR_AGRICULTURAL_INSPECTION',
  PARKING_SEARCH: 'PARKING_SEARCH',
  MEAL: 'MEAL',
  SHOWER: 'SHOWER',
});

const EVENT_TO_CAPABILITY: Readonly<
  Partial<Record<OperationalEventType, OperationalLocationCapability>>
> = Object.freeze({
  FUEL: 'FUEL',
  SCALE: 'SCALE',
  CARGO_SECUREMENT_CHECK: 'CARGO_SECUREMENT_CHECK',
  REEFER_CHECK: 'REEFER_CHECK',
  MAINTENANCE: 'MAINTENANCE',
  BORDER_OR_AGRICULTURAL_INSPECTION:
    'BORDER_OR_AGRICULTURAL_INSPECTION',
  PARKING_SEARCH: 'PARKING',
  MEAL: 'MEAL',
  SHOWER: 'SHOWER',
});

function expectedDuration(plan: OperationalDurationPlan): Duration {
  return plan.mode === 'EXACT' ? plan.duration : plan.expected;
}

function dutySource(source: OperationalEventSource): DutyEventSource {
  switch (source.type) {
    case 'USER_OVERRIDE':
      return 'USER_ENTERED';
    case 'CARRIER_POLICY':
      return 'CARRIER_SYSTEM';
    case 'VERIFIED_LOCATION_PROVIDER':
    case 'VERIFIED_RECORD':
      return 'VERIFIED_RECORD';
    case 'SYSTEM_SUGGESTION':
      return 'CALCULATED';
  }
}

function clockEffects(status: HosDutyStatus): DutyEvent['clockEffects'] {
  switch (status) {
    case 'ON_DUTY_NOT_DRIVING':
      return freeze({
        driving: 'DOES_NOT_CONSUME',
        shift: 'ADVANCES_WINDOW',
        cycle: 'CONSUMES',
      });
    case 'OFF_DUTY':
      return freeze({
        driving: 'DOES_NOT_CONSUME',
        shift: 'ADVANCES_WINDOW',
        cycle: 'DOES_NOT_CONSUME',
      });
    case 'SLEEPER_BERTH':
      return freeze({
        driving: 'DOES_NOT_CONSUME',
        shift: 'RULE_DEPENDENT',
        cycle: 'DOES_NOT_CONSUME',
      });
    case 'DRIVING':
      return freeze({
        driving: 'CONSUMES',
        shift: 'ADVANCES_WINDOW',
        cycle: 'CONSUMES',
      });
  }
}

export function validateOperationalEventPlan(
  input: unknown,
): OperationalEventPlan {
  const parsed = OperationalEventPlanSchema.parse(input);
  return freeze({
    ...parsed,
    source: freeze(parsed.source),
    ...(parsed.location === undefined
      ? {}
      : {
          location: freeze({
            ...parsed.location,
            capabilities: freezeArray(parsed.location.capabilities),
            source: freeze(parsed.location.source),
          }),
        }),
    placement: freeze(parsed.placement),
    ...(parsed.planningBuffer === undefined
      ? {}
      : {
          planningBuffer: freeze({
            ...parsed.planningBuffer,
            source: freeze(parsed.planningBuffer.source),
          }),
        }),
    ...(parsed.legalDutyStatusSupport === undefined
      ? {}
      : { legalDutyStatusSupport: freeze(parsed.legalDutyStatusSupport) }),
  });
}

export function selectOperationalLocation(
  planInput: OperationalEventPlan,
  locationInputs: readonly OperationalLocation[],
): OperationalLocationSelection {
  const plan = validateOperationalEventPlan(planInput);
  if (plan.location !== undefined) {
    return freeze({
      status: 'SELECTED',
      location: plan.location,
      explanations: freezeArray([
        `The event uses the explicitly selected location ${plan.location.description}.`,
      ]),
    });
  }

  const capability =
    plan.placement.requiredCapability ?? EVENT_TO_CAPABILITY[plan.type];
  const candidates = locationInputs
    .map((location) => OperationalLocationSchema.parse(location))
    .filter((location) => location.truckCompatible)
    .filter(
      (location) =>
        location.source.type === 'VERIFIED_LOCATION_PROVIDER' ||
        location.source.type === 'VERIFIED_RECORD',
    )
    .filter(
      (location) =>
        capability === undefined || location.capabilities.includes(capability),
    )
    .filter(
      (location) =>
        plan.placement.earliestRouteDistance === undefined ||
        location.routeDistance.value >=
          plan.placement.earliestRouteDistance.value,
    )
    .filter(
      (location) =>
        plan.placement.latestRouteDistance === undefined ||
        location.routeDistance.value <= plan.placement.latestRouteDistance.value,
    )
    .sort((left, right) => left.routeDistance.value - right.routeDistance.value);

  if (candidates.length === 0) {
    return freeze({
      status: 'UNAVAILABLE',
      explanations: freezeArray([
        capability === undefined
          ? `No verified truck-compatible location satisfies the ${plan.type} placement window.`
          : `No verified truck-compatible location with ${capability} capability satisfies the placement window.`,
        'The planner did not fabricate an operational location.',
      ]),
    });
  }

  const target = plan.placement.routeDistance?.value;
  const selected =
    target === undefined
      ? candidates[0]
      : [...candidates].sort(
          (left, right) =>
            Math.abs(left.routeDistance.value - target) -
            Math.abs(right.routeDistance.value - target),
        )[0];
  if (selected === undefined) {
    throw new RangeError('Operational location selection unexpectedly failed.');
  }
  return freeze({
    status: 'SELECTED',
    location: freeze({
      ...selected,
      capabilities: freezeArray(selected.capabilities),
      source: freeze(selected.source),
    }),
    explanations: freezeArray([
      `Selected verified truck-compatible location ${selected.description}.`,
      `Location source: ${selected.source.sourceName}.`,
    ]),
  });
}

function makeDutyEvent(
  id: string,
  eventType: DutyEventType,
  dutyStatus: HosDutyStatus,
  startAt: UtcInstant,
  duration: Duration,
  location: OperationalLocation,
  source: OperationalEventSource,
  explanation: string,
  allowThirtyMinuteInterruptionOverlap: boolean,
): DutyEvent {
  const qualifies =
    allowThirtyMinuteInterruptionOverlap &&
    dutyStatus !== 'DRIVING' &&
    duration.value >= 30;
  return validateDutyEvent({
    id,
    startAt,
    endAt: addMinutes(startAt, duration.value),
    duration,
    dutyStatus,
    eventType,
    location: {
      description: location.description,
      timeZone: location.timeZone,
    },
    source: dutySource(source),
    explanation,
    clockEffects: clockEffects(dutyStatus),
    qualifiesForThirtyMinuteInterruption: qualifies,
    sleeperPair: { participates: false },
    provenance: {
      origin:
        source.type === 'USER_OVERRIDE' ? 'USER_ENTERED' : 'CALCULATED',
      verification:
        source.type === 'VERIFIED_LOCATION_PROVIDER' ||
        source.type === 'VERIFIED_RECORD'
          ? 'VERIFIED'
          : 'UNVERIFIED',
      sourceName: source.sourceName,
      ...(source.verifiedAt === undefined
        ? {}
        : { verifiedAt: source.verifiedAt }),
      explanation: source.explanation,
    },
  });
}

export function scheduleOperationalEvent(
  planInput: OperationalEventPlan,
  startAtInput: UtcInstant,
  departureStateInput: DriverHosDepartureState,
  priorDutyEvents: readonly DutyEvent[],
  availableLocations: readonly OperationalLocation[] = [],
): OperationalTimelineEvent {
  const plan = validateOperationalEventPlan(planInput);
  const startAt = UtcInstantSchema.parse(startAtInput);
  const departureState = validateDriverHosDepartureState(departureStateInput);
  const selection = selectOperationalLocation(plan, availableLocations);
  if (selection.status === 'UNAVAILABLE' || selection.location === undefined) {
    return freeze({
      status: 'PLACEMENT_UNAVAILABLE',
      plan,
      explanations: selection.explanations,
    });
  }

  const duration = expectedDuration(plan.duration);
  const dutyEvent = makeDutyEvent(
    plan.eventId,
    EVENT_TO_DUTY_TYPE[plan.type],
    plan.dutyStatus,
    startAt,
    duration,
    selection.location,
    plan.source,
    plan.explanation,
    plan.allowThirtyMinuteInterruptionOverlap,
  );
  const planningBufferEvent =
    plan.planningBuffer === undefined
      ? undefined
      : makeDutyEvent(
          `${plan.eventId}:planning-buffer`,
          EVENT_TO_DUTY_TYPE[plan.type],
          plan.dutyStatus,
          dutyEvent.endAt,
          plan.planningBuffer.duration,
          selection.location,
          plan.planningBuffer.source,
          `Planning buffer for ${plan.type}: ${plan.planningBuffer.explanation} This buffer is not represented as a legal minimum.`,
          plan.allowThirtyMinuteInterruptionOverlap,
        );
  const dutyEvents = [
    ...priorDutyEvents,
    dutyEvent,
    ...(planningBufferEvent === undefined ? [] : [planningBufferEvent]),
  ];
  const hosResult = calculateHosCore({ departureState, dutyEvents });
  const violations = hosResult.violations.filter(
    (violation) =>
      violation.eventId === dutyEvent.id ||
      violation.eventId === planningBufferEvent?.id,
  );

  return freeze({
    status: violations.length === 0 ? 'SCHEDULED' : 'HOS_BLOCKED',
    plan,
    location: selection.location,
    dutyEvent,
    ...(planningBufferEvent === undefined ? {} : { planningBufferEvent }),
    hosResult,
    explanations: freezeArray([
      ...selection.explanations,
      `${plan.type} is recorded as ${plan.dutyStatus} for ${String(duration.value)} minute(s).`,
      ...(planningBufferEvent === undefined
        ? []
        : [
            `A separate ${String(planningBufferEvent.duration.value)}-minute planning buffer was added and was not hidden in drive time.`,
          ]),
      dutyEvent.qualifiesForThirtyMinuteInterruption
        ? 'The event duration and non-driving duty status qualify for the configured 30-minute interruption overlap.'
        : 'The event does not claim a qualifying 30-minute interruption overlap.',
      ...(violations.length === 0
        ? []
        : ['The operational event cannot be added without an HOS violation.']),
    ]),
  });
}

function usableFuel(level: number, reserve: number): number {
  return Math.max(0, level - reserve);
}

function fuelRangeMiles(level: number, reserve: number, mpg: number): number {
  return usableFuel(level, reserve) * mpg;
}

function validFuelLocations(
  locations: readonly OperationalLocation[],
  routeMiles: number,
): readonly OperationalLocation[] {
  return freezeArray(
    locations
      .map((location) => OperationalLocationSchema.parse(location))
      .filter((location) => location.truckCompatible)
      .filter((location) => location.capabilities.includes('FUEL'))
      .filter(
        (location) =>
          location.source.type === 'VERIFIED_LOCATION_PROVIDER' ||
          location.source.type === 'VERIFIED_RECORD',
      )
      .filter((location) => {
        const miles = toMiles(location.routeDistance);
        return miles >= 0 && miles <= routeMiles;
      })
      .sort(
        (left, right) =>
          left.routeDistance.value - right.routeDistance.value,
      ),
  );
}

export function planFuelStops(input: FuelPlanningInput): FuelPlan {
  const capacityResult = VolumeSchema.safeParse(input.fuelCapacity);
  const currentResult = VolumeSchema.safeParse(input.currentFuelLevel);
  const reserveResult = VolumeSchema.safeParse(input.requiredReserve);
  const routeResult = DistanceSchema.safeParse(input.routeDistance);
  const mpgResult = positiveFinite.safeParse(input.estimatedMilesPerGallon);
  const capacity = capacityResult.success ? capacityResult.data.value : 0;
  const current = currentResult.success ? currentResult.data.value : 0;
  const reserve = reserveResult.success ? reserveResult.data.value : 0;
  const routeDistance = routeResult.success
    ? routeResult.data
    : distanceInMiles(0);
  const routeMiles = toMiles(routeDistance);
  const mpg = mpgResult.success ? mpgResult.data : 0;
  const estimatedConsumed = mpg > 0 ? routeMiles / mpg : 0;
  const initialUsable = usableFuel(current, reserve);
  const initialRangeMiles = mpg > 0 ? fuelRangeMiles(current, reserve, mpg) : 0;

  const base = {
    routeDistance,
    initialUsableFuel: volumeInUsGallons(initialUsable),
    initialRange: distanceInMiles(initialRangeMiles),
    estimatedFuelConsumed: volumeInUsGallons(estimatedConsumed),
  };

  if (
    !capacityResult.success ||
    !currentResult.success ||
    !reserveResult.success ||
    !routeResult.success ||
    !mpgResult.success ||
    capacity <= 0 ||
    current > capacity ||
    reserve >= capacity
  ) {
    return freeze({
      status: 'BLOCKED',
      blockingReason: 'INVALID_FUEL_INPUT',
      ...base,
      stops: freezeArray([]),
      explanations: freezeArray([
        'Fuel capacity, current level, reserve, MPG, and route distance must form a physically consistent plan.',
      ]),
    });
  }
  if (current < reserve) {
    return freeze({
      status: 'BLOCKED',
      blockingReason: 'CURRENT_LEVEL_BELOW_RESERVE',
      ...base,
      stops: freezeArray([]),
      explanations: freezeArray([
        'Current estimated fuel is below the required reserve before route departure.',
      ]),
    });
  }
  if (routeMiles <= initialRangeMiles) {
    return freeze({
      status: 'NOT_REQUIRED',
      ...base,
      stops: freezeArray([]),
      explanations: freezeArray([
        'The entered current fuel level can cover the route while preserving the required reserve.',
      ]),
    });
  }

  const locations = validFuelLocations(input.locations, routeMiles);
  if (locations.length === 0) {
    return freeze({
      status: 'BLOCKED',
      blockingReason: 'NO_TRUCK_COMPATIBLE_LOCATION',
      ...base,
      stops: freezeArray([]),
      explanations: freezeArray([
        'Range is insufficient and no verified truck-compatible fuel location is available.',
        'The planner did not fabricate a fuel stop.',
      ]),
    });
  }

  const fullTankRange = fuelRangeMiles(capacity, reserve, mpg);
  let positionMiles = 0;
  let fuelGallons = current;
  const stops: PlannedFuelStop[] = [];
  const remaining = [...locations];

  while (positionMiles + fuelRangeMiles(fuelGallons, reserve, mpg) < routeMiles) {
    const maximumReach = positionMiles + fuelRangeMiles(fuelGallons, reserve, mpg);
    const reachable = remaining.filter((location) => {
      const miles = toMiles(location.routeDistance);
      return miles > positionMiles && miles <= maximumReach;
    });
    const selected = reachable.at(-1);
    if (selected === undefined) {
      return freeze({
        status: 'BLOCKED',
        blockingReason:
          remaining.length === 0
            ? 'NO_TRUCK_COMPATIBLE_LOCATION'
            : 'INSUFFICIENT_RANGE',
        ...base,
        stops: freezeArray(stops),
        explanations: freezeArray([
          `The route contains an uncovered fuel gap after ${String(Math.round(positionMiles))} mile(s).`,
          `A full tank preserving reserve reaches approximately ${String(Math.round(fullTankRange))} mile(s).`,
          'The planner did not invent an unavailable location.',
        ]),
      });
    }

    const selectedMiles = toMiles(selected.routeDistance);
    const burned = (selectedMiles - positionMiles) / mpg;
    const arrivalFuel = Math.max(0, fuelGallons - burned);
    const gallonsAdded = capacity - arrivalFuel;
    fuelGallons = capacity;
    positionMiles = selectedMiles;
    stops.push(
      freeze({
        sequence: stops.length + 1,
        location: freeze({
          ...selected,
          capabilities: freezeArray(selected.capabilities),
          source: freeze(selected.source),
        }),
        routeDistance: selected.routeDistance,
        arrivalFuel: volumeInUsGallons(arrivalFuel),
        gallonsAdded: volumeInUsGallons(gallonsAdded),
        departureFuel: volumeInUsGallons(capacity),
        explanation:
          'Planned only from a verified truck-compatible location and modeled as filling to entered capacity.',
      }),
    );
    const index = remaining.findIndex(
      (candidate) => candidate.locationId === selected.locationId,
    );
    remaining.splice(0, index + 1);
  }

  return freeze({
    status: 'PLANNED',
    ...base,
    stops: freezeArray(stops),
    explanations: freezeArray([
      `Planned ${String(stops.length)} verified truck-compatible fuel stop(s).`,
      'Each planned fuel stop must be inserted as an explicit on-duty operational event unless authoritative legal support says otherwise.',
      'Fuel availability remains limited to the supplied verified location evidence.',
    ]),
  });
}

export function operationalPlanSnapshot(
  plans: readonly OperationalEventPlan[],
): Readonly<Record<string, unknown>> {
  const validated = plans.map(validateOperationalEventPlan);
  return freeze({
    operationalEvents: freezeArray(
      validated.map((plan) =>
        freeze({
          eventId: plan.eventId,
          type: plan.type,
          duration: plan.duration,
          dutyStatus: plan.dutyStatus,
          source: plan.source,
          ...(plan.location === undefined ? {} : { location: plan.location }),
          placement: plan.placement,
          ...(plan.planningBuffer === undefined
            ? {}
            : { planningBuffer: plan.planningBuffer }),
          allowThirtyMinuteInterruptionOverlap:
            plan.allowThirtyMinuteInterruptionOverlap,
          allowRestOverlap: plan.allowRestOverlap,
          required: plan.required,
          userOverride: plan.userOverride,
          ...(plan.legalDutyStatusSupport === undefined
            ? {}
            : { legalDutyStatusSupport: plan.legalDutyStatusSupport }),
          explanation: plan.explanation,
        }),
      ),
    ),
  });
}

export const SUGGESTED_OPERATIONAL_EVENT_DURATIONS = Object.freeze({
  PRE_TRIP_INSPECTION: durationInMinutes(30),
  POST_TRIP_INSPECTION: durationInMinutes(15),
  FUEL: durationInMinutes(30),
  SCALE: durationInMinutes(15),
  CARGO_SECUREMENT_CHECK: durationInMinutes(15),
  REEFER_CHECK: durationInMinutes(10),
  MAINTENANCE: durationInMinutes(60),
  BORDER_OR_AGRICULTURAL_INSPECTION: durationInMinutes(30),
  PARKING_SEARCH: durationInMinutes(20),
  MEAL: durationInMinutes(30),
  SHOWER: durationInMinutes(30),
} satisfies Readonly<Record<OperationalEventType, Duration>>);

export function volumeFromFuelFraction(
  capacity: Volume,
  fraction: number,
): Volume {
  const parsedCapacity = VolumeSchema.parse(capacity);
  const parsedFraction = nonNegativeFinite.max(1).parse(fraction);
  return volumeInUsGallons(parsedCapacity.value * parsedFraction);
}
