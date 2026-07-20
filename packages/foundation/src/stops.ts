import { z } from 'zod';

import { StopTypeSchema } from './domain.js';
import type { StopType } from './domain.js';
import { calculateHosCore } from './hos-core.js';
import type {
  HosCoreCalculationResult,
  HosCoreClockSnapshot,
  HosCoreNextAction,
} from './hos-core.js';
import {
  DUTY_STATUSES,
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
  IanaTimeZoneSchema,
  LocalAppointmentWindowSchema,
  UtcInstantSchema,
  ZonedLocalDateTimeSchema,
  resolveAppointmentWindow,
  resolveZonedLocalDateTime,
  utcInstant,
} from './time.js';
import type {
  IanaTimeZone,
  UtcInstant,
} from './time.js';
import { DurationSchema, durationInMinutes } from './units.js';
import type { Duration } from './units.js';

const nonEmptyText = z.string().trim().min(1);
const optionalText = nonEmptyText.optional();
const positiveSafeInteger = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function freezeArray<T>(value: T[]): readonly T[] {
  return Object.freeze(value);
}

function timestamp(value: UtcInstant): number {
  return Date.parse(value);
}

function addMinutes(value: UtcInstant, minutes: number): UtcInstant {
  return utcInstant(new Date(timestamp(value) + minutes * 60_000).toISOString());
}

function minutesBetween(start: UtcInstant, end: UtcInstant): number {
  const difference = timestamp(end) - timestamp(start);
  if (difference < 0 || difference % 60_000 !== 0) {
    throw new StopValidationError([
      freeze({
        code: 'INVALID_TIME_ORDER',
        path: 'timeRange',
        message: 'Stop-processing timestamps must advance by whole minutes.',
      }),
    ]);
  }
  return difference / 60_000;
}

export const STOP_LOCATION_RESOLUTION_STATUSES = [
  'resolved',
  'user-confirmed',
] as const;
export type StopLocationResolutionStatus =
  (typeof STOP_LOCATION_RESOLUTION_STATUSES)[number];

export const ResolvedStopLocationSchema = z
  .object({
    description: nonEmptyText,
    timeZone: IanaTimeZoneSchema,
    addressText: optionalText,
    latitude: z.number().finite().min(-90).max(90).optional(),
    longitude: z.number().finite().min(-180).max(180).optional(),
    resolutionStatus: z.enum(STOP_LOCATION_RESOLUTION_STATUSES),
    sourceName: optionalText,
    providerReference: optionalText,
  })
  .strict();

export type ResolvedStopLocation = Readonly<
  z.infer<typeof ResolvedStopLocationSchema>
>;

export const STOP_APPOINTMENT_MODES = [
  'none',
  'earliest',
  'latest',
  'fixed',
  'window',
  'open-window',
] as const;
export type StopAppointmentMode = (typeof STOP_APPOINTMENT_MODES)[number];

const AppointmentNoneSchema = z.object({ mode: z.literal('none') }).strict();
const AppointmentEarliestSchema = z
  .object({
    mode: z.literal('earliest'),
    at: ZonedLocalDateTimeSchema,
  })
  .strict();
const AppointmentLatestSchema = z
  .object({
    mode: z.literal('latest'),
    at: ZonedLocalDateTimeSchema,
    lateTolerance: DurationSchema,
  })
  .strict();
const AppointmentFixedSchema = z
  .object({
    mode: z.literal('fixed'),
    at: ZonedLocalDateTimeSchema,
    lateTolerance: DurationSchema,
  })
  .strict();
const AppointmentWindowSchema = z
  .object({
    mode: z.literal('window'),
    window: LocalAppointmentWindowSchema,
    lateTolerance: DurationSchema,
  })
  .strict();
const AppointmentOpenWindowSchema = z
  .object({
    mode: z.literal('open-window'),
    window: LocalAppointmentWindowSchema,
    lateTolerance: DurationSchema,
  })
  .strict();

export const StopAppointmentSchema = z.discriminatedUnion('mode', [
  AppointmentNoneSchema,
  AppointmentEarliestSchema,
  AppointmentLatestSchema,
  AppointmentFixedSchema,
  AppointmentWindowSchema,
  AppointmentOpenWindowSchema,
]);

export type StopAppointment = Readonly<
  z.infer<typeof StopAppointmentSchema>
>;

export const FacilityHoursSchema = z
  .object({
    windows: z.array(LocalAppointmentWindowSchema).default([]),
  })
  .strict();

export type FacilityHours = Readonly<z.infer<typeof FacilityHoursSchema>>;

export const STOP_SERVICE_DURATION_MODES = [
  'exact',
  'expected',
  'range',
  'historical-average',
] as const;
export type StopServiceDurationMode =
  (typeof STOP_SERVICE_DURATION_MODES)[number];

const ServiceExactSchema = z
  .object({ mode: z.literal('exact'), duration: DurationSchema })
  .strict();
const ServiceExpectedSchema = z
  .object({ mode: z.literal('expected'), duration: DurationSchema })
  .strict();
const ServiceRangeSchema = z
  .object({
    mode: z.literal('range'),
    minimum: DurationSchema,
    expected: DurationSchema,
    maximum: DurationSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.minimum.value > value.expected.value) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minimum'],
        message: 'Minimum service duration cannot exceed expected duration.',
      });
    }
    if (value.expected.value > value.maximum.value) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maximum'],
        message: 'Maximum service duration cannot be shorter than expected duration.',
      });
    }
  });
const ServiceHistoricalAverageSchema = z
  .object({
    mode: z.literal('historical-average'),
    duration: DurationSchema,
    sourceName: nonEmptyText,
    sampleSize: positiveSafeInteger.optional(),
  })
  .strict();

export const StopServiceDurationPlanSchema = z.union([
  ServiceExactSchema,
  ServiceExpectedSchema,
  ServiceRangeSchema,
  ServiceHistoricalAverageSchema,
]);

export type StopServiceDurationPlan = Readonly<
  z.infer<typeof StopServiceDurationPlanSchema>
>;

export const TripStopPlanSchema = z
  .object({
    id: nonEmptyText,
    sequence: positiveSafeInteger,
    type: StopTypeSchema,
    required: z.boolean(),
    lockedPosition: z.boolean(),
    location: ResolvedStopLocationSchema,
    appointment: StopAppointmentSchema,
    facilityHours: FacilityHoursSchema,
    checkInDuration: DurationSchema,
    serviceDuration: StopServiceDurationPlanSchema,
    waitingDutyStatus: z.enum(DUTY_STATUSES),
    checkInDutyStatus: z.enum(DUTY_STATUSES),
    serviceDutyStatus: z.enum(DUTY_STATUSES),
    earlyParkingAllowed: z.boolean(),
    overnightParkingAllowed: z.boolean(),
    notes: optionalText,
    instructions: optionalText,
  })
  .strict();

export type TripStopPlan = Readonly<z.infer<typeof TripStopPlanSchema>>;

