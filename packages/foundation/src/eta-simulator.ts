import { Temporal } from '@js-temporal/polyfill';
import { z } from 'zod';

import type {
  CommercialRouteLeg,
  CommercialRouteSegment,
  NormalizedCommercialRouteResult,
} from './commercial-routing.js';
import { CommercialRouteLegSchema } from './commercial-routing.js';
import { calculateHosCore } from './hos-core.js';
import type {
  HosCoreCalculationResult,
  HosCoreClockSnapshot,
  HosCoreNextActionCode,
} from './hos-core.js';
import {
  validateDriverHosDepartureState,
  validateDutyEvent,
} from './hos.js';
import type {
  DriverHosDepartureState,
  DutyEvent,
  DutyEventType,
  HosDutyStatus,
} from './hos.js';
import {
  OperationalEventPlanSchema,
  OperationalLocationSchema,
  OperationalPlacementConstraintSchema,
  scheduleOperationalEvent,
  validateOperationalEventPlan,
} from './operational-events-guard.js';
import type {
  OperationalEventPlan,
  OperationalLocation,
  OperationalPlacementConstraint,
} from './operational-events-guard.js';
import { processStop, validateOrderedStops } from './stops.js';
import type {
  StopProcessingResult,
  StopProjection,
  TripStopPlan,
} from './stops.js';
import {
  IanaTimeZoneSchema,
  UtcInstantSchema,
  formatInstantAtZone,
  utcInstant,
} from './time.js';
import type {
  DisplayLocalTime,
  IanaTimeZone,
  UtcInstant,
} from './time.js';
import {
  DurationSchema,
  SpeedSchema,
  distanceInMeters,
  durationInMinutes,
  speed,
} from './units.js';
import type {
  Distance,
  Duration,
  Speed,
} from './units.js';

const nonEmptyText = z.string().trim().min(1);
const positiveBasisPoints = z.number().int().min(1).max(10_000);

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

function instantMilliseconds(value: UtcInstant): number {
  return Temporal.Instant.from(value).epochMilliseconds;
}

function compareInstants(left: UtcInstant, right: UtcInstant): number {
  return Temporal.Instant.compare(
    Temporal.Instant.from(left),
    Temporal.Instant.from(right),
  );
}

function addMinutes(value: UtcInstant, minutes: number): UtcInstant {
  return utcInstant(
    Temporal.Instant.from(value).add({ minutes }).toString({
      smallestUnit: 'millisecond',
    }),
  );
}

function minutesBetween(startAt: UtcInstant, endAt: UtcInstant): number {
  const milliseconds = instantMilliseconds(endAt) - instantMilliseconds(startAt);
  if (milliseconds < 0 || milliseconds % 60_000 !== 0) {
    throw new EtaSimulationError(
      'INVALID_TIME_ORDER',
      'ETA simulation timestamps must advance on whole-minute boundaries.',
    );
  }
  return milliseconds / 60_000;
}

function currentTime(context: SimulationHosContext): UtcInstant {
  return context.phaseDutyEvents.at(-1)?.endAt ?? context.departureState.departureAt;
}

function requiredItem<T>(
  values: readonly T[],
  index: number,
  message: string,
): T {
  const value = values[index];
  if (value === undefined) {
    throw new EtaSimulationError('ROUTE_STOP_MISMATCH', message);
  }
  return value;
}

export const ETA_PROJECTIONS = [
  'EARLIEST_LEGAL',
  'EXPECTED',
  'CONSERVATIVE',
] as const;
export type EtaProjection = (typeof ETA_PROJECTIONS)[number];

export const ETA_ROAD_CLASSES = [
  'INTERSTATE',
  'FREEWAY',
  'ARTERIAL',
  'LOCAL',
  'MOUNTAIN',
  'URBAN',
  'OTHER',
] as const;
export type EtaRoadClass = (typeof ETA_ROAD_CLASSES)[number];

export const ETA_CONFIDENCE_LEVELS = ['HIGH', 'MEDIUM', 'LOW', 'BLOCKED'] as const;
export type EtaConfidenceLevel = (typeof ETA_CONFIDENCE_LEVELS)[number];

export const ETA_TIMELINE_EVENT_TYPES = [
  'STOP_ARRIVAL',
  'STOP_WAIT',
  'STOP_CHECK_IN',
  'STOP_SERVICE',
  'STOP_HOS_HOLD',
  'STOP_DEPARTURE',
  'DRIVING',
  'OPERATIONAL_EVENT',
  'PLANNING_BUFFER',
  'HOS_ACTION',
  'COMPLIANCE_CLEARED',
  'COMPLIANCE_BLOCK',
  'ROUTE_BLOCK',
] as const;
export type EtaTimelineEventType = (typeof ETA_TIMELINE_EVENT_TYPES)[number];

export const EtaProjectedDurationSchema = z
  .object({
    minimum: DurationSchema,
    expected: DurationSchema,
    maximum: DurationSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.minimum.value > value.expected.value ||
      value.expected.value > value.maximum.value
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expected'],
        message: 'Projected duration must satisfy minimum <= expected <= maximum.',
      });
    }
  });
export type EtaProjectedDuration = Readonly<
  z.infer<typeof EtaProjectedDurationSchema>
>;

export const EtaProjectionSpeedFactorsSchema = z
  .object({
    earliestLegalBasisPoints: positiveBasisPoints,
    expectedBasisPoints: positiveBasisPoints,
    conservativeBasisPoints: positiveBasisPoints,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.expectedBasisPoints > value.earliestLegalBasisPoints ||
      value.conservativeBasisPoints > value.expectedBasisPoints
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expectedBasisPoints'],
        message:
          'Projection speed factors must satisfy conservative <= expected <= earliest legal.',
      });
    }
  });

const PositiveSpeedSchema = SpeedSchema.refine(
  (value) => value.value > 0,
  'Speed must be greater than zero.',
);

export const EtaRoadClassSpeedSchema = z
  .object({
    roadClass: z.enum(ETA_ROAD_CLASSES),
    speed: PositiveSpeedSchema,
  })
  .strict();

export const EtaSpeedModelSchema = z
  .object({
    governedMaximumSpeed: PositiveSpeedSchema,
    preferredPlanningSpeed: PositiveSpeedSchema,
    maximumAverageTripSpeed: PositiveSpeedSchema,
    carrierMaximumSpeed: PositiveSpeedSchema,
    fallbackAverageSpeed: PositiveSpeedSchema,
    roadClassSpeeds: z.array(EtaRoadClassSpeedSchema).min(1),
    projectionFactors: EtaProjectionSpeedFactorsSchema,
    explanation: nonEmptyText,
  })
  .strict()
  .superRefine((value, context) => {
    const governed = value.governedMaximumSpeed.value;
    const capped = [
      ['preferredPlanningSpeed', value.preferredPlanningSpeed.value],
      ['maximumAverageTripSpeed', value.maximumAverageTripSpeed.value],
      ['carrierMaximumSpeed', value.carrierMaximumSpeed.value],
      ['fallbackAverageSpeed', value.fallbackAverageSpeed.value],
    ] as const;
    for (const [path, candidate] of capped) {
      if (candidate > governed) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [path],
          message: 'Configured planning speeds cannot exceed governed maximum speed.',
        });
      }
    }
    if (value.fallbackAverageSpeed.value >= governed) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fallbackAverageSpeed'],
        message:
          'Fallback average speed must be lower than governed maximum speed; the whole trip cannot be estimated at governed maximum.',
      });
    }
    if (
      new Set(value.roadClassSpeeds.map((entry) => entry.roadClass)).size !==
      value.roadClassSpeeds.length
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['roadClassSpeeds'],
        message: 'Road-class speed assumptions must use unique road classes.',
      });
    }
  });
export type EtaSpeedModel = Readonly<
  Omit<z.infer<typeof EtaSpeedModelSchema>, 'roadClassSpeeds'> & {
    readonly roadClassSpeeds: readonly Readonly<
      z.infer<typeof EtaRoadClassSpeedSchema>
    >[];
  }
>;

