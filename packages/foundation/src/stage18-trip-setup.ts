import { CommercialRouteRequestSchema } from './commercial-routing.js';
import type {
  CommercialRouteRequest,
  ResolvedCommercialLocation,
} from './commercial-routing.js';
import {
  buildEquipmentRoutePhysicalInput,
  validateEquipmentCombination,
} from './equipment.js';
import type {
  EquipmentCombination,
  EquipmentValidationIssue,
} from './equipment.js';
import { validateDriverHosDepartureState } from './hos.js';
import type {
  CycleRecapReturn,
  DriverHosDepartureState,
  DriverHosProvenance,
  HosCycleType,
  HosDutyStatus,
  SleeperPeriodEvidence,
} from './hos.js';
import { validateOrderedStops } from './stops.js';
import type { TripStopPlan } from './stops.js';
import { utcInstant } from './time.js';
import type { IanaTimeZone, UtcInstant } from './time.js';
import {
  durationInMinutes,
  lengthInInches,
  speedInMilesPerHour,
} from './units.js';

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

export interface Stage18HosFormInput {
  readonly driverId?: string | undefined;
  readonly driverNameOrIdentifier: string;
  readonly departureAt: string;
  readonly departureTimeZone: string;
  readonly currentDutyStatus: HosDutyStatus;
  readonly currentDutyStatusStartedAt: string;
  readonly drivingMinutesRemaining: number;
  readonly shiftMinutesRemaining: number;
  readonly cycleMinutesRemaining: number;
  readonly cycleType: HosCycleType;
  readonly drivenMinutesSinceLastQualifyingInterruption: number;
  readonly onDutyMinutesCurrentShift: number;
  readonly offDutyMinutesImmediatelyBeforeDeparture: number;
  readonly qualifyingTenHourBreakCompleted: boolean;
  readonly priorDutyMinutes: readonly number[];
  readonly recapReturns?: readonly CycleRecapReturn[] | undefined;
  readonly sleeperBerthEligible: boolean;
  readonly existingSleeperPeriods?: readonly SleeperPeriodEvidence[] | undefined;
  readonly splitSleeperEnabled: boolean;
  readonly restart34HourPlanned: boolean;
  readonly carrierMaxDailyDrivingMinutes: number;
  readonly carrierMaxDutyMinutes: number;
  readonly nightlyRestPreference?:
    | Readonly<{
        readonly startLocalTime: string;
        readonly endLocalTime: string;
        readonly timeZone: string;
      }>
    | undefined;
}

export interface Stage18CommercialStopReference {
  readonly stopId: string;
  readonly sequence: number;
  readonly required: boolean;
  readonly location: ResolvedCommercialLocation;
}

export type Stage18RouteInputResult =
  | Readonly<{
      readonly status: 'ready';
      readonly request: CommercialRouteRequest;
      readonly issues: readonly EquipmentValidationIssue[];
    }>
  | Readonly<{
      readonly status: 'blocked';
      readonly issues: readonly EquipmentValidationIssue[];
    }>;

const userEnteredProvenance = freeze({
  origin: 'USER_ENTERED' as const,
  verification: 'UNVERIFIED' as const,
  sourceName: 'TripRouteCalc Stage 18 setup UI',
  explanation:
    'The value was entered by the authenticated user and requires independent verification where legally material.',
});

function provenance(): DriverHosProvenance {
  return freeze({
    driver: userEnteredProvenance,
    departure: userEnteredProvenance,
    dutyStatus: userEnteredProvenance,
    clocks: userEnteredProvenance,
    dutyHistory: userEnteredProvenance,
    sleeper: userEnteredProvenance,
    carrierPolicy: userEnteredProvenance,
    restPreference: userEnteredProvenance,
  });
}

function localDateAt(instant: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant));
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function buildStage18HosDepartureState(
  input: Stage18HosFormInput,
): DriverHosDepartureState {
  const departureAt = utcInstant(input.departureAt);
  const requiredDays =
    input.cycleType === 'SEVENTY_HOURS_EIGHT_DAYS' ? 8 : 7;
  const departureDate = localDateAt(departureAt, input.departureTimeZone);
  if (input.priorDutyMinutes.length !== requiredDays) {
    throw new RangeError(
      `${input.cycleType} requires exactly ${String(requiredDays)} prior daily totals.`,
    );
  }
  const priorDutyDays = input.priorDutyMinutes.map((minutes, index) => ({
    date: addDays(departureDate, index - requiredDays),
    onDutyTime: durationInMinutes(minutes),
  }));

  return validateDriverHosDepartureState({
    driver: {
      ...(input.driverId === undefined ? {} : { id: input.driverId }),
      nameOrIdentifier: input.driverNameOrIdentifier,
    },
    departureAt,
    departureTimeZone: input.departureTimeZone,
    currentDutyStatus: input.currentDutyStatus,
    currentDutyStatusStartedAt: utcInstant(input.currentDutyStatusStartedAt),
    drivingTimeRemaining: durationInMinutes(input.drivingMinutesRemaining),
    shiftTimeRemaining: durationInMinutes(input.shiftMinutesRemaining),
    cycleTimeRemaining: durationInMinutes(input.cycleMinutesRemaining),
    cycleType: input.cycleType,
    drivenSinceLastQualifyingInterruption: durationInMinutes(
      input.drivenMinutesSinceLastQualifyingInterruption,
    ),
    onDutyTimeCurrentShift: durationInMinutes(
      input.onDutyMinutesCurrentShift,
    ),
    offDutyTimeImmediatelyBeforeDeparture: durationInMinutes(
      input.offDutyMinutesImmediatelyBeforeDeparture,
    ),
    qualifyingTenHourBreakCompleted: input.qualifyingTenHourBreakCompleted,
    priorDutyDays,
    recapReturns: freezeArray(input.recapReturns ?? []),
    sleeperBerthEligible: input.sleeperBerthEligible,
    existingSleeperPeriods: freezeArray(input.existingSleeperPeriods ?? []),
    splitSleeperEnabled: input.splitSleeperEnabled,
    restart34HourPlanned: input.restart34HourPlanned,
    carrierMaxDailyDriving: durationInMinutes(
      input.carrierMaxDailyDrivingMinutes,
    ),
    carrierMaxDuty: durationInMinutes(input.carrierMaxDutyMinutes),
    ...(input.nightlyRestPreference === undefined
      ? {}
      : { nightlyRestPreference: input.nightlyRestPreference }),
    provenance: provenance(),
  });
}