export type StopValidationIssueCode =
  | 'INVALID_STOP'
  | 'DUPLICATE_STOP_ID'
  | 'DUPLICATE_SEQUENCE'
  | 'NONCONTIGUOUS_SEQUENCE'
  | 'TIME_ZONE_MISMATCH'
  | 'INVALID_FACILITY_HOURS'
  | 'INVALID_TIME_ORDER';

export interface StopValidationIssue {
  readonly code: StopValidationIssueCode;
  readonly path: string;
  readonly message: string;
}

export class StopValidationError extends Error {
  public override readonly name = 'StopValidationError';

  public constructor(public readonly issues: readonly StopValidationIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
  }
}

interface ResolvedTimeWindow {
  readonly startAt: UtcInstant;
  readonly endAt: UtcInstant;
}

function appointmentZones(appointment: StopAppointment): readonly IanaTimeZone[] {
  switch (appointment.mode) {
    case 'none':
      return freezeArray([]);
    case 'earliest':
    case 'latest':
    case 'fixed':
      return freezeArray([appointment.at.timeZone]);
    case 'window':
    case 'open-window':
      return freezeArray([
        appointment.window.start.timeZone,
        appointment.window.end.timeZone,
      ]);
  }
}

function resolveFacilityWindows(
  facilityHours: FacilityHours,
  expectedZone: IanaTimeZone,
): readonly ResolvedTimeWindow[] {
  const windows = facilityHours.windows.map((window, index) => {
    if (
      window.start.timeZone !== expectedZone ||
      window.end.timeZone !== expectedZone
    ) {
      throw new StopValidationError([
        freeze({
          code: 'TIME_ZONE_MISMATCH',
          path: `facilityHours.windows[${String(index)}]`,
          message: 'Facility hours must use the stop location time zone.',
        }),
      ]);
    }
    const resolved = resolveAppointmentWindow(window);
    return freeze({
      startAt: resolved.startInstant,
      endAt: resolved.endInstant,
    });
  });
  windows.sort((left, right) => timestamp(left.startAt) - timestamp(right.startAt));
  windows.forEach((window, index) => {
    const previous = windows[index - 1];
    if (previous !== undefined && timestamp(window.startAt) < timestamp(previous.endAt)) {
      throw new StopValidationError([
        freeze({
          code: 'INVALID_FACILITY_HOURS',
          path: `facilityHours.windows[${String(index)}]`,
          message: 'Facility-hour windows must be ordered and non-overlapping.',
        }),
      ]);
    }
  });
  return freezeArray(windows);
}

export function validateTripStopPlan(input: unknown): TripStopPlan {
  let parsed: TripStopPlan;
  try {
    parsed = freeze(TripStopPlanSchema.parse(input));
  } catch (error) {
    throw new StopValidationError([
      freeze({
        code: 'INVALID_STOP',
        path: 'stop',
        message: error instanceof Error ? error.message : 'Invalid stop configuration.',
      }),
    ]);
  }

  const mismatchedAppointmentZone = appointmentZones(parsed.appointment).find(
    (zone) => zone !== parsed.location.timeZone,
  );
  if (mismatchedAppointmentZone !== undefined) {
    throw new StopValidationError([
      freeze({
        code: 'TIME_ZONE_MISMATCH',
        path: 'stop.appointment',
        message: 'Appointment timestamps must use the stop location time zone.',
      }),
    ]);
  }

  switch (parsed.appointment.mode) {
    case 'none':
      break;
    case 'earliest':
    case 'latest':
    case 'fixed':
      resolveZonedLocalDateTime(parsed.appointment.at);
      break;
    case 'window':
    case 'open-window':
      resolveAppointmentWindow(parsed.appointment.window);
      break;
  }
  resolveFacilityWindows(parsed.facilityHours, parsed.location.timeZone);
  return parsed;
}

export function validateOrderedStops(input: readonly unknown[]): readonly TripStopPlan[] {
  const stops = input.map((stop) => validateTripStopPlan(stop));
  const ids = new Set(stops.map((stop) => stop.id));
  if (ids.size !== stops.length) {
    throw new StopValidationError([
      freeze({
        code: 'DUPLICATE_STOP_ID',
        path: 'stops',
        message: 'Stop identifiers must be unique within an ordered trip.',
      }),
    ]);
  }
  const sequences = new Set(stops.map((stop) => stop.sequence));
  if (sequences.size !== stops.length) {
    throw new StopValidationError([
      freeze({
        code: 'DUPLICATE_SEQUENCE',
        path: 'stops',
        message: 'Stop sequence values must be unique.',
      }),
    ]);
  }
  const ordered = [...stops].sort((left, right) => left.sequence - right.sequence);
  ordered.forEach((stop, index) => {
    if (stop.sequence !== index + 1) {
      throw new StopValidationError([
        freeze({
          code: 'NONCONTIGUOUS_SEQUENCE',
          path: `stops[${String(index)}].sequence`,
          message: 'Stop sequence values must be contiguous and start at one.',
        }),
      ]);
    }
  });
  return freezeArray(ordered);
}

export interface StopDefaults {
  readonly checkInDuration: Duration;
  readonly serviceDuration: StopServiceDurationPlan;
  readonly waitingDutyStatus: HosDutyStatus;
  readonly checkInDutyStatus: HosDutyStatus;
  readonly serviceDutyStatus: HosDutyStatus;
}

export interface StopDefaultsConfiguration {
  readonly fallback: StopDefaults;
  readonly byType: Readonly<Partial<Record<StopType, StopDefaults>>>;
}

function defaults(
  serviceMinutes: number,
  serviceDutyStatus: HosDutyStatus,
  checkInMinutes = 0,
): StopDefaults {
  return freeze({
    checkInDuration: durationInMinutes(checkInMinutes),
    serviceDuration: freeze({
      mode: 'expected' as const,
      duration: durationInMinutes(serviceMinutes),
    }),
    waitingDutyStatus: 'OFF_DUTY',
    checkInDutyStatus: 'ON_DUTY_NOT_DRIVING',
    serviceDutyStatus,
  });
}