const EtaAvailableAdjustmentSchema = z
  .object({
    status: z.literal('AVAILABLE'),
    duration: EtaProjectedDurationSchema,
    sourceName: nonEmptyText,
    reference: nonEmptyText.optional(),
    confidence: z.enum(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']),
    explanation: nonEmptyText,
  })
  .strict();

const EtaUnavailableAdjustmentSchema = z
  .object({
    status: z.literal('UNAVAILABLE'),
    reason: nonEmptyText,
  })
  .strict();

export const EtaExternalAdjustmentSchema = z.discriminatedUnion('status', [
  EtaAvailableAdjustmentSchema,
  EtaUnavailableAdjustmentSchema,
]);
export type EtaExternalAdjustment = Readonly<
  z.infer<typeof EtaExternalAdjustmentSchema>
>;

export const EtaSegmentConditionSchema = z
  .object({
    segmentId: nonEmptyText,
    roadClass: z.enum(ETA_ROAD_CLASSES),
    startTimeZone: IanaTimeZoneSchema,
    endTimeZone: IanaTimeZoneSchema,
    legalOrProviderSpeedLimit: PositiveSpeedSchema.optional(),
    gradeSpeedCap: PositiveSpeedSchema.optional(),
    urbanSpeedCap: PositiveSpeedSchema.optional(),
    traffic: EtaExternalAdjustmentSchema,
    weather: EtaExternalAdjustmentSchema,
    explanation: nonEmptyText,
  })
  .strict();
export type EtaSegmentCondition = Readonly<
  z.infer<typeof EtaSegmentConditionSchema>
>;

export const ETA_COMPLIANCE_ACTION_STATUSES = [
  'CLEARED',
  'ACTION_REQUIRED',
  'BLOCKING',
] as const;
export type EtaComplianceActionStatus =
  (typeof ETA_COMPLIANCE_ACTION_STATUSES)[number];

export const EtaComplianceActionSchema = z
  .object({
    actionId: nonEmptyText,
    status: z.enum(ETA_COMPLIANCE_ACTION_STATUSES),
    placement: OperationalPlacementConstraintSchema,
    actionEvent: OperationalEventPlanSchema.optional(),
    sourceReference: nonEmptyText.optional(),
    explanation: nonEmptyText,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === 'ACTION_REQUIRED' && value.actionEvent === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['actionEvent'],
        message: 'ACTION_REQUIRED compliance evidence needs an operational action event.',
      });
    }
    if (value.status === 'BLOCKING' && value.actionEvent !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['actionEvent'],
        message: 'A blocking compliance finding cannot be disguised as a schedulable event.',
      });
    }
  });
export type EtaComplianceAction = Readonly<
  z.infer<typeof EtaComplianceActionSchema>
>;

export const ETA_HOS_AVAILABILITY_ACTION_KINDS = [
  'RECAP_WAIT',
  'PLANNED_THIRTY_FOUR_HOUR_RESTART',
  'SELECTED_SLEEPER_ACTION',
] as const;
export type EtaHosAvailabilityActionKind =
  (typeof ETA_HOS_AVAILABILITY_ACTION_KINDS)[number];

export interface EtaHosAvailabilityAction {
  readonly actionId: string;
  readonly trigger: HosCoreNextActionCode;
  readonly kind: EtaHosAvailabilityActionKind;
  readonly availableAt?: UtcInstant | undefined;
  readonly duration?: Duration | undefined;
  readonly dutyStatus: 'OFF_DUTY' | 'SLEEPER_BERTH';
  readonly location: Readonly<{
    description: string;
    timeZone: IanaTimeZone;
  }>;
  readonly resultingDepartureState: DriverHosDepartureState;
  readonly sourceReference: string;
  readonly explanation: string;
}

export interface EtaInitialHosContext {
  readonly departureState: DriverHosDepartureState;
  readonly dutyEvents: readonly DutyEvent[];
}

export interface EtaSimulationInput {
  readonly route: NormalizedCommercialRouteResult;
  readonly stops: readonly TripStopPlan[];
  readonly initialHosContext: EtaInitialHosContext;
  readonly speedModel: EtaSpeedModel;
  readonly segmentConditions: readonly EtaSegmentCondition[];
  readonly operationalEvents: readonly OperationalEventPlan[];
  readonly availableOperationalLocations: readonly OperationalLocation[];
  readonly complianceActions: readonly EtaComplianceAction[];
  readonly hosAvailabilityActions: readonly EtaHosAvailabilityAction[];
  readonly homeTerminalTimeZone?: IanaTimeZone | undefined;
}

export interface EtaSpeedDecision {
  readonly segmentId: string;
  readonly projection: EtaProjection;
  readonly selectedSpeed: Speed;
  readonly travelDuration: Duration;
  readonly providerTravelDuration?: Duration | undefined;
  readonly trafficDelay: Duration;
  readonly weatherDelay: Duration;
  readonly source: 'VERIFIED_PROVIDER_TIME' | 'FALLBACK_AVERAGE';
  readonly limitingFactors: readonly string[];
  readonly confidenceReasons: readonly string[];
  readonly explanation: string;
}

export interface EtaTimelineEvent {
  readonly eventId: string;
  readonly type: EtaTimelineEventType;
  readonly startAt: UtcInstant;
  readonly endAt: UtcInstant;
  readonly duration: Duration;
  readonly startLocal: DisplayLocalTime;
  readonly endLocal: DisplayLocalTime;
  readonly dutyStatus?: HosDutyStatus | undefined;
  readonly hosBefore: HosCoreClockSnapshot;
  readonly hosAfter: HosCoreClockSnapshot;
  readonly stopId?: string | undefined;
  readonly routeLegId?: string | undefined;
  readonly segmentId?: string | undefined;
  readonly operationalEventId?: string | undefined;
  readonly complianceActionId?: string | undefined;
  readonly explanation: string;
}

export interface EtaProjectionResult {
  readonly projection: EtaProjection;
  readonly status: 'COMPLETE' | 'BLOCKED';
  readonly startedAt: UtcInstant;
  readonly completedAt?: UtcInstant | undefined;
  readonly finalStopId?: string | undefined;
  readonly timeline: readonly EtaTimelineEvent[];
  readonly stopResults: readonly StopProcessingResult[];
  readonly speedDecisions: readonly EtaSpeedDecision[];
  readonly finalHosClocks: HosCoreClockSnapshot;
  readonly confidence: EtaConfidenceLevel;
  readonly confidenceReasons: readonly string[];
  readonly blockingReasons: readonly string[];
  readonly explanations: readonly string[];
}

export interface EtaSimulationResult {
  readonly simulatorVersion: 'stage-15-v1';
  readonly routeId: string;
  readonly earliestLegal: EtaProjectionResult;
  readonly expected: EtaProjectionResult;
  readonly conservative: EtaProjectionResult;
  readonly explanations: readonly string[];
}

export type EtaSimulationErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_TIME_ORDER'
  | 'ROUTE_STOP_MISMATCH'
  | 'MISSING_SEGMENT_CONDITION'
  | 'DUPLICATE_IDENTIFIER'
  | 'INVALID_HOS_ACTION';

export class EtaSimulationError extends Error {
  public override readonly name = 'EtaSimulationError';

  public constructor(
    public readonly code: EtaSimulationErrorCode,
    message: string,
  ) {
    super(message);
  }
}

interface SimulationHosContext {
  departureState: DriverHosDepartureState;
  phaseDutyEvents: DutyEvent[];
  allDutyEvents: DutyEvent[];
}

interface MutableProjectionState {
  readonly projection: EtaProjection;
  readonly route: NormalizedCommercialRouteResult;
  readonly stops: readonly TripStopPlan[];
  readonly speedModel: EtaSpeedModel;
  readonly segmentConditions: ReadonlyMap<string, EtaSegmentCondition>;
  readonly availableOperationalLocations: readonly OperationalLocation[];
  readonly operationalEvents: readonly OperationalEventPlan[];
  readonly complianceActions: readonly EtaComplianceAction[];
  readonly hosAvailabilityActions: readonly EtaHosAvailabilityAction[];
  readonly usedOperationalEventIds: Set<string>;
  readonly usedComplianceActionIds: Set<string>;
  readonly usedHosActionIds: Set<string>;
  readonly timeline: EtaTimelineEvent[];
  readonly stopResults: StopProcessingResult[];
  readonly speedDecisions: EtaSpeedDecision[];
  readonly confidenceReasons: string[];
  readonly blockingReasons: string[];
  readonly explanations: string[];
  readonly hos: SimulationHosContext;
  blocked: boolean;
  eventCounter: number;
}