export function buildStage18CommercialRouteRequest(input: {
  readonly requestId: string;
  readonly requestedAt: UtcInstant;
  readonly departureAt: UtcInstant;
  readonly equipment: EquipmentCombination;
  readonly origin: ResolvedCommercialLocation;
  readonly orderedStops: readonly Stage18CommercialStopReference[];
  readonly routePolicy:
    | 'fastest-compliant'
    | 'shortest-compliant'
    | 'balanced-compliant';
  readonly avoidances: readonly (
    | 'tolls'
    | 'ferries'
    | 'tunnels'
    | 'uncontrolled-border-crossings'
    | 'unpaved-roads'
    | 'seasonal-roads'
    | 'hazmat-restricted-roads'
    | 'permit-only-roads'
  )[];
}): Stage18RouteInputResult {
  const validation = validateEquipmentCombination(input.equipment);
  const routeInput = buildEquipmentRoutePhysicalInput(input.equipment);
  if (routeInput.status === 'blocked') {
    return freeze({
      status: 'blocked' as const,
      issues: freezeArray(routeInput.validation.issues),
    });
  }
  const { tractor, trailer, load } = routeInput.input;
  const combinedOverallLength = lengthInInches(
    tractor.overallLength.value + trailer.length.value,
  );
  const combinedHeight = lengthInInches(
    Math.max(tractor.height.value, trailer.height.value, load.height.value),
  );
  const combinedWidth = lengthInInches(
    Math.max(tractor.width.value, trailer.width.value, load.width.value),
  );
  const permitIdentifiers = input.equipment.load.permits.map(
    (permit) => permit.identifier,
  );

  const request = CommercialRouteRequestSchema.parse({
    requestId: input.requestId,
    requestedAt: input.requestedAt,
    departureAt: input.departureAt,
    equipment: {
      ...routeInput.input,
      trailerCount: 1,
      combinedDimensions: {
        overallLength: combinedOverallLength,
        height: combinedHeight,
        width: combinedWidth,
      },
    },
    origin: input.origin,
    orderedStops: input.orderedStops,
    avoidances: input.avoidances,
    routePolicy: input.routePolicy,
    permitIdentifiers,
    comparisonMode: 'commercial-route-only',
  });

  return freeze({
    status: 'ready' as const,
    request,
    issues: freezeArray(validation.issues),
  });
}

export function buildStage18SpeedModel(input: {
  readonly governedMph: number;
  readonly planningMph: number;
  readonly fallbackMph: number;
}): Readonly<Record<string, unknown>> {
  return freeze({
    governedMaximumSpeed: speedInMilesPerHour(input.governedMph),
    preferredPlanningSpeed: speedInMilesPerHour(input.planningMph),
    maximumAverageTripSpeed: speedInMilesPerHour(input.planningMph),
    carrierMaximumSpeed: speedInMilesPerHour(input.governedMph),
    fallbackAverageSpeed: speedInMilesPerHour(input.fallbackMph),
    roadClassSpeeds: [
      freeze({
        roadClass: 'INTERSTATE' as const,
        speed: speedInMilesPerHour(input.planningMph),
      }),
      freeze({
        roadClass: 'OTHER' as const,
        speed: speedInMilesPerHour(input.fallbackMph),
      }),
    ],
    projectionFactors: freeze({
      earliestLegalBasisPoints: 10_000,
      expectedBasisPoints: 9_000,
      conservativeBasisPoints: 8_000,
    }),
    explanation:
      'User-entered governed, planning, and fallback speeds. These are planning assumptions, not posted speed limits or legal authority.',
  });
}

export function validateStage18OrderedStops(
  stops: readonly unknown[],
): readonly TripStopPlan[] {
  return validateOrderedStops(stops);
}