export function suggestedStopDefaults(
  overrides: Readonly<Partial<StopDefaultsConfiguration>> = {},
): StopDefaultsConfiguration {
  const suggestedByType: Partial<Record<StopType, StopDefaults>> = {
    'start-location': defaults(30, 'ON_DUTY_NOT_DRIVING'),
    'tractor-pickup': defaults(30, 'ON_DUTY_NOT_DRIVING'),
    'trailer-pickup': defaults(30, 'ON_DUTY_NOT_DRIVING'),
    shipper: freeze({
      ...defaults(45, 'ON_DUTY_NOT_DRIVING'),
      serviceDuration: freeze({
        mode: 'range' as const,
        minimum: durationInMinutes(30),
        expected: durationInMinutes(45),
        maximum: durationInMinutes(60),
      }),
    }),
    'intermediate-pickup': freeze({
      ...defaults(45, 'ON_DUTY_NOT_DRIVING'),
      serviceDuration: freeze({
        mode: 'range' as const,
        minimum: durationInMinutes(30),
        expected: durationInMinutes(45),
        maximum: durationInMinutes(60),
      }),
    }),
    'intermediate-delivery': freeze({
      ...defaults(45, 'ON_DUTY_NOT_DRIVING'),
      serviceDuration: freeze({
        mode: 'range' as const,
        minimum: durationInMinutes(30),
        expected: durationInMinutes(45),
        maximum: durationInMinutes(60),
      }),
    }),
    'final-consignee': freeze({
      ...defaults(45, 'ON_DUTY_NOT_DRIVING'),
      serviceDuration: freeze({
        mode: 'range' as const,
        minimum: durationInMinutes(30),
        expected: durationInMinutes(45),
        maximum: durationInMinutes(60),
      }),
    }),
    fuel: defaults(30, 'ON_DUTY_NOT_DRIVING'),
    scale: defaults(15, 'ON_DUTY_NOT_DRIVING'),
    inspection: defaults(30, 'ON_DUTY_NOT_DRIVING'),
    maintenance: defaults(60, 'ON_DUTY_NOT_DRIVING'),
    food: defaults(30, 'OFF_DUTY'),
    'driver-break': defaults(30, 'OFF_DUTY'),
    'sleeper-rest': defaults(600, 'SLEEPER_BERTH'),
    terminal: defaults(30, 'ON_DUTY_NOT_DRIVING'),
    'border-crossing': defaults(60, 'ON_DUTY_NOT_DRIVING'),
    other: defaults(30, 'ON_DUTY_NOT_DRIVING'),
  };

  return freeze({
    fallback: overrides.fallback ?? defaults(30, 'ON_DUTY_NOT_DRIVING'),
    byType: freeze({ ...suggestedByType, ...(overrides.byType ?? {}) }),
  });
}

export function resolveStopDefaults(
  type: StopType,
  configuration: StopDefaultsConfiguration,
): StopDefaults {
  return configuration.byType[type] ?? configuration.fallback;
}

export interface CreateStopFromDefaultsInput {
  readonly id: string;
  readonly sequence: number;
  readonly type: StopType;
  readonly required: boolean;
  readonly location: ResolvedStopLocation;
  readonly appointment?: StopAppointment;
  readonly facilityHours?: FacilityHours;
  readonly lockedPosition?: boolean;
  readonly earlyParkingAllowed?: boolean;
  readonly overnightParkingAllowed?: boolean;
  readonly notes?: string;
  readonly instructions?: string;
}

export function createStopFromDefaults(
  input: CreateStopFromDefaultsInput,
  configuration: StopDefaultsConfiguration,
): TripStopPlan {
  const configured = resolveStopDefaults(input.type, configuration);
  return validateTripStopPlan({
    id: input.id,
    sequence: input.sequence,
    type: input.type,
    required: input.required,
    lockedPosition: input.lockedPosition ?? false,
    location: input.location,
    appointment: input.appointment ?? { mode: 'none' },
    facilityHours: input.facilityHours ?? { windows: [] },
    checkInDuration: configured.checkInDuration,
    serviceDuration: configured.serviceDuration,
    waitingDutyStatus: configured.waitingDutyStatus,
    checkInDutyStatus: configured.checkInDutyStatus,
    serviceDutyStatus: configured.serviceDutyStatus,
    earlyParkingAllowed: input.earlyParkingAllowed ?? false,
    overnightParkingAllowed: input.overnightParkingAllowed ?? false,
    ...(input.notes === undefined ? {} : { notes: input.notes }),
    ...(input.instructions === undefined
      ? {}
      : { instructions: input.instructions }),
  });
}

export type StopMutationErrorCode =
  | 'STOP_NOT_FOUND'
  | 'DUPLICATE_STOP_ID'
  | 'LOCKED_POSITION'
  | 'INVALID_TARGET_INDEX';

export class StopMutationError extends Error {
  public override readonly name = 'StopMutationError';

  public constructor(
    public readonly code: StopMutationErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function normalizeSequences(stops: readonly TripStopPlan[]): readonly TripStopPlan[] {
  return freezeArray(
    stops.map((stop, index) =>
      freeze({
        ...stop,
        sequence: index + 1,
      }),
    ),
  );
}

function findStopIndex(stops: readonly TripStopPlan[], id: string): number {
  const index = stops.findIndex((stop) => stop.id === id);
  if (index < 0) {
    throw new StopMutationError('STOP_NOT_FOUND', `Stop ${id} was not found.`);
  }
  return index;
}

function assertUniqueId(stops: readonly TripStopPlan[], id: string): void {
  if (stops.some((stop) => stop.id === id)) {
    throw new StopMutationError(
      'DUPLICATE_STOP_ID',
      `Stop identifier ${id} is already in use.`,
    );
  }
}

function assertLockedPositionsUnchanged(
  before: readonly TripStopPlan[],
  after: readonly TripStopPlan[],
): void {
  for (const stop of before.filter((candidate) => candidate.lockedPosition)) {
    const next = after.find((candidate) => candidate.id === stop.id);
    if (next === undefined || next.sequence !== stop.sequence) {
      throw new StopMutationError(
        'LOCKED_POSITION',
        `Stop ${stop.id} is locked at sequence ${String(stop.sequence)}.`,
      );
    }
  }
}

export function addStop(
  stopsInput: readonly unknown[],
  stopInput: unknown,
): readonly TripStopPlan[] {
  const stops = validateOrderedStops(stopsInput);
  const stop = validateTripStopPlan(stopInput);
  assertUniqueId(stops, stop.id);
  return normalizeSequences([...stops, stop]);
}

export function insertStop(
  stopsInput: readonly unknown[],
  stopInput: unknown,
  targetIndex: number,
): readonly TripStopPlan[] {
  const stops = validateOrderedStops(stopsInput);
  const stop = validateTripStopPlan(stopInput);
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex > stops.length) {
    throw new StopMutationError(
      'INVALID_TARGET_INDEX',
      'Insertion index must be within the ordered stop list.',
    );
  }
  assertUniqueId(stops, stop.id);
  const next = [...stops];
  next.splice(targetIndex, 0, stop);
  const normalized = normalizeSequences(next);
  assertLockedPositionsUnchanged(stops, normalized);
  return normalized;
}

export function removeStop(
  stopsInput: readonly unknown[],
  stopId: string,
): readonly TripStopPlan[] {
  const stops = validateOrderedStops(stopsInput);
  const index = findStopIndex(stops, stopId);
  if (stops[index]?.lockedPosition === true) {
    throw new StopMutationError(
      'LOCKED_POSITION',
      `Stop ${stopId} cannot be removed while its position is locked.`,
    );
  }
  const next = [...stops];
  next.splice(index, 1);
  const normalized = normalizeSequences(next);
  assertLockedPositionsUnchanged(stops, normalized);
  return normalized;
}

export function duplicateStop(
  stopsInput: readonly unknown[],
  sourceStopId: string,
  duplicateId: string,
): readonly TripStopPlan[] {
  const stops = validateOrderedStops(stopsInput);
  assertUniqueId(stops, duplicateId);
  const sourceIndex = findStopIndex(stops, sourceStopId);
  const source = stops[sourceIndex];
  if (source === undefined) {
    throw new StopMutationError('STOP_NOT_FOUND', `Stop ${sourceStopId} was not found.`);
  }
  const duplicate = freeze({
    ...source,
    id: duplicateId,
    sequence: source.sequence + 1,
    lockedPosition: false,
  });
  return insertStop(stops, duplicate, sourceIndex + 1);
}

export function reorderStop(
  stopsInput: readonly unknown[],
  stopId: string,
  targetIndex: number,
): readonly TripStopPlan[] {
  const stops = validateOrderedStops(stopsInput);
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= stops.length) {
    throw new StopMutationError(
      'INVALID_TARGET_INDEX',
      'Reorder target must identify an existing list position.',
    );
  }
  const sourceIndex = findStopIndex(stops, stopId);
  const source = stops[sourceIndex];
  if (source?.lockedPosition === true) {
    throw new StopMutationError(
      'LOCKED_POSITION',
      `Stop ${stopId} cannot move while its position is locked.`,
    );
  }
  const next = [...stops];
  const [moved] = next.splice(sourceIndex, 1);
  if (moved === undefined) {
    throw new StopMutationError('STOP_NOT_FOUND', `Stop ${stopId} was not found.`);
  }
  next.splice(targetIndex, 0, moved);
  const normalized = normalizeSequences(next);
  assertLockedPositionsUnchanged(stops, normalized);
  return normalized;
}