function stopProjection(projection: EtaProjection): StopProjection {
  switch (projection) {
    case 'EARLIEST_LEGAL':
      return 'earliest';
    case 'EXPECTED':
      return 'expected';
    case 'CONSERVATIVE':
      return 'conservative';
  }
}

function projectionDuration(
  duration: EtaProjectedDuration,
  projection: EtaProjection,
): Duration {
  switch (projection) {
    case 'EARLIEST_LEGAL':
      return duration.minimum;
    case 'EXPECTED':
      return duration.expected;
    case 'CONSERVATIVE':
      return duration.maximum;
  }
}

function projectedOperationalPlan(
  planInput: OperationalEventPlan,
  projection: EtaProjection,
): OperationalEventPlan {
  const plan = validateOperationalEventPlan(planInput);
  if (plan.duration.mode === 'EXACT') return plan;
  const selected =
    projection === 'EARLIEST_LEGAL'
      ? plan.duration.minimum
      : projection === 'EXPECTED'
        ? plan.duration.expected
        : plan.duration.maximum;
  return validateOperationalEventPlan({
    ...plan,
    duration: { mode: 'EXACT', duration: selected },
  });
}

function calculateContext(context: SimulationHosContext): HosCoreCalculationResult {
  return calculateHosCore({
    departureState: context.departureState,
    dutyEvents: context.phaseDutyEvents,
  });
}

function clockEffects(status: HosDutyStatus): DutyEvent['clockEffects'] {
  switch (status) {
    case 'DRIVING':
      return freeze({
        driving: 'CONSUMES' as const,
        shift: 'ADVANCES_WINDOW' as const,
        cycle: 'CONSUMES' as const,
      });
    case 'ON_DUTY_NOT_DRIVING':
      return freeze({
        driving: 'DOES_NOT_CONSUME' as const,
        shift: 'ADVANCES_WINDOW' as const,
        cycle: 'CONSUMES' as const,
      });
    case 'OFF_DUTY':
      return freeze({
        driving: 'DOES_NOT_CONSUME' as const,
        shift: 'ADVANCES_WINDOW' as const,
        cycle: 'DOES_NOT_CONSUME' as const,
      });
    case 'SLEEPER_BERTH':
      return freeze({
        driving: 'DOES_NOT_CONSUME' as const,
        shift: 'RULE_DEPENDENT' as const,
        cycle: 'DOES_NOT_CONSUME' as const,
      });
  }
}

function dutyEvent(
  id: string,
  startAt: UtcInstant,
  minutes: number,
  dutyStatus: HosDutyStatus,
  eventType: DutyEventType,
  description: string,
  timeZone: IanaTimeZone,
  explanation: string,
): DutyEvent {
  return validateDutyEvent({
    id,
    startAt,
    endAt: addMinutes(startAt, minutes),
    duration: durationInMinutes(minutes),
    dutyStatus,
    eventType,
    location: { description, timeZone },
    source: 'CALCULATED',
    explanation,
    clockEffects: clockEffects(dutyStatus),
    qualifiesForThirtyMinuteInterruption:
      dutyStatus !== 'DRIVING' && minutes >= 30,
    sleeperPair: { participates: false },
    provenance: {
      origin: 'CALCULATED',
      verification: 'UNVERIFIED',
      sourceName: 'Stage 15 ETA simulator',
      explanation,
    },
  });
}

function nextEventId(state: MutableProjectionState, prefix: string): string {
  state.eventCounter += 1;
  return `eta-${state.projection.toLowerCase()}-${String(state.eventCounter)}-${prefix}`;
}

function displayAt(instant: UtcInstant, zone: IanaTimeZone): DisplayLocalTime {
  return formatInstantAtZone(instant, zone);
}

function timelineEvent(
  state: MutableProjectionState,
  input: Readonly<{
    type: EtaTimelineEventType;
    startAt: UtcInstant;
    endAt: UtcInstant;
    startZone: IanaTimeZone;
    endZone: IanaTimeZone;
    hosBefore: HosCoreClockSnapshot;
    hosAfter: HosCoreClockSnapshot;
    dutyStatus?: HosDutyStatus | undefined;
    stopId?: string | undefined;
    routeLegId?: string | undefined;
    segmentId?: string | undefined;
    operationalEventId?: string | undefined;
    complianceActionId?: string | undefined;
    explanation: string;
  }>,
): EtaTimelineEvent {
  return freeze({
    eventId: nextEventId(state, input.type.toLowerCase()),
    type: input.type,
    startAt: input.startAt,
    endAt: input.endAt,
    duration: durationInMinutes(minutesBetween(input.startAt, input.endAt)),
    startLocal: displayAt(input.startAt, input.startZone),
    endLocal: displayAt(input.endAt, input.endZone),
    ...(input.dutyStatus === undefined ? {} : { dutyStatus: input.dutyStatus }),
    hosBefore: input.hosBefore,
    hosAfter: input.hosAfter,
    ...(input.stopId === undefined ? {} : { stopId: input.stopId }),
    ...(input.routeLegId === undefined ? {} : { routeLegId: input.routeLegId }),
    ...(input.segmentId === undefined ? {} : { segmentId: input.segmentId }),
    ...(input.operationalEventId === undefined
      ? {}
      : { operationalEventId: input.operationalEventId }),
    ...(input.complianceActionId === undefined
      ? {}
      : { complianceActionId: input.complianceActionId }),
    explanation: input.explanation,
  });
}

function appendDutyEvent(
  state: MutableProjectionState,
  event: DutyEvent,
  input: Readonly<{
    type: EtaTimelineEventType;
    startZone: IanaTimeZone;
    endZone?: IanaTimeZone | undefined;
    stopId?: string | undefined;
    routeLegId?: string | undefined;
    segmentId?: string | undefined;
    operationalEventId?: string | undefined;
    complianceActionId?: string | undefined;
    explanation?: string | undefined;
  }>,
): void {
  const before = calculateContext(state.hos).final;
  state.hos.phaseDutyEvents.push(event);
  state.hos.allDutyEvents.push(event);
  const result = calculateContext(state.hos);
  if (result.violations.length > 0) {
    throw new EtaSimulationError(
      'INVALID_INPUT',
      `ETA simulator generated an illegal duty event ${event.id}.`,
    );
  }
  state.timeline.push(
    timelineEvent(state, {
      type: input.type,
      startAt: event.startAt,
      endAt: event.endAt,
      startZone: input.startZone,
      endZone: input.endZone ?? input.startZone,
      hosBefore: before,
      hosAfter: result.final,
      dutyStatus: event.dutyStatus,
      ...(input.stopId === undefined ? {} : { stopId: input.stopId }),
      ...(input.routeLegId === undefined
        ? {}
        : { routeLegId: input.routeLegId }),
      ...(input.segmentId === undefined ? {} : { segmentId: input.segmentId }),
      ...(input.operationalEventId === undefined
        ? {}
        : { operationalEventId: input.operationalEventId }),
      ...(input.complianceActionId === undefined
        ? {}
        : { complianceActionId: input.complianceActionId }),
      explanation: input.explanation ?? event.explanation,
    }),
  );
}

function appendInstantEvent(
  state: MutableProjectionState,
  input: Readonly<{
    type: EtaTimelineEventType;
    at: UtcInstant;
    timeZone: IanaTimeZone;
    stopId?: string | undefined;
    routeLegId?: string | undefined;
    segmentId?: string | undefined;
    complianceActionId?: string | undefined;
    explanation: string;
  }>,
): void {
  const clocks = calculateContext(state.hos).final;
  state.timeline.push(
    timelineEvent(state, {
      type: input.type,
      startAt: input.at,
      endAt: input.at,
      startZone: input.timeZone,
      endZone: input.timeZone,
      hosBefore: clocks,
      hosAfter: clocks,
      ...(input.stopId === undefined ? {} : { stopId: input.stopId }),
      ...(input.routeLegId === undefined
        ? {}
        : { routeLegId: input.routeLegId }),
      ...(input.segmentId === undefined ? {} : { segmentId: input.segmentId }),
      ...(input.complianceActionId === undefined
        ? {}
        : { complianceActionId: input.complianceActionId }),
      explanation: input.explanation,
    }),
  );
}

function roadClassSpeed(model: EtaSpeedModel, roadClass: EtaRoadClass): Speed {
  return (
    model.roadClassSpeeds.find((entry) => entry.roadClass === roadClass)?.speed ??
    model.fallbackAverageSpeed
  );
}

function factorBasisPoints(
  model: EtaSpeedModel,
  projection: EtaProjection,
): number {
  switch (projection) {
    case 'EARLIEST_LEGAL':
      return model.projectionFactors.earliestLegalBasisPoints;
    case 'EXPECTED':
      return model.projectionFactors.expectedBasisPoints;
    case 'CONSERVATIVE':
      return model.projectionFactors.conservativeBasisPoints;
  }
}

function durationFromDistanceAndSpeed(distance: Distance, selectedSpeed: Speed): number {
  if (selectedSpeed.value <= 0) {
    throw new EtaSimulationError('INVALID_INPUT', 'Selected speed must be positive.');
  }
  return Math.max(1, Math.ceil(distance.value / selectedSpeed.value / 60));
}

function projectedAdjustmentMinutes(
  adjustment: EtaExternalAdjustment,
  projection: EtaProjection,
  label: string,
  confidenceReasons: string[],
): number {
  if (adjustment.status === 'UNAVAILABLE') {
    confidenceReasons.push(`${label} unavailable: ${adjustment.reason}`);
    return 0;
  }
  if (adjustment.confidence !== 'HIGH') {
    confidenceReasons.push(
      `${label} confidence is ${adjustment.confidence.toLowerCase()}: ${adjustment.explanation}`,
    );
  }
  return projectionDuration(adjustment.duration, projection).value;
}

export function calculateEtaSegmentSpeed(
  segmentInput: CommercialRouteSegment,
  conditionInput: EtaSegmentCondition,
  modelInput: EtaSpeedModel,
  projectionInput: EtaProjection,
): EtaSpeedDecision {
  const segment = CommercialRouteLegSchema.shape.segments.element.parse(segmentInput);
  const condition = EtaSegmentConditionSchema.parse(conditionInput);
  const model = EtaSpeedModelSchema.parse(modelInput);
  const projection = z.enum(ETA_PROJECTIONS).parse(projectionInput);
  if (condition.segmentId !== segment.segmentId) {
    throw new EtaSimulationError(
      'MISSING_SEGMENT_CONDITION',
      `Condition ${condition.segmentId} does not describe segment ${segment.segmentId}.`,
    );
  }

  const factors: Readonly<{ name: string; speed: Speed }>[] = [
    freeze({ name: 'governed maximum', speed: model.governedMaximumSpeed }),
    freeze({ name: 'preferred planning speed', speed: model.preferredPlanningSpeed }),
    freeze({ name: 'maximum average trip speed', speed: model.maximumAverageTripSpeed }),
    freeze({ name: 'carrier maximum speed', speed: model.carrierMaximumSpeed }),
    freeze({ name: `${condition.roadClass.toLowerCase()} road class`, speed: roadClassSpeed(model, condition.roadClass) }),
  ];
  if (segment.expectedSpeed !== undefined) {
    factors.push(freeze({ name: 'provider expected speed', speed: segment.expectedSpeed }));
  }
  if (condition.legalOrProviderSpeedLimit !== undefined) {
    factors.push(
      freeze({
        name: 'legal or provider speed limit',
        speed: condition.legalOrProviderSpeedLimit,
      }),
    );
  }
  if (condition.gradeSpeedCap !== undefined) {
    factors.push(freeze({ name: 'grade speed cap', speed: condition.gradeSpeedCap }));
  }
  if (condition.urbanSpeedCap !== undefined) {
    factors.push(freeze({ name: 'urban speed cap', speed: condition.urbanSpeedCap }));
  }

  const unavailableProviderTime = segment.unavailableFields.some(
    (field) => field.path.includes('travelDuration'),
  );
  const providerTimeAvailable =
    segment.verificationStatus === 'verified' &&
    segment.travelDuration.value > 0 &&
    !unavailableProviderTime;
  const confidenceReasons: string[] = [];
  let source: EtaSpeedDecision['source'];
  if (providerTimeAvailable) {
    const providerSpeedValue =
      segment.distance.value / (segment.travelDuration.value * 60);
    factors.push(
      freeze({
        name: 'verified provider travel time',
        speed: speed({ value: providerSpeedValue, unit: 'meter-per-second' }),
      }),
    );
    source = 'VERIFIED_PROVIDER_TIME';
  } else {
    factors.push(freeze({ name: 'fallback average', speed: model.fallbackAverageSpeed }));
    confidenceReasons.push(
      `Segment ${segment.segmentId} uses the labeled fallback average because verified provider travel time is unavailable.`,
    );
    source = 'FALLBACK_AVERAGE';
  }

  const factor = factorBasisPoints(model, projection);
  const limiting = [...factors].sort((left, right) => left.speed.value - right.speed.value)[0];
  if (limiting === undefined) {
    throw new EtaSimulationError('INVALID_INPUT', 'No speed factor was available.');
  }
  const selectedSpeed = speed({
    value: (limiting.speed.value * factor) / 10_000,
    unit: 'meter-per-second',
  });
  const trafficMinutes = projectedAdjustmentMinutes(
    condition.traffic,
    projection,
    `Traffic for segment ${segment.segmentId}`,
    confidenceReasons,
  );
  const weatherMinutes = projectedAdjustmentMinutes(
    condition.weather,
    projection,
    `Weather for segment ${segment.segmentId}`,
    confidenceReasons,
  );
  const baseMinutes = durationFromDistanceAndSpeed(segment.distance, selectedSpeed);
  const totalMinutes = baseMinutes + trafficMinutes + weatherMinutes;

  return freeze({
    segmentId: segment.segmentId,
    projection,
    selectedSpeed,
    travelDuration: durationInMinutes(totalMinutes),
    ...(providerTimeAvailable
      ? { providerTravelDuration: segment.travelDuration }
      : {}),
    trafficDelay: durationInMinutes(trafficMinutes),
    weatherDelay: durationInMinutes(weatherMinutes),
    source,
    limitingFactors: freezeArray([
      limiting.name,
      `projection factor ${String(factor)} basis points`,
    ]),
    confidenceReasons: freezeArray(confidenceReasons),
    explanation:
      `${projection} segment time uses the slowest applicable speed constraint, whole-minute rounding, and explicit traffic/weather delays.`,
  });
}

function validateHosAvailabilityAction(
  input: EtaHosAvailabilityAction,
): EtaHosAvailabilityAction {
  if (input.actionId.trim() === '' || input.sourceReference.trim() === '') {
    throw new EtaSimulationError(
      'INVALID_HOS_ACTION',
      'HOS availability actions require non-empty identifiers and sources.',
    );
  }
  if (!ETA_HOS_AVAILABILITY_ACTION_KINDS.includes(input.kind)) {
    throw new EtaSimulationError('INVALID_HOS_ACTION', 'Unsupported HOS availability action.');
  }
  if (
    input.duration !== undefined &&
    DurationSchema.parse(input.duration).value <= 0
  ) {
    throw new EtaSimulationError(
      'INVALID_HOS_ACTION',
      'Explicit HOS action duration must be positive when supplied.',
    );
  }
  const location = freeze({
    description: nonEmptyText.parse(input.location.description),
    timeZone: IanaTimeZoneSchema.parse(input.location.timeZone),
  });
  const resultingDepartureState = validateDriverHosDepartureState(
    input.resultingDepartureState,
  );
  return freeze({
    actionId: nonEmptyText.parse(input.actionId),
    trigger: input.trigger,
    kind: input.kind,
    ...(input.availableAt === undefined
      ? {}
      : { availableAt: UtcInstantSchema.parse(input.availableAt) }),
    ...(input.duration === undefined
      ? {}
      : { duration: DurationSchema.parse(input.duration) }),
    dutyStatus: z.enum(['OFF_DUTY', 'SLEEPER_BERTH']).parse(input.dutyStatus),
    location,
    resultingDepartureState,
    sourceReference: nonEmptyText.parse(input.sourceReference),
    explanation: nonEmptyText.parse(input.explanation),
  });
}