function updateStop(
  stopsInput: readonly unknown[],
  stopId: string,
  update: (stop: TripStopPlan) => TripStopPlan,
): readonly TripStopPlan[] {
  const stops = validateOrderedStops(stopsInput);
  const index = findStopIndex(stops, stopId);
  const next = [...stops];
  const current = next[index];
  if (current === undefined) {
    throw new StopMutationError('STOP_NOT_FOUND', `Stop ${stopId} was not found.`);
  }
  next[index] = validateTripStopPlan(update(current));
  return freezeArray(next);
}

export function changeStopType(
  stopsInput: readonly unknown[],
  stopId: string,
  type: StopType,
): readonly TripStopPlan[] {
  return updateStop(stopsInput, stopId, (stop) => freeze({ ...stop, type }));
}

export function setStopRequired(
  stopsInput: readonly unknown[],
  stopId: string,
  required: boolean,
): readonly TripStopPlan[] {
  return updateStop(stopsInput, stopId, (stop) => freeze({ ...stop, required }));
}

export function setStopPositionLocked(
  stopsInput: readonly unknown[],
  stopId: string,
  lockedPosition: boolean,
): readonly TripStopPlan[] {
  return updateStop(stopsInput, stopId, (stop) =>
    freeze({ ...stop, lockedPosition }),
  );
}

export const STOP_PROJECTIONS = ['earliest', 'expected', 'conservative'] as const;
export type StopProjection = (typeof STOP_PROJECTIONS)[number];

export const APPOINTMENT_OUTCOMES = [
  'none',
  'early',
  'on-time',
  'at-risk',
  'missed',
] as const;
export type AppointmentOutcome = (typeof APPOINTMENT_OUTCOMES)[number];

export interface AppointmentFeasibilityCheckpoint {
  readonly at: UtcInstant;
  readonly projectedArrivalAt: UtcInstant;
  readonly explanation: string;
}

export type StopProcessingWarningCode =
  | 'APPOINTMENT_AT_RISK'
  | 'APPOINTMENT_MISSED'
  | 'SERVICE_START_AFTER_APPOINTMENT'
  | 'SERVICE_EXTENDS_PAST_FACILITY_HOURS'
  | 'OPTIONAL_STOP_BLOCKS_DEPARTURE';

export interface StopProcessingWarning {
  readonly code: StopProcessingWarningCode;
  readonly explanation: string;
}

export type StopProcessingBlockingReasonCode =
  | 'FACILITY_CLOSED_WITHOUT_FUTURE_HOURS'
  | 'HOS_REST_PARKING_UNAVAILABLE'
  | 'CYCLE_AVAILABILITY_REQUIRED'
  | 'HOS_VIOLATION_PRESENT'
  | 'HOS_DEPARTURE_BLOCKED';

export interface StopProcessingBlockingReason {
  readonly code: StopProcessingBlockingReasonCode;
  readonly explanation: string;
}

export type StopTimelineEventType =
  | 'ARRIVAL'
  | 'APPOINTMENT_WAIT'
  | 'CHECK_IN'
  | 'SERVICE'
  | 'HOS_HOLD'
  | 'DEPARTURE';

export interface StopTimelineEvent {
  readonly type: StopTimelineEventType;
  readonly startAt: UtcInstant;
  readonly endAt: UtcInstant;
  readonly duration: Duration;
  readonly dutyStatus?: HosDutyStatus;
  readonly dutyEventId?: string;
  readonly explanation: string;
}

export interface StopHosContext {
  readonly departureState: DriverHosDepartureState;
  readonly dutyEvents: readonly DutyEvent[];
}

export interface StopProcessingInput {
  readonly stop: TripStopPlan;
  readonly arrivalAt: UtcInstant;
  readonly hosContext: StopHosContext;
  readonly projection: StopProjection;
  readonly feasibilityCheckpoints?: readonly AppointmentFeasibilityCheckpoint[];
}

export interface StopProcessingResult {
  readonly stop: TripStopPlan;
  readonly projection: StopProjection;
  readonly status: 'ready' | 'blocked';
  readonly arrivalAt: UtcInstant;
  readonly serviceStartAt?: UtcInstant;
  readonly serviceCompletedAt?: UtcInstant;
  readonly departureAt?: UtcInstant;
  readonly appointmentOutcome: AppointmentOutcome;
  readonly appointmentDeadlineAt?: UtcInstant;
  readonly latenessBecameUnavoidableAt?: UtcInstant;
  readonly waitingTime: Duration;
  readonly checkInTime: Duration;
  readonly serviceTime: Duration;
  readonly hosHoldTime: Duration;
  readonly arrivalHosClocks: HosCoreClockSnapshot;
  readonly departureHosClocks: HosCoreClockSnapshot;
  readonly nextRequiredAction: HosCoreNextAction;
  readonly timeline: readonly StopTimelineEvent[];
  readonly stopDutyEvents: readonly DutyEvent[];
  readonly continuationContext: StopHosContext;
  readonly warnings: readonly StopProcessingWarning[];
  readonly blockingReasons: readonly StopProcessingBlockingReason[];
  readonly reasons: readonly string[];
}

export class StopProcessingError extends Error {
  public override readonly name = 'StopProcessingError';

  public constructor(message: string) {
    super(message);
  }
}

interface AppointmentBounds {
  readonly notBeforeAt?: UtcInstant;
  readonly deadlineAt?: UtcInstant;
  readonly missedAfterAt?: UtcInstant;
}