function validateSimulationInput(input: EtaSimulationInput): EtaSimulationInput {
  const route = input.route;
  const stops = validateOrderedStops(input.stops);
  const speedModel = freeze(EtaSpeedModelSchema.parse(input.speedModel));
  const segmentConditions = input.segmentConditions.map((condition) =>
    freeze(EtaSegmentConditionSchema.parse(condition)),
  );
  const operationalEvents = input.operationalEvents.map((plan) =>
    validateOperationalEventPlan(plan),
  );
  const availableOperationalLocations = input.availableOperationalLocations.map(
    (location) => freeze(OperationalLocationSchema.parse(location)),
  );
  const complianceActions = input.complianceActions.map((action) =>
    freeze(EtaComplianceActionSchema.parse(action)),
  );
  const hosAvailabilityActions = input.hosAvailabilityActions.map((action) =>
    validateHosAvailabilityAction(action),
  );
  const departureState = validateDriverHosDepartureState(
    input.initialHosContext.departureState,
  );
  const initialDutyEvents = freezeArray([...input.initialHosContext.dutyEvents]);
  calculateHosCore({ departureState, dutyEvents: initialDutyEvents });

  const expectedLegCount = Math.max(0, stops.length - 1);
  if (route.legs.length !== expectedLegCount) {
    throw new EtaSimulationError(
      'ROUTE_STOP_MISMATCH',
      `Expected ${String(expectedLegCount)} route legs for ${String(stops.length)} stops.`,
    );
  }
  route.legs.forEach((legInput, index) => {
    const leg = CommercialRouteLegSchema.parse(legInput);
    const destination = stops[index + 1];
    if (leg.destinationStopId !== destination?.id) {
      throw new EtaSimulationError(
        'ROUTE_STOP_MISMATCH',
        `Route leg ${leg.legId} must end at ordered stop ${destination?.id ?? 'missing'}.`,
      );
    }
  });

  const routeSegments = route.legs.flatMap((leg) => leg.segments);
  const conditionIds = segmentConditions.map((condition) => condition.segmentId);
  if (new Set(conditionIds).size !== conditionIds.length) {
    throw new EtaSimulationError(
      'DUPLICATE_IDENTIFIER',
      'ETA segment conditions require unique segment identifiers.',
    );
  }
  for (const segment of routeSegments) {
    if (!conditionIds.includes(segment.segmentId)) {
      throw new EtaSimulationError(
        'MISSING_SEGMENT_CONDITION',
        `Missing ETA speed and time-zone condition for ${segment.segmentId}.`,
      );
    }
  }

  const ids = [
    ...operationalEvents.map((plan) => plan.eventId),
    ...complianceActions.map((action) => action.actionId),
    ...hosAvailabilityActions.map((action) => action.actionId),
  ];
  if (new Set(ids).size !== ids.length) {
    throw new EtaSimulationError(
      'DUPLICATE_IDENTIFIER',
      'Operational, compliance, and HOS action identifiers must be unique.',
    );
  }

  return freeze({
    route,
    stops,
    initialHosContext: freeze({ departureState, dutyEvents: initialDutyEvents }),
    speedModel,
    segmentConditions: freezeArray(segmentConditions),
    operationalEvents: freezeArray(operationalEvents),
    availableOperationalLocations: freezeArray(availableOperationalLocations),
    complianceActions: freezeArray(complianceActions),
    hosAvailabilityActions: freezeArray(hosAvailabilityActions),
    ...(input.homeTerminalTimeZone === undefined
      ? {}
      : { homeTerminalTimeZone: IanaTimeZoneSchema.parse(input.homeTerminalTimeZone) }),
  });
}

function placementDistance(
  placement: OperationalPlacementConstraint,
  planLocation: OperationalLocation | undefined,
): number | undefined {
  if (placement.kind === 'AT_ROUTE_DISTANCE') {
    return placement.routeDistance?.value;
  }
  if (placement.kind === 'FLEXIBLE') {
    return planLocation?.routeDistance.value;
  }
  return undefined;
}

function matchingOperationalPlans(
  state: MutableProjectionState,
  predicate: (plan: OperationalEventPlan) => boolean,
): readonly OperationalEventPlan[] {
  return state.operationalEvents.filter(
    (plan) => !state.usedOperationalEventIds.has(plan.eventId) && predicate(plan),
  );
}

function matchingComplianceActions(
  state: MutableProjectionState,
  predicate: (action: EtaComplianceAction) => boolean,
): readonly EtaComplianceAction[] {
  return state.complianceActions.filter(
    (action) =>
      !state.usedComplianceActionIds.has(action.actionId) && predicate(action),
  );
}

function applyExplicitHosAction(
  state: MutableProjectionState,
  trigger: HosCoreNextActionCode,
): boolean {
  const now = currentTime(state.hos);
  const candidates = state.hosAvailabilityActions
    .filter((action) => !state.usedHosActionIds.has(action.actionId))
    .filter((action) => action.trigger === trigger)
    .sort((left, right) => {
      const leftAt = left.availableAt ?? now;
      const rightAt = right.availableAt ?? now;
      return compareInstants(leftAt, rightAt);
    });
  const action = candidates[0];
  if (action === undefined) return false;

  const availableAt = action.availableAt ?? now;
  const waitUntil = compareInstants(availableAt, now) > 0 ? availableAt : now;
  const durationMinutes = action.duration?.value ?? 0;
  const endAt = addMinutes(waitUntil, durationMinutes);
  if (compareInstants(waitUntil, now) > 0) {
    const waitEvent = dutyEvent(
      nextEventId(state, `${action.actionId}-wait`),
      now,
      minutesBetween(now, waitUntil),
      action.dutyStatus,
      action.dutyStatus === 'SLEEPER_BERTH' ? 'REST' : 'BREAK',
      action.location.description,
      action.location.timeZone,
      `Wait for explicit ${action.kind.toLowerCase().replaceAll('_', ' ')} availability.`,
    );
    appendDutyEvent(state, waitEvent, {
      type: 'HOS_ACTION',
      startZone: action.location.timeZone,
      complianceActionId: action.actionId,
      explanation: action.explanation,
    });
  }
  if (durationMinutes > 0) {
    const restEvent = dutyEvent(
      nextEventId(state, `${action.actionId}-rest`),
      waitUntil,
      durationMinutes,
      action.dutyStatus,
      action.dutyStatus === 'SLEEPER_BERTH' ? 'REST' : 'BREAK',
      action.location.description,
      action.location.timeZone,
      action.explanation,
    );
    appendDutyEvent(state, restEvent, {
      type: 'HOS_ACTION',
      startZone: action.location.timeZone,
      complianceActionId: action.actionId,
      explanation: action.explanation,
    });
  }

  const resulting = validateDriverHosDepartureState(action.resultingDepartureState);
  if (resulting.departureAt !== endAt) {
    throw new EtaSimulationError(
      'INVALID_HOS_ACTION',
      `HOS action ${action.actionId} resulting state must begin at ${endAt}.`,
    );
  }
  const result = calculateHosCore({ departureState: resulting, dutyEvents: [] });
  if (trigger !== 'NONE' && !result.final.canDrive) {
    throw new EtaSimulationError(
      'INVALID_HOS_ACTION',
      `HOS action ${action.actionId} does not restore legal driving availability.`,
    );
  }
  state.hos.departureState = resulting;
  state.hos.phaseDutyEvents = [];
  state.usedHosActionIds.add(action.actionId);
  state.explanations.push(
    `Applied explicit ${action.kind.toLowerCase().replaceAll('_', ' ')} evidence from ${action.sourceReference}.`,
  );
  return true;
}

function appendAutomaticCoreAction(
  state: MutableProjectionState,
  result: HosCoreCalculationResult,
  location: Readonly<{ description: string; timeZone: IanaTimeZone }>,
): boolean {
  const action = result.nextRequiredAction;
  if (action.code === 'TAKE_THIRTY_MINUTE_INTERRUPTION') {
    const minutes = Math.max(
      0,
      30 - result.final.consecutiveNonDrivingTime.value,
    );
    if (minutes <= 0) return true;
    const event = dutyEvent(
      nextEventId(state, 'thirty-minute-interruption'),
      currentTime(state.hos),
      minutes,
      'OFF_DUTY',
      'BREAK',
      location.description,
      location.timeZone,
      'Insert the earliest legally sufficient standard 30-minute non-driving interruption.',
    );
    appendDutyEvent(state, event, {
      type: 'HOS_ACTION',
      startZone: location.timeZone,
    });
    return true;
  }
  if (action.code === 'TAKE_TEN_CONSECUTIVE_HOURS_OFF_DUTY') {
    const minutes = Math.max(
      0,
      10 * 60 - result.final.consecutiveResetQualifyingTime.value,
    );
    if (minutes <= 0) return true;
    const event = dutyEvent(
      nextEventId(state, 'ten-hour-rest'),
      currentTime(state.hos),
      minutes,
      'OFF_DUTY',
      'REST',
      location.description,
      location.timeZone,
      'Insert the earliest legally sufficient standard 10-consecutive-hour rest.',
    );
    appendDutyEvent(state, event, {
      type: 'HOS_ACTION',
      startZone: location.timeZone,
    });
    return true;
  }
  return false;
}

function ensureCanDrive(
  state: MutableProjectionState,
  location: Readonly<{ description: string; timeZone: IanaTimeZone }>,
): boolean {
  for (let attempts = 0; attempts < 8; attempts += 1) {
    const result = calculateContext(state.hos);
    if (result.violations.length > 0) {
      state.blockingReasons.push('Existing HOS history contains a violation.');
      state.blocked = true;
      return false;
    }
    if (result.final.canDrive) return true;
    const trigger = result.nextRequiredAction.code;
    if (applyExplicitHosAction(state, trigger)) continue;
    if (appendAutomaticCoreAction(state, result, location)) continue;
    state.blockingReasons.push(result.nextRequiredAction.explanation);
    state.blocked = true;
    return false;
  }
  throw new EtaSimulationError(
    'INVALID_INPUT',
    'HOS action insertion did not converge after eight bounded attempts.',
  );
}

function ensureOnDutyAvailable(
  state: MutableProjectionState,
  location: Readonly<{ description: string; timeZone: IanaTimeZone }>,
): boolean {
  const result = calculateContext(state.hos);
  if (result.final.cycleTimeRemaining.value > 0) return true;
  if (applyExplicitHosAction(state, 'WAIT_FOR_CYCLE_AVAILABILITY')) return true;
  state.blockingReasons.push(
    `No cycle time is available for on-duty work at ${location.description}, and no explicit recap, restart, or sleeper action resolves it.`,
  );
  state.blocked = true;
  return false;
}

function applyOperationalPlan(
  state: MutableProjectionState,
  planInput: OperationalEventPlan,
  complianceActionId?: string,
): boolean {
  const plan = projectedOperationalPlan(planInput, state.projection);
  const selectedLocation = plan.location ?? state.availableOperationalLocations[0];
  const location = selectedLocation === undefined
    ? freeze({
        description: 'Unresolved operational location',
        timeZone: state.stops[0]?.location.timeZone ?? ('UTC' as IanaTimeZone),
      })
    : freeze({
        description: selectedLocation.description,
        timeZone: selectedLocation.timeZone,
      });
  if (
    plan.dutyStatus === 'ON_DUTY_NOT_DRIVING' &&
    !ensureOnDutyAvailable(state, location)
  ) {
    return false;
  }
  const result = scheduleOperationalEvent(
    plan,
    currentTime(state.hos),
    state.hos.departureState,
    state.hos.phaseDutyEvents,
    state.availableOperationalLocations,
  );
  state.usedOperationalEventIds.add(plan.eventId);
  if (result.status !== 'SCHEDULED' || result.dutyEvent === undefined) {
    if (plan.required) {
      state.blockingReasons.push(...result.explanations);
      state.blocked = true;
      return false;
    }
    state.confidenceReasons.push(...result.explanations);
    return true;
  }
  appendDutyEvent(state, result.dutyEvent, {
    type: 'OPERATIONAL_EVENT',
    startZone: result.location?.timeZone ?? location.timeZone,
    operationalEventId: plan.eventId,
    ...(complianceActionId === undefined ? {} : { complianceActionId }),
  });
  if (result.planningBufferEvent !== undefined) {
    appendDutyEvent(state, result.planningBufferEvent, {
      type: 'PLANNING_BUFFER',
      startZone: result.location?.timeZone ?? location.timeZone,
      operationalEventId: plan.eventId,
      ...(complianceActionId === undefined ? {} : { complianceActionId }),
    });
  }
  return true;
}

function applyComplianceAction(
  state: MutableProjectionState,
  action: EtaComplianceAction,
  timeZone: IanaTimeZone,
): boolean {
  state.usedComplianceActionIds.add(action.actionId);
  if (action.status === 'BLOCKING') {
    const clocks = calculateContext(state.hos).final;
    state.timeline.push(
      timelineEvent(state, {
        type: 'COMPLIANCE_BLOCK',
        startAt: currentTime(state.hos),
        endAt: currentTime(state.hos),
        startZone: timeZone,
        endZone: timeZone,
        hosBefore: clocks,
        hosAfter: clocks,
        complianceActionId: action.actionId,
        explanation: action.explanation,
      }),
    );
    state.blockingReasons.push(action.explanation);
    state.blocked = true;
    return false;
  }
  if (action.status === 'ACTION_REQUIRED' && action.actionEvent !== undefined) {
    return applyOperationalPlan(state, action.actionEvent, action.actionId);
  }
  appendInstantEvent(state, {
    type: 'COMPLIANCE_CLEARED',
    at: currentTime(state.hos),
    timeZone,
    complianceActionId: action.actionId,
    explanation: action.explanation,
  });
  return true;
}

function placementMatches(
  placement: OperationalPlacementConstraint,
  point: Readonly<{
    kind:
      | 'BEFORE_FIRST_DRIVE'
      | 'AFTER_FINAL_DRIVE'
      | 'AT_STOP'
      | 'BEFORE_SEGMENT'
      | 'AFTER_SEGMENT';
    stopId?: string | undefined;
    segmentId?: string | undefined;
  }>,
): boolean {
  if (placement.kind !== point.kind) return false;
  if (point.kind === 'AT_STOP') return placement.stopId === point.stopId;
  if (point.kind === 'BEFORE_SEGMENT' || point.kind === 'AFTER_SEGMENT') {
    return placement.segmentId === point.segmentId;
  }
  return true;
}

function applyPointActions(
  state: MutableProjectionState,
  point: Parameters<typeof placementMatches>[1],
  timeZone: IanaTimeZone,
): boolean {
  const plans = matchingOperationalPlans(state, (plan) =>
    placementMatches(plan.placement, point),
  );
  for (const plan of plans) {
    if (!applyOperationalPlan(state, plan)) return false;
  }
  const actions = matchingComplianceActions(state, (action) =>
    placementMatches(action.placement, point),
  );
  for (const action of actions) {
    if (!applyComplianceAction(state, action, timeZone)) return false;
  }
  return true;
}

function routeDistanceActions(
  state: MutableProjectionState,
  fromMeters: number,
  toMeters: number,
): readonly Readonly<{
  distanceMeters: number;
  operationalPlans: readonly OperationalEventPlan[];
  complianceActions: readonly EtaComplianceAction[];
}>[] {
  const distances = new Set<number>();
  for (const plan of matchingOperationalPlans(state, (candidate) => {
    const distance = placementDistance(candidate.placement, candidate.location);
    return distance !== undefined && distance >= fromMeters && distance <= toMeters;
  })) {
    const distance = placementDistance(plan.placement, plan.location);
    if (distance !== undefined) distances.add(distance);
  }
  for (const action of matchingComplianceActions(state, (candidate) => {
    const distance = placementDistance(
      candidate.placement,
      candidate.actionEvent?.location,
    );
    return distance !== undefined && distance >= fromMeters && distance <= toMeters;
  })) {
    const distance = placementDistance(
      action.placement,
      action.actionEvent?.location,
    );
    if (distance !== undefined) distances.add(distance);
  }
  return freezeArray(
    [...distances]
      .sort((left, right) => left - right)
      .map((distanceMeters) =>
        freeze({
          distanceMeters,
          operationalPlans: matchingOperationalPlans(state, (plan) =>
            placementDistance(plan.placement, plan.location) === distanceMeters,
          ),
          complianceActions: matchingComplianceActions(state, (action) =>
            placementDistance(action.placement, action.actionEvent?.location) ===
            distanceMeters,
          ),
        }),
      ),
  );
}