function resolveAppointmentBounds(appointment: StopAppointment): AppointmentBounds {
  switch (appointment.mode) {
    case 'none':
      return freeze({});
    case 'earliest':
      return freeze({
        notBeforeAt: resolveZonedLocalDateTime(appointment.at).instant,
      });
    case 'latest': {
      const deadlineAt = resolveZonedLocalDateTime(appointment.at).instant;
      return freeze({
        deadlineAt,
        missedAfterAt: addMinutes(deadlineAt, appointment.lateTolerance.value),
      });
    }
    case 'fixed': {
      const at = resolveZonedLocalDateTime(appointment.at).instant;
      return freeze({
        notBeforeAt: at,
        deadlineAt: at,
        missedAfterAt: addMinutes(at, appointment.lateTolerance.value),
      });
    }
    case 'window':
    case 'open-window': {
      const window = resolveAppointmentWindow(appointment.window);
      return freeze({
        notBeforeAt: window.startInstant,
        deadlineAt: window.endInstant,
        missedAfterAt: addMinutes(
          window.endInstant,
          appointment.lateTolerance.value,
        ),
      });
    }
  }
}

function serviceMinutes(
  plan: StopServiceDurationPlan,
  projection: StopProjection,
): number {
  switch (plan.mode) {
    case 'exact':
    case 'expected':
    case 'historical-average':
      return plan.duration.value;
    case 'range':
      return projection === 'earliest'
        ? plan.minimum.value
        : projection === 'conservative'
          ? plan.maximum.value
          : plan.expected.value;
  }
}

function appointmentOutcome(
  arrivalAt: UtcInstant,
  appointment: StopAppointment,
  bounds: AppointmentBounds,
): AppointmentOutcome {
  if (appointment.mode === 'none') return 'none';
  if (
    bounds.notBeforeAt !== undefined &&
    timestamp(arrivalAt) < timestamp(bounds.notBeforeAt)
  ) {
    return 'early';
  }
  if (
    bounds.missedAfterAt !== undefined &&
    timestamp(arrivalAt) > timestamp(bounds.missedAfterAt)
  ) {
    return 'missed';
  }
  if (
    bounds.deadlineAt !== undefined &&
    timestamp(arrivalAt) > timestamp(bounds.deadlineAt)
  ) {
    return 'at-risk';
  }
  return 'on-time';
}

function identifyLatenessBecameUnavoidable(
  checkpoints: readonly AppointmentFeasibilityCheckpoint[],
  deadlineAt: UtcInstant | undefined,
  arrivalAt: UtcInstant,
): UtcInstant | undefined {
  if (deadlineAt === undefined) return undefined;
  const ordered = [...checkpoints].sort((left, right) => timestamp(left.at) - timestamp(right.at));
  const checkpoint = ordered.find(
    (candidate) => timestamp(candidate.projectedArrivalAt) > timestamp(deadlineAt),
  );
  if (checkpoint !== undefined) return checkpoint.at;
  return timestamp(arrivalAt) > timestamp(deadlineAt) ? arrivalAt : undefined;
}

interface FacilityAvailability {
  readonly availableAt: UtcInstant;
  readonly activeWindowEndAt?: UtcInstant;
  readonly status: 'unrestricted' | 'open' | 'wait-for-open' | 'closed';
}

function facilityAvailability(
  candidateAt: UtcInstant,
  windows: readonly ResolvedTimeWindow[],
): FacilityAvailability {
  if (windows.length === 0) {
    return freeze({ availableAt: candidateAt, status: 'unrestricted' });
  }
  const containing = windows.find(
    (window) =>
      timestamp(candidateAt) >= timestamp(window.startAt) &&
      timestamp(candidateAt) < timestamp(window.endAt),
  );
  if (containing !== undefined) {
    return freeze({
      availableAt: candidateAt,
      activeWindowEndAt: containing.endAt,
      status: 'open',
    });
  }
  const future = windows.find(
    (window) => timestamp(window.startAt) > timestamp(candidateAt),
  );
  if (future !== undefined) {
    return freeze({
      availableAt: future.startAt,
      activeWindowEndAt: future.endAt,
      status: 'wait-for-open',
    });
  }
  return freeze({ availableAt: candidateAt, status: 'closed' });
}

function dutyEventType(stopType: StopType): DutyEventType {
  switch (stopType) {
    case 'fuel':
      return 'fuel';
    case 'scale':
      return 'scale';
    case 'shipper':
    case 'intermediate-pickup':
    case 'tractor-pickup':
    case 'trailer-pickup':
      return 'LOADING';
    case 'intermediate-delivery':
    case 'final-consignee':
      return 'UNLOADING';
    case 'inspection':
      return 'PRE_TRIP_INSPECTION';
    case 'maintenance':
      return 'maintenance';
    case 'driver-break':
    case 'food':
      return 'BREAK';
    case 'sleeper-rest':
      return 'REST';
    case 'border-crossing':
      return 'BORDER_OR_AGRICULTURAL_INSPECTION';
    case 'start-location':
    case 'terminal':
    case 'other':
      return 'other';
  }
}

function clockEffects(status: HosDutyStatus): DutyEvent['clockEffects'] {
  switch (status) {
    case 'DRIVING':
      return freeze({
        driving: 'CONSUMES',
        shift: 'ADVANCES_WINDOW',
        cycle: 'CONSUMES',
      });
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
  }
}

function calculatedDutyEvent(
  stop: TripStopPlan,
  kind: 'wait' | 'check-in' | 'service' | 'hos-hold',
  startAt: UtcInstant,
  minutes: number,
  dutyStatus: HosDutyStatus,
  index: number,
): DutyEvent {
  const eventType = kind === 'check-in'
    ? 'PAPERWORK'
    : kind === 'service'
      ? dutyEventType(stop.type)
      : kind === 'hos-hold'
        ? dutyStatus === 'SLEEPER_BERTH'
          ? 'REST'
          : 'BREAK'
        : dutyStatus === 'OFF_DUTY' || dutyStatus === 'SLEEPER_BERTH'
          ? 'BREAK'
          : 'other';
  return validateDutyEvent({
    id: `${stop.id}:${kind}:${String(index)}`,
    startAt,
    endAt: addMinutes(startAt, minutes),
    duration: durationInMinutes(minutes),
    dutyStatus,
    eventType,
    location: {
      description: stop.location.description,
      timeZone: stop.location.timeZone,
    },
    source: 'CALCULATED',
    explanation: `Stage 10 ${kind.replaceAll('-', ' ')} event for stop ${stop.id}.`,
    clockEffects: clockEffects(dutyStatus),
    qualifiesForThirtyMinuteInterruption:
      dutyStatus !== 'DRIVING' && minutes >= 30,
    sleeperPair: { participates: false },
    provenance: {
      origin: 'CALCULATED',
      verification: 'UNVERIFIED',
      sourceName: 'Stage 10 stop processor',
      explanation: 'Calculated from the explicit stop configuration.',
    },
  });
}

function currentContextTime(context: StopHosContext): UtcInstant {
  return context.dutyEvents.at(-1)?.endAt ?? context.departureState.departureAt;
}

function calculateContext(context: StopHosContext): HosCoreCalculationResult {
  return calculateHosCore({
    departureState: validateDriverHosDepartureState(context.departureState),
    dutyEvents: context.dutyEvents,
  });
}