function allocateMinutes(
  totalMinutes: number,
  distances: readonly number[],
): readonly number[] {
  const totalDistance = distances.reduce((sum, value) => sum + value, 0);
  if (distances.length === 0) return freezeArray([]);
  if (totalDistance <= 0) {
    return freezeArray(distances.map((_, index) => (index === 0 ? totalMinutes : 0)));
  }
  const exact = distances.map((distance) => (totalMinutes * distance) / totalDistance);
  const allocated = exact.map((value) => Math.floor(value));
  let remaining = totalMinutes - allocated.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => freeze({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  for (const candidate of order) {
    if (remaining <= 0) break;
    allocated[candidate.index] = (allocated[candidate.index] ?? 0) + 1;
    remaining -= 1;
  }
  return freezeArray(allocated);
}

function driveMinutes(
  state: MutableProjectionState,
  input: Readonly<{
    minutes: number;
    distance: Distance;
    leg: CommercialRouteLeg;
    segment: CommercialRouteSegment;
    condition: EtaSegmentCondition;
  }>,
): boolean {
  let remainingMinutes = input.minutes;
  let remainingDistance = input.distance.value;
  while (remainingMinutes > 0) {
    if (
      !ensureCanDrive(state, {
        description: `Route segment ${input.segment.segmentId}`,
        timeZone: input.condition.startTimeZone,
      })
    ) {
      return false;
    }
    const before = calculateContext(state.hos).final;
    const interruptionRemaining = Math.max(
      0,
      8 * 60 - before.drivenSinceLastQualifyingInterruption.value,
    );
    const legalMinutes = Math.min(
      before.drivingTimeRemaining.value,
      before.shiftTimeRemaining.value,
      before.cycleTimeRemaining.value,
      interruptionRemaining,
    );
    if (legalMinutes <= 0) continue;
    const chunkMinutes = Math.min(remainingMinutes, legalMinutes);
    const chunkDistance =
      remainingMinutes === chunkMinutes
        ? remainingDistance
        : (remainingDistance * chunkMinutes) / remainingMinutes;
    const event = dutyEvent(
      nextEventId(state, `drive-${input.segment.segmentId}`),
      currentTime(state.hos),
      chunkMinutes,
      'DRIVING',
      'STATUS_CHANGE',
      `Commercial route segment ${input.segment.segmentId}`,
      input.condition.startTimeZone,
      `Drive ${String(Math.round(chunkDistance))} meters of verified segment ${input.segment.segmentId}.`,
    );
    appendDutyEvent(state, event, {
      type: 'DRIVING',
      startZone: input.condition.startTimeZone,
      endZone: input.condition.endTimeZone,
      routeLegId: input.leg.legId,
      segmentId: input.segment.segmentId,
    });
    remainingMinutes -= chunkMinutes;
    remainingDistance -= chunkDistance;
  }
  return true;
}

function routeSegmentBlocked(segment: CommercialRouteSegment): readonly string[] {
  const reasons: string[] = [];
  if (segment.verificationStatus !== 'verified') {
    reasons.push(
      `Segment ${segment.segmentId} is ${segment.verificationStatus} and cannot be driven as a verified commercial plan.`,
    );
  }
  for (const restriction of segment.restrictions) {
    if (
      restriction.severity === 'prohibited' ||
      restriction.severity === 'route-restricted' ||
      restriction.severity === 'manual-verification-required'
    ) {
      reasons.push(`${restriction.explanation} (${restriction.sourceReference})`);
    }
  }
  if (
    segment.unavailableFields.some(
      (field) => field.impact === 'blocks-commercial-planning',
    )
  ) {
    reasons.push(
      `Segment ${segment.segmentId} lacks provider data required for commercial planning.`,
    );
  }
  return freezeArray(reasons);
}

function processSegment(
  state: MutableProjectionState,
  leg: CommercialRouteLeg,
  segment: CommercialRouteSegment,
  cumulativeStartMeters: number,
): boolean {
  const condition = state.segmentConditions.get(segment.segmentId);
  if (condition === undefined) {
    throw new EtaSimulationError(
      'MISSING_SEGMENT_CONDITION',
      `Missing condition for ${segment.segmentId}.`,
    );
  }
  if (
    !applyPointActions(
      state,
      { kind: 'BEFORE_SEGMENT', segmentId: segment.segmentId },
      condition.startTimeZone,
    )
  ) {
    return false;
  }
  const routeBlocks = routeSegmentBlocked(segment);
  if (routeBlocks.length > 0) {
    const clocks = calculateContext(state.hos).final;
    state.timeline.push(
      timelineEvent(state, {
        type: 'ROUTE_BLOCK',
        startAt: currentTime(state.hos),
        endAt: currentTime(state.hos),
        startZone: condition.startTimeZone,
        endZone: condition.startTimeZone,
        hosBefore: clocks,
        hosAfter: clocks,
        routeLegId: leg.legId,
        segmentId: segment.segmentId,
        explanation: routeBlocks.join(' '),
      }),
    );
    state.blockingReasons.push(...routeBlocks);
    state.blocked = true;
    return false;
  }

  const decision = calculateEtaSegmentSpeed(
    segment,
    condition,
    state.speedModel,
    state.projection,
  );
  state.speedDecisions.push(decision);
  state.confidenceReasons.push(...decision.confidenceReasons);
  const cumulativeEndMeters = cumulativeStartMeters + segment.distance.value;
  const actions = routeDistanceActions(
    state,
    cumulativeStartMeters,
    cumulativeEndMeters,
  );
  const breakpoints = [
    cumulativeStartMeters,
    ...actions
      .map((action) => action.distanceMeters)
      .filter(
        (distanceMeters) =>
          distanceMeters > cumulativeStartMeters &&
          distanceMeters < cumulativeEndMeters,
      ),
    cumulativeEndMeters,
  ];
  const distances = breakpoints.slice(1).map((end, index) => end - (breakpoints[index] ?? end));
  const minutes = allocateMinutes(decision.travelDuration.value, distances);

  for (let index = 0; index < distances.length; index += 1) {
    const distanceMeters = distances[index] ?? 0;
    const chunkMinutes = minutes[index] ?? 0;
    if (
      chunkMinutes > 0 &&
      !driveMinutes(state, {
        minutes: chunkMinutes,
        distance: distanceInMeters(distanceMeters),
        leg,
        segment,
        condition,
      })
    ) {
      return false;
    }
    const atDistance = breakpoints[index + 1];
    if (atDistance === undefined) continue;
    const point = actions.find((action) => action.distanceMeters === atDistance);
    if (point === undefined) continue;
    for (const plan of point.operationalPlans) {
      if (!applyOperationalPlan(state, plan)) return false;
    }
    for (const action of point.complianceActions) {
      if (!applyComplianceAction(state, action, condition.endTimeZone)) return false;
    }
  }

  return applyPointActions(
    state,
    { kind: 'AFTER_SEGMENT', segmentId: segment.segmentId },
    condition.endTimeZone,
  );
}

function mappedStopEventType(
  event: DutyEvent,
  stopTimeline: StopProcessingResult['timeline'],
): EtaTimelineEventType {
  const explicitType = stopTimeline.find(
    (candidate) => candidate.dutyEventId === event.id,
  )?.type;
  switch (explicitType) {
    case 'APPOINTMENT_WAIT':
      return 'STOP_WAIT';
    case 'CHECK_IN':
      return 'STOP_CHECK_IN';
    case 'SERVICE':
      return 'STOP_SERVICE';
    case 'HOS_HOLD':
      return 'STOP_HOS_HOLD';
    case 'ARRIVAL':
    case 'DEPARTURE':
      break;
  }
  if (event.eventType === 'PAPERWORK') return 'STOP_CHECK_IN';
  if (event.eventType === 'BREAK' || event.eventType === 'REST') {
    return 'STOP_HOS_HOLD';
  }
  if (event.eventType === 'STATUS_CHANGE') return 'STOP_WAIT';
  return 'STOP_SERVICE';
}

function processTripStop(
  state: MutableProjectionState,
  stop: TripStopPlan,
): boolean {
  appendInstantEvent(state, {
    type: 'STOP_ARRIVAL',
    at: currentTime(state.hos),
    timeZone: stop.location.timeZone,
    stopId: stop.id,
    explanation: `Arrived at ${stop.location.description}.`,
  });
  const beforePhaseLength = state.hos.phaseDutyEvents.length;
  const result = processStop({
    stop,
    arrivalAt: currentTime(state.hos),
    hosContext: freeze({
      departureState: state.hos.departureState,
      dutyEvents: freezeArray(state.hos.phaseDutyEvents),
    }),
    projection: stopProjection(state.projection),
  });
  for (const event of result.stopDutyEvents) {
    if (!state.hos.phaseDutyEvents.slice(beforePhaseLength).some((existing) => existing.id === event.id)) {
      appendDutyEvent(state, event, {
        type: mappedStopEventType(event, result.timeline),
        startZone: stop.location.timeZone,
        stopId: stop.id,
      });
    }
  }

  let resolved = result;
  if (result.status === 'blocked') {
    const onlyCycleBlocked =
      result.blockingReasons.length > 0 &&
      result.blockingReasons.every(
        (reason) => reason.code === 'CYCLE_AVAILABILITY_REQUIRED',
      );
    if (
      onlyCycleBlocked &&
      applyExplicitHosAction(state, 'WAIT_FOR_CYCLE_AVAILABILITY')
    ) {
      resolved = freeze({
        ...result,
        status: 'ready' as const,
        departureAt: currentTime(state.hos),
        departureHosClocks: calculateContext(state.hos).final,
        nextRequiredAction: calculateContext(state.hos).nextRequiredAction,
        continuationContext: freeze({
          departureState: state.hos.departureState,
          dutyEvents: freezeArray(state.hos.phaseDutyEvents),
        }),
        blockingReasons: freezeArray([]),
        reasons: freezeArray([
          ...result.reasons,
          'An explicit Stage 06 or Stage 07 availability action resolved the cycle block.',
        ]),
      });
    } else {
      state.stopResults.push(result);
      state.blockingReasons.push(
        ...result.blockingReasons.map((reason) => reason.explanation),
      );
      state.blocked = true;
      return false;
    }
  }
  state.stopResults.push(resolved);
  appendInstantEvent(state, {
    type: 'STOP_DEPARTURE',
    at: currentTime(state.hos),
    timeZone: stop.location.timeZone,
    stopId: stop.id,
    explanation: `Ready to depart ${stop.location.description}.`,
  });
  return applyPointActions(
    state,
    { kind: 'AT_STOP', stopId: stop.id },
    stop.location.timeZone,
  );
}

function unresolvedPlacements(state: MutableProjectionState): void {
  for (const plan of state.operationalEvents) {
    if (state.usedOperationalEventIds.has(plan.eventId)) continue;
    const explanation = `Operational event ${plan.eventId} could not be placed from ${plan.placement.kind}.`;
    if (plan.required) {
      state.blockingReasons.push(explanation);
      state.blocked = true;
    } else {
      state.confidenceReasons.push(explanation);
    }
  }
  for (const action of state.complianceActions) {
    if (state.usedComplianceActionIds.has(action.actionId)) continue;
    state.blockingReasons.push(
      `Compliance action ${action.actionId} could not be placed from ${action.placement.kind}.`,
    );
    state.blocked = true;
  }
}

function confidenceLevel(state: MutableProjectionState): EtaConfidenceLevel {
  if (state.blocked) return 'BLOCKED';
  if (
    state.speedDecisions.some((decision) => decision.source === 'FALLBACK_AVERAGE')
  ) {
    return 'LOW';
  }
  if (state.confidenceReasons.length > 0) return 'MEDIUM';
  return 'HIGH';
}

function simulateProjection(
  input: EtaSimulationInput,
  projection: EtaProjection,
): EtaProjectionResult {
  const segmentConditions = new Map(
    input.segmentConditions.map((condition) => [condition.segmentId, condition]),
  );
  const state: MutableProjectionState = {
    projection,
    route: input.route,
    stops: input.stops,
    speedModel: input.speedModel,
    segmentConditions,
    availableOperationalLocations: input.availableOperationalLocations,
    operationalEvents: input.operationalEvents,
    complianceActions: input.complianceActions,
    hosAvailabilityActions: input.hosAvailabilityActions,
    usedOperationalEventIds: new Set<string>(),
    usedComplianceActionIds: new Set<string>(),
    usedHosActionIds: new Set<string>(),
    timeline: [],
    stopResults: [],
    speedDecisions: [],
    confidenceReasons: [],
    blockingReasons: [],
    explanations: [
      `${projection} simulation advances chronologically in UTC whole minutes and renders each transition in an explicit IANA zone.`,
    ],
    hos: {
      departureState: input.initialHosContext.departureState,
      phaseDutyEvents: [...input.initialHosContext.dutyEvents],
      allDutyEvents: [...input.initialHosContext.dutyEvents],
    },
    blocked: false,
    eventCounter: 0,
  };

  if (input.route.assessment.commercialPlanningStatus !== 'usable') {
    state.blockingReasons.push(...input.route.assessment.blockingReasons);
    state.blocked = true;
  }
  state.confidenceReasons.push(...input.route.assessment.confidenceReasons);
  if (input.route.provider.confidence !== 'high') {
    state.confidenceReasons.push(
      `Commercial-route provider confidence is ${input.route.provider.confidence}.`,
    );
  }

  const firstStop = input.stops[0];
  if (!state.blocked && firstStop !== undefined && !processTripStop(state, firstStop)) {
    state.blocked = true;
  }
  if (
    !state.blocked &&
    firstStop !== undefined &&
    !applyPointActions(
      state,
      { kind: 'BEFORE_FIRST_DRIVE' },
      firstStop.location.timeZone,
    )
  ) {
    state.blocked = true;
  }

  let cumulativeMeters = 0;
  for (let legIndex = 0; legIndex < input.route.legs.length; legIndex += 1) {
    const leg = requiredItem(input.route.legs, legIndex, `Missing route leg ${String(legIndex + 1)}.`);
    for (const segment of leg.segments) {
      if (!processSegment(state, leg, segment, cumulativeMeters)) break;
      cumulativeMeters += segment.distance.value;
    }
    if (state.blocked) break;
    const destination = requiredItem(input.stops, legIndex + 1, `Missing destination stop for leg ${leg.legId}.`);
    if (legIndex === input.route.legs.length - 1) {
      if (
        !applyPointActions(
          state,
          { kind: 'AFTER_FINAL_DRIVE' },
          destination.location.timeZone,
        )
      ) {
        break;
      }
    }
    if (!processTripStop(state, destination)) break;
  }

  if (!state.blocked) unresolvedPlacements(state);
  const final = calculateContext(state.hos).final;
  const finalStop = state.stopResults.at(-1)?.stop.id;
  return freeze({
    projection,
    status: state.blocked ? ('BLOCKED' as const) : ('COMPLETE' as const),
    startedAt: input.initialHosContext.departureState.departureAt,
    ...(state.blocked ? {} : { completedAt: currentTime(state.hos) }),
    ...(finalStop === undefined ? {} : { finalStopId: finalStop }),
    timeline: freezeArray(state.timeline),
    stopResults: freezeArray(state.stopResults),
    speedDecisions: freezeArray(state.speedDecisions),
    finalHosClocks: final,
    confidence: confidenceLevel(state),
    confidenceReasons: freezeArray([...new Set(state.confidenceReasons)]),
    blockingReasons: freezeArray([...new Set(state.blockingReasons)]),
    explanations: freezeArray(state.explanations),
  });
}

export function simulateEtaTrip(inputRaw: EtaSimulationInput): EtaSimulationResult {
  const input = validateSimulationInput(inputRaw);
  return freeze({
    simulatorVersion: 'stage-15-v1' as const,
    routeId: input.route.routeId,
    earliestLegal: simulateProjection(input, 'EARLIEST_LEGAL'),
    expected: simulateProjection(input, 'EXPECTED'),
    conservative: simulateProjection(input, 'CONSERVATIVE'),
    explanations: freezeArray([
      'The three projections share one immutable input and differ only through explicit projection duration and speed assumptions.',
      'UTC instants determine ordering; local displays never alter chronology.',
      'The simulator stops at route, compliance, HOS, or placement blocks instead of changing legal assumptions to meet an appointment.',
    ]),
  });
}

export function etaSimulationSnapshot(
  result: EtaSimulationResult,
): Readonly<Record<string, unknown>> {
  return freeze({
    simulatorVersion: result.simulatorVersion,
    routeId: result.routeId,
    earliestLegal: result.earliestLegal,
    expected: result.expected,
    conservative: result.conservative,
    explanations: result.explanations,
  });
}