function timelineEvent(
  type: StopTimelineEventType,
  startAt: UtcInstant,
  endAt: UtcInstant,
  explanation: string,
  dutyEvent?: DutyEvent,
): StopTimelineEvent {
  return freeze({
    type,
    startAt,
    endAt,
    duration: durationInMinutes(minutesBetween(startAt, endAt)),
    ...(dutyEvent === undefined ? {} : {
      dutyStatus: dutyEvent.dutyStatus,
      dutyEventId: dutyEvent.id,
    }),
    explanation,
  });
}

function appendDutyEvent(
  stopEvents: DutyEvent[],
  timeline: StopTimelineEvent[],
  stop: TripStopPlan,
  kind: 'wait' | 'check-in' | 'service' | 'hos-hold',
  timelineType: StopTimelineEventType,
  startAt: UtcInstant,
  minutes: number,
  dutyStatus: HosDutyStatus,
  explanation: string,
): UtcInstant {
  if (minutes <= 0) return startAt;
  const event = calculatedDutyEvent(
    stop,
    kind,
    startAt,
    minutes,
    dutyStatus,
    stopEvents.length + 1,
  );
  stopEvents.push(event);
  timeline.push(
    timelineEvent(timelineType, event.startAt, event.endAt, explanation, event),
  );
  return event.endAt;
}

function maxInstant(...values: readonly UtcInstant[]): UtcInstant {
  if (values.length === 0) {
    throw new StopProcessingError('At least one timestamp is required.');
  }
  return values.reduce((latest, candidate) =>
    timestamp(candidate) > timestamp(latest) ? candidate : latest,
  );
}

function warning(
  code: StopProcessingWarningCode,
  explanation: string,
): StopProcessingWarning {
  return freeze({ code, explanation });
}

function blockingReason(
  code: StopProcessingBlockingReasonCode,
  explanation: string,
): StopProcessingBlockingReason {
  return freeze({ code, explanation });
}

function createContinuationContext(
  input: StopHosContext,
  stopEvents: readonly DutyEvent[],
): StopHosContext {
  return freeze({
    departureState: input.departureState,
    dutyEvents: freezeArray([...input.dutyEvents, ...stopEvents]),
  });
}

interface StopResultState {
  readonly stop: TripStopPlan;
  readonly projection: StopProjection;
  readonly arrivalAt: UtcInstant;
  readonly serviceStartAt?: UtcInstant;
  readonly serviceCompletedAt?: UtcInstant;
  readonly appointmentOutcome: AppointmentOutcome;
  readonly appointmentDeadlineAt?: UtcInstant;
  readonly latenessBecameUnavoidableAt?: UtcInstant;
  readonly waitingMinutes: number;
  readonly checkInMinutes: number;
  readonly serviceMinutes: number;
  readonly hosHoldMinutes: number;
  readonly arrivalHosClocks: HosCoreClockSnapshot;
  readonly latestHosResult: HosCoreCalculationResult;
  readonly timeline: readonly StopTimelineEvent[];
  readonly stopDutyEvents: readonly DutyEvent[];
  readonly continuationContext: StopHosContext;
  readonly warnings: readonly StopProcessingWarning[];
  readonly blockingReasons: readonly StopProcessingBlockingReason[];
  readonly reasons: readonly string[];
}

function toStopProcessingResult(
  state: StopResultState,
  status: 'ready' | 'blocked',
  departureAt?: UtcInstant,
): StopProcessingResult {
  return freeze({
    stop: state.stop,
    projection: state.projection,
    status,
    arrivalAt: state.arrivalAt,
    ...(state.serviceStartAt === undefined
      ? {}
      : { serviceStartAt: state.serviceStartAt }),
    ...(state.serviceCompletedAt === undefined
      ? {}
      : { serviceCompletedAt: state.serviceCompletedAt }),
    ...(departureAt === undefined ? {} : { departureAt }),
    appointmentOutcome: state.appointmentOutcome,
    ...(state.appointmentDeadlineAt === undefined
      ? {}
      : { appointmentDeadlineAt: state.appointmentDeadlineAt }),
    ...(state.latenessBecameUnavoidableAt === undefined
      ? {}
      : {
          latenessBecameUnavoidableAt:
            state.latenessBecameUnavoidableAt,
        }),
    waitingTime: durationInMinutes(state.waitingMinutes),
    checkInTime: durationInMinutes(state.checkInMinutes),
    serviceTime: durationInMinutes(state.serviceMinutes),
    hosHoldTime: durationInMinutes(state.hosHoldMinutes),
    arrivalHosClocks: state.arrivalHosClocks,
    departureHosClocks: state.latestHosResult.final,
    nextRequiredAction: state.latestHosResult.nextRequiredAction,
    timeline: state.timeline,
    stopDutyEvents: state.stopDutyEvents,
    continuationContext: state.continuationContext,
    warnings: state.warnings,
    blockingReasons: state.blockingReasons,
    reasons: state.reasons,
  });
}

function parkingAvailableForInterruption(stop: TripStopPlan): boolean {
  return stop.earlyParkingAllowed || stop.overnightParkingAllowed;
}

function appendHosHoldIfPossible(
  stop: TripStopPlan,
  context: StopHosContext,
  stopEvents: DutyEvent[],
  timeline: StopTimelineEvent[],
  startAt: UtcInstant,
  reasons: string[],
  blockingReasons: StopProcessingBlockingReason[],
): {
  readonly endAt: UtcInstant;
  readonly holdMinutes: number;
  readonly result: HosCoreCalculationResult;
} {
  let result = calculateContext(createContinuationContext(context, stopEvents));
  let endAt = startAt;
  let holdMinutes = 0;

  if (result.violations.length > 0) {
    blockingReasons.push(
      blockingReason(
        'HOS_VIOLATION_PRESENT',
        'The cumulative duty-event history already contains an HOS violation. Stage 10 will not manufacture a departure around it.',
      ),
    );
    return freeze({ endAt, holdMinutes, result });
  }

  if (result.nextRequiredAction.code === 'TAKE_THIRTY_MINUTE_INTERRUPTION') {
    if (!parkingAvailableForInterruption(stop)) {
      blockingReasons.push(
        blockingReason(
          'HOS_REST_PARKING_UNAVAILABLE',
          'A qualifying 30-minute non-driving interruption is required, but this stop does not permit early or overnight parking.',
        ),
      );
      return freeze({ endAt, holdMinutes, result });
    }
    const minutes = Math.max(
      0,
      30 - result.final.consecutiveNonDrivingTime.value,
    );
    endAt = appendDutyEvent(
      stopEvents,
      timeline,
      stop,
      'hos-hold',
      'HOS_HOLD',
      endAt,
      minutes,
      'OFF_DUTY',
      'Complete the remaining qualifying non-driving interruption before departure.',
    );
    holdMinutes += minutes;
    reasons.push(
      `A ${String(minutes)}-minute off-duty hold completed the standard 30-minute interruption at the stop.`,
    );
    result = calculateContext(createContinuationContext(context, stopEvents));
  }

  if (
    result.nextRequiredAction.code ===
    'TAKE_TEN_CONSECUTIVE_HOURS_OFF_DUTY'
  ) {
    if (!stop.overnightParkingAllowed) {
      blockingReasons.push(
        blockingReason(
          'HOS_REST_PARKING_UNAVAILABLE',
          'A qualifying 10-consecutive-hour rest is required, but overnight parking is not allowed at this stop.',
        ),
      );
      return freeze({ endAt, holdMinutes, result });
    }
    const minutes = Math.max(
      0,
      10 * 60 - result.final.consecutiveResetQualifyingTime.value,
    );
    const dutyStatus: HosDutyStatus =
      stop.type === 'sleeper-rest' || stop.serviceDutyStatus === 'SLEEPER_BERTH'
        ? 'SLEEPER_BERTH'
        : 'OFF_DUTY';
    endAt = appendDutyEvent(
      stopEvents,
      timeline,
      stop,
      'hos-hold',
      'HOS_HOLD',
      endAt,
      minutes,
      dutyStatus,
      'Complete the remaining qualifying 10-consecutive-hour rest before departure.',
    );
    holdMinutes += minutes;
    reasons.push(
      `A ${String(minutes)}-minute ${dutyStatus.toLowerCase().replaceAll('_', ' ')} hold completed the standard 10-hour rest at the stop.`,
    );
    result = calculateContext(createContinuationContext(context, stopEvents));
  }

  if (result.nextRequiredAction.code === 'WAIT_FOR_CYCLE_AVAILABILITY') {
    blockingReasons.push(
      blockingReason(
        'CYCLE_AVAILABILITY_REQUIRED',
        'Cycle availability is zero. A recap or explicitly planned restart must be resolved by the Stage 06 cycle engine before departure can be scheduled.',
      ),
    );
  } else if (!result.final.canDrive) {
    blockingReasons.push(
      blockingReason(
        'HOS_DEPARTURE_BLOCKED',
        `Departure remains blocked: ${result.nextRequiredAction.explanation}`,
      ),
    );
  }

  return freeze({ endAt, holdMinutes, result });
}

export function processStop(input: StopProcessingInput): StopProcessingResult {
  const stop = validateTripStopPlan(input.stop);
  const arrivalAt = UtcInstantSchema.parse(input.arrivalAt);
  const projection = z.enum(STOP_PROJECTIONS).parse(input.projection);
  const expectedContextTime = currentContextTime(input.hosContext);
  if (timestamp(expectedContextTime) !== timestamp(arrivalAt)) {
    throw new StopProcessingError(
      `Stop arrival ${arrivalAt} must equal the current HOS context time ${expectedContextTime}.`,
    );
  }

  const arrivalResult = calculateContext(input.hosContext);
  const arrivalHosClocks = arrivalResult.final;
  const appointment = resolveAppointmentBounds(stop.appointment);
  const outcome = appointmentOutcome(arrivalAt, stop.appointment, appointment);
  const checkpoints = input.feasibilityCheckpoints ?? [];
  const latenessBecameUnavoidableAt = identifyLatenessBecameUnavoidable(
    checkpoints,
    appointment.deadlineAt,
    arrivalAt,
  );
  const warnings: StopProcessingWarning[] = [];
  const blockingReasons: StopProcessingBlockingReason[] = [];
  const reasons: string[] = [
    'Arrival, waiting, check-in, service completion, HOS hold, and departure are calculated as distinct events.',
  ];
  const timeline: StopTimelineEvent[] = [
    timelineEvent(
      'ARRIVAL',
      arrivalAt,
      arrivalAt,
      `Arrived at ${stop.location.description}.`,
    ),
  ];
  const stopEvents: DutyEvent[] = [];

  if (arrivalResult.violations.length > 0) {
    blockingReasons.push(
      blockingReason(
        'HOS_VIOLATION_PRESENT',
        'The cumulative HOS context contains a violation before this stop is processed.',
      ),
    );
  }
  if (outcome === 'at-risk') {
    warnings.push(
      warning(
        'APPOINTMENT_AT_RISK',
        'Arrival is after the appointment deadline but within the entered late-arrival tolerance.',
      ),
    );
  }
  if (outcome === 'missed') {
    warnings.push(
      warning(
        'APPOINTMENT_MISSED',
        'Arrival is later than the appointment deadline plus the entered tolerance.',
      ),
    );
  }

  const appointmentEligibleAt =
    appointment.notBeforeAt === undefined
      ? arrivalAt
      : maxInstant(arrivalAt, appointment.notBeforeAt);
  const facilityWindows = resolveFacilityWindows(
    stop.facilityHours,
    stop.location.timeZone,
  );
  const facility = facilityAvailability(appointmentEligibleAt, facilityWindows);
  if (facility.status === 'closed') {
    blockingReasons.push(
      blockingReason(
        'FACILITY_CLOSED_WITHOUT_FUTURE_HOURS',
        'The entered facility-hour windows contain no opening at or after the appointment-eligible time.',
      ),
    );
    if (!stop.required) {
      warnings.push(
        warning(
          'OPTIONAL_STOP_BLOCKS_DEPARTURE',
          'This optional stop cannot currently be completed and blocks continuation until removed, reordered, or given future facility hours.',
        ),
      );
    }
    const context = createContinuationContext(input.hosContext, stopEvents);
    return toStopProcessingResult(
      {
        stop,
        projection,
        arrivalAt,
        appointmentOutcome: outcome,
        ...(appointment.deadlineAt === undefined
          ? {}
          : { appointmentDeadlineAt: appointment.deadlineAt }),
        ...(latenessBecameUnavoidableAt === undefined
          ? {}
          : { latenessBecameUnavoidableAt }),
        waitingMinutes: 0,
        checkInMinutes: 0,
        serviceMinutes: 0,
        hosHoldMinutes: 0,
        arrivalHosClocks,
        latestHosResult: arrivalResult,
        timeline: freezeArray(timeline),
        stopDutyEvents: freezeArray(stopEvents),
        continuationContext: context,
        warnings: freezeArray(warnings),
        blockingReasons: freezeArray(blockingReasons),
        reasons: freezeArray(reasons),
      },
      'blocked',
    );
  }

  const serviceGateAt = maxInstant(appointmentEligibleAt, facility.availableAt);
  const waitingMinutes = minutesBetween(arrivalAt, serviceGateAt);
  let cursor = appendDutyEvent(
    stopEvents,
    timeline,
    stop,
    'wait',
    'APPOINTMENT_WAIT',
    arrivalAt,
    waitingMinutes,
    stop.waitingDutyStatus,
    facility.status === 'wait-for-open'
      ? 'Wait until both the appointment condition and the next entered facility opening are satisfied.'
      : 'Wait until the entered appointment condition is satisfied.',
  );

  const checkInMinutes = stop.checkInDuration.value;
  cursor = appendDutyEvent(
    stopEvents,
    timeline,
    stop,
    'check-in',
    'CHECK_IN',
    cursor,
    checkInMinutes,
    stop.checkInDutyStatus,
    'Complete gate entry or facility check-in before service starts.',
  );
  const serviceStartAt = cursor;
  const projectedServiceMinutes = serviceMinutes(stop.serviceDuration, projection);
  cursor = appendDutyEvent(
    stopEvents,
    timeline,
    stop,
    'service',
    'SERVICE',
    cursor,
    projectedServiceMinutes,
    stop.serviceDutyStatus,
    `Apply the ${projection} service-duration projection for this stop.`,
  );
  const serviceCompletedAt = cursor;

  if (
    appointment.deadlineAt !== undefined &&
    timestamp(serviceStartAt) > timestamp(appointment.deadlineAt)
  ) {
    warnings.push(
      warning(
        'SERVICE_START_AFTER_APPOINTMENT',
        'Service is projected to start after the appointment deadline even though arrival may have occurred earlier.',
      ),
    );
  }
  if (
    facility.activeWindowEndAt !== undefined &&
    timestamp(serviceCompletedAt) > timestamp(facility.activeWindowEndAt)
  ) {
    warnings.push(
      warning(
        'SERVICE_EXTENDS_PAST_FACILITY_HOURS',
        'Projected check-in and service extend beyond the entered active facility-hours window.',
      ),
    );
  }

  const hold = appendHosHoldIfPossible(
    stop,
    input.hosContext,
    stopEvents,
    timeline,
    cursor,
    reasons,
    blockingReasons,
  );
  cursor = hold.endAt;
  const continuationContext = createContinuationContext(
    input.hosContext,
    stopEvents,
  );

  if (!stop.required && blockingReasons.length > 0) {
    warnings.push(
      warning(
        'OPTIONAL_STOP_BLOCKS_DEPARTURE',
        'This optional stop now blocks legal continuation and should be removed, reordered, or explicitly resolved.',
      ),
    );
  }

  const baseState: StopResultState = {
    stop,
    projection,
    arrivalAt,
    serviceStartAt,
    serviceCompletedAt,
    appointmentOutcome: outcome,
    ...(appointment.deadlineAt === undefined
      ? {}
      : { appointmentDeadlineAt: appointment.deadlineAt }),
    ...(latenessBecameUnavoidableAt === undefined
      ? {}
      : { latenessBecameUnavoidableAt }),
    waitingMinutes,
    checkInMinutes,
    serviceMinutes: projectedServiceMinutes,
    hosHoldMinutes: hold.holdMinutes,
    arrivalHosClocks,
    latestHosResult: hold.result,
    timeline: freezeArray(timeline),
    stopDutyEvents: freezeArray(stopEvents),
    continuationContext,
    warnings: freezeArray(warnings),
    blockingReasons: freezeArray(blockingReasons),
    reasons: freezeArray(reasons),
  };

  if (blockingReasons.length > 0) {
    return toStopProcessingResult(baseState, 'blocked');
  }

  timeline.push(
    timelineEvent(
      'DEPARTURE',
      cursor,
      cursor,
      `Legally and operationally ready to depart ${stop.location.description}.`,
    ),
  );
  return toStopProcessingResult(
    {
      ...baseState,
      timeline: freezeArray(timeline),
    },
    'ready',
    cursor,
  );
}

export interface OrderedStopLeg {
  readonly fromStopId: string;
  readonly toStopId: string;
  readonly dutyEvents: readonly DutyEvent[];
  readonly feasibilityCheckpoints?: readonly AppointmentFeasibilityCheckpoint[];
}

export interface OrderedStopProcessingInput {
  readonly stops: readonly unknown[];
  readonly initialHosContext: StopHosContext;
  readonly projection: StopProjection;
  readonly legs: readonly OrderedStopLeg[];
  readonly firstStopFeasibilityCheckpoints?: readonly AppointmentFeasibilityCheckpoint[];
}

export interface OrderedStopProcessingResult {
  readonly status: 'complete' | 'blocked';
  readonly stopResults: readonly StopProcessingResult[];
  readonly completedStopCount: number;
  readonly finalHosContext: StopHosContext;
  readonly blockingStopId?: string;
  readonly reasons: readonly string[];
}

function appendLegEvents(
  context: StopHosContext,
  leg: OrderedStopLeg,
): StopHosContext {
  if (leg.dutyEvents.length === 0) {
    throw new StopProcessingError(
      `Leg ${leg.fromStopId} to ${leg.toStopId} must include timestamped duty events.`,
    );
  }
  const expectedStartAt = currentContextTime(context);
  if (leg.dutyEvents[0]?.startAt !== expectedStartAt) {
    throw new StopProcessingError(
      `Leg ${leg.fromStopId} to ${leg.toStopId} must start at ${expectedStartAt}.`,
    );
  }
  const next = freeze({
    departureState: context.departureState,
    dutyEvents: freezeArray([...context.dutyEvents, ...leg.dutyEvents]),
  });
  calculateContext(next);
  return next;
}

export function processOrderedStops(
  input: OrderedStopProcessingInput,
): OrderedStopProcessingResult {
  const stops = validateOrderedStops(input.stops);
  const projection = z.enum(STOP_PROJECTIONS).parse(input.projection);
  const expectedLegCount = Math.max(0, stops.length - 1);
  if (input.legs.length !== expectedLegCount) {
    throw new StopProcessingError(
      `Expected ${String(expectedLegCount)} ordered leg(s) for ${String(stops.length)} stop(s).`,
    );
  }

  let context = freeze({
    departureState: validateDriverHosDepartureState(
      input.initialHosContext.departureState,
    ),
    dutyEvents: freezeArray([...input.initialHosContext.dutyEvents]),
  });
  calculateContext(context);
  const results: StopProcessingResult[] = [];
  const reasons: string[] = [
    'Stops were processed in their explicit sequence and each leg consumed timestamped HOS events before the next arrival.',
  ];

  for (let index = 0; index < stops.length; index += 1) {
    const stop = stops[index];
    if (stop === undefined) continue;
    const previousLeg = input.legs[index - 1];
    const checkpoints =
      index === 0
        ? input.firstStopFeasibilityCheckpoints
        : previousLeg?.feasibilityCheckpoints;
    const result = processStop({
      stop,
      arrivalAt: currentContextTime(context),
      hosContext: context,
      projection,
      ...(checkpoints === undefined
        ? {}
        : { feasibilityCheckpoints: checkpoints }),
    });
    results.push(result);
    context = result.continuationContext;

    if (result.status === 'blocked') {
      return freeze({
        status: 'blocked',
        stopResults: freezeArray(results),
        completedStopCount: results.length - 1,
        finalHosContext: context,
        blockingStopId: stop.id,
        reasons: freezeArray([
          ...reasons,
          `Processing stopped at ${stop.id} because legal or operational departure could not be established.`,
        ]),
      });
    }

    const nextStop = stops[index + 1];
    if (nextStop === undefined) continue;
    const leg = input.legs[index];
    if (
      leg === undefined ||
      leg.fromStopId !== stop.id ||
      leg.toStopId !== nextStop.id
    ) {
      throw new StopProcessingError(
        `Leg ${String(index + 1)} must connect ${stop.id} to ${nextStop.id}.`,
      );
    }
    context = appendLegEvents(context, leg);
  }

  return freeze({
    status: 'complete',
    stopResults: freezeArray(results),
    completedStopCount: results.length,
    finalHosContext: context,
    reasons: freezeArray(reasons),
  });
}
