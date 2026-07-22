import { Temporal } from '@js-temporal/polyfill';
import {
  LoadProfileSchema,
  TractorProfileSchema,
  TrailerProfileSchema,
  TripStopPlanSchema,
  buildStage18CommercialRouteRequest,
  buildStage18HosDepartureState,
  buildStage18SpeedModel,
  distanceInMiles,
  durationInMinutes,
  lengthInFeet,
  lengthInInches,
  loadProfile,
  localDateTime,
  speedInMilesPerHour,
  tractorProfile,
  trailerProfile,
  utcInstant,
  validateEquipmentCombination,
  volumeInUsGallons,
  weightInPounds,
} from '@trip-route-calc/foundation';
import type {
  DriverHosDepartureState,
  EquipmentCombination,
  EtaSimulationInput,
  LoadProfile,
  NormalizedCommercialRouteResult,
  ResolvedCommercialLocation,
  TractorProfile,
  TrailerProfile,
  TripStopPlan,
  UtcInstant,
} from '@trip-route-calc/foundation';
import { z } from 'zod';

import type {
  CycleRecapReturnForm,
  DriverForm,
  HosForm,
  LoadForm,
  RouteForm,
  SleeperPeriodForm,
  StopForm,
  StopType,
  TractorForm,
  TrailerForm,
  TripDraft,
  ValidationIssue,
} from './types.js';

export const DRAFT_STORAGE_KEY = 'trip-route-calc.stage18.draft.v2';
const LEGACY_DRAFT_STORAGE_KEY = 'trip-route-calc.stage18.draft.v1';

const dutyStatusSchema = z.enum([
  'OFF_DUTY',
  'SLEEPER_BERTH',
  'DRIVING',
  'ON_DUTY_NOT_DRIVING',
]);
const dutyEventSourceSchema = z.enum([
  'USER_ENTERED',
  'ELD_PROVIDER',
  'CARRIER_SYSTEM',
  'CALCULATED',
  'VERIFIED_RECORD',
]);
const sleeperCandidateRoleSchema = z.enum(['SHORT_PERIOD', 'LONG_PERIOD']);
const stopTypeSchema = z.enum([
  'start-location',
  'tractor-pickup',
  'trailer-pickup',
  'shipper',
  'intermediate-pickup',
  'intermediate-delivery',
  'final-consignee',
  'fuel',
  'scale',
  'inspection',
  'maintenance',
  'food',
  'driver-break',
  'sleeper-rest',
  'terminal',
  'border-crossing',
  'other',
]);
const finiteNumber = z.number().finite();
const optionalId = z.string().trim().min(1).optional();
const driverFormSchema = z.object({
  id: optionalId,
  displayName: z.string(),
});
const cycleRecapReturnFormSchema = z.object({
  localId: z.string().trim().min(1),
  sourceDate: z.string(),
  availableLocal: z.string(),
  returnedMinutes: finiteNumber,
});
const sleeperPeriodFormSchema = z.object({
  id: z.string().trim().min(1),
  startLocal: z.string(),
  endLocal: z.string(),
  durationMinutes: finiteNumber,
  candidateRole: sleeperCandidateRoleSchema,
  pairId: z.string(),
  source: dutyEventSourceSchema,
  explanation: z.string(),
});
const hosFormSchema = z.object({
  departureLocal: z.string(),
  departureTimeZone: z.string(),
  currentDutyStatus: dutyStatusSchema,
  currentDutyStatusStartedLocal: z.string(),
  drivingMinutesRemaining: finiteNumber,
  shiftMinutesRemaining: finiteNumber,
  cycleMinutesRemaining: finiteNumber,
  cycleType: z.enum(['SIXTY_HOURS_SEVEN_DAYS', 'SEVENTY_HOURS_EIGHT_DAYS']),
  drivenMinutesSinceInterruption: finiteNumber,
  onDutyMinutesCurrentShift: finiteNumber,
  offDutyMinutesBeforeDeparture: finiteNumber,
  qualifyingTenHourBreakCompleted: z.boolean(),
  priorDutyMinutes: z.array(finiteNumber),
  recapReturns: z.array(cycleRecapReturnFormSchema),
  sleeperBerthEligible: z.boolean(),
  existingSleeperPeriods: z.array(sleeperPeriodFormSchema),
  splitSleeperEnabled: z.boolean(),
  restart34HourPlanned: z.boolean(),
  adverseConditionSelected: z.boolean(),
  carrierMaxDailyDrivingMinutes: finiteNumber,
  carrierMaxDutyMinutes: finiteNumber,
  nightlyRestEnabled: z.boolean(),
  nightlyRestStart: z.string(),
  nightlyRestEnd: z.string(),
});
const tractorFormSchema = z.object({
  id: optionalId,
  unitNumber: z.string(),
  tractorType: z.enum(['day-cab', 'sleeper', 'cabover', 'other']),
  axleCount: finiteNumber,
  overallLengthFeet: finiteNumber,
  heightFeet: finiteNumber,
  widthInches: finiteNumber,
  emptyWeightPounds: finiteNumber,
  registeredGrossWeightPounds: finiteNumber,
  fuelCapacityGallons: finiteNumber,
  estimatedFuelRangeMiles: finiteNumber,
  governedSpeedMph: finiteNumber,
  planningSpeedMph: finiteNumber,
  fallbackSpeedMph: finiteNumber,
  hazmatEquipped: z.boolean(),
  apuAvailable: z.boolean(),
  idleAllowed: z.boolean(),
});
const trailerFormSchema = z.object({
  id: optionalId,
  unitNumber: z.string(),
  trailerType: z.enum([
    'dry-van',
    'refrigerated',
    'flatbed',
    'similar-general-freight',
  ]),
  axleCount: finiteNumber,
  axleConfiguration: z.enum(['fixed', 'sliding']),
  slidingTandemCapability: z.boolean(),
  lengthFeet: finiteNumber,
  heightFeet: finiteNumber,
  widthInches: finiteNumber,
  currentKpraFeet: finiteNumber,
  minimumKpraFeet: finiteNumber,
  maximumKpraFeet: finiteNumber,
  emptyWeightPounds: finiteNumber,
  maximumPayloadPounds: finiteNumber,
  reefer: z.boolean(),
});
const loadFormSchema = z.object({
  id: optionalId,
  referenceNumber: z.string(),
  commodityDescription: z.string(),
  hazmat: z.boolean(),
  hazmatClass: z.string(),
  cargoWeightPounds: finiteNumber,
  steerAxleWeightPounds: finiteNumber,
  driveAxleWeightPounds: finiteNumber,
  trailerAxleWeightPounds: finiteNumber,
  totalGrossWeightPounds: finiteNumber,
  lengthFeet: finiteNumber,
  heightFeet: finiteNumber,
  widthFeet: finiteNumber,
  permitRequirement: z.enum(['not-required', 'required', 'unknown']),
  permitIdentifiers: z.array(z.string()),
});
const stopFormSchema = z.object({
  localId: z.string().trim().min(1),
  publicId: optionalId,
  type: stopTypeSchema,
  required: z.boolean(),
  lockedPosition: z.boolean(),
  locationDescription: z.string(),
  addressText: z.string(),
  latitude: finiteNumber.nullable(),
  longitude: finiteNumber.nullable(),
  timeZone: z.string(),
  appointmentMode: z.enum([
    'none',
    'earliest',
    'latest',
    'fixed',
    'window',
    'open-window',
  ]),
  appointmentStartLocal: z.string(),
  appointmentEndLocal: z.string(),
  lateToleranceMinutes: finiteNumber,
  facilityOpenLocal: z.string(),
  facilityCloseLocal: z.string(),
  checkInMinutes: finiteNumber,
  serviceMode: z.enum(['exact', 'expected', 'range', 'historical-average']),
  serviceMinutes: finiteNumber,
  serviceMinimumMinutes: finiteNumber,
  serviceMaximumMinutes: finiteNumber,
  historicalSourceName: z.string(),
  historicalSampleSize: finiteNumber.nullable(),
  waitingDutyStatus: dutyStatusSchema,
  checkInDutyStatus: dutyStatusSchema,
  serviceDutyStatus: dutyStatusSchema,
  earlyParkingAllowed: z.boolean(),
  overnightParkingAllowed: z.boolean(),
  notes: z.string(),
  instructions: z.string(),
});
const routeFormSchema = z.object({
  ruleSetVersion: z.string(),
  policy: z.enum([
    'fastest-compliant',
    'shortest-compliant',
    'balanced-compliant',
  ]),
  avoidTolls: z.boolean(),
  avoidFerries: z.boolean(),
  avoidTunnels: z.boolean(),
  autoCalculate: z.boolean(),
});
const tripDraftSchema = z.object({
  version: z.literal(2),
  draftId: z.string().trim().min(1),
  tripId: optionalId,
  apiBaseUrl: z.string(),
  driver: driverFormSchema,
  hos: hosFormSchema,
  tractor: tractorFormSchema,
  trailer: trailerFormSchema,
  load: loadFormSchema,
  stops: z.array(stopFormSchema).min(2),
  route: routeFormSchema,
  savedAt: z.string().optional(),
});
const savedDraftEnvelopeSchema = z
  .object({ version: z.union([z.literal(1), z.literal(2)]) })
  .passthrough();

export type DraftAction =
  | Readonly<{ type: 'replace'; draft: TripDraft }>
  | Readonly<{ type: 'driver'; value: DriverForm }>
  | Readonly<{ type: 'hos'; value: HosForm }>
  | Readonly<{ type: 'tractor'; value: TractorForm }>
  | Readonly<{ type: 'trailer'; value: TrailerForm }>
  | Readonly<{ type: 'load'; value: LoadForm }>
  | Readonly<{ type: 'route'; value: RouteForm }>
  | Readonly<{ type: 'stop'; stop: StopForm }>
  | Readonly<{ type: 'add-stop'; stopType: StopType }>
  | Readonly<{ type: 'insert-stop'; afterLocalId: string }>
  | Readonly<{ type: 'duplicate-stop'; localId: string }>
  | Readonly<{ type: 'remove-stop'; localId: string }>
  | Readonly<{ type: 'move-stop'; localId: string; direction: -1 | 1 }>;

function identifier(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function localInputValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && !Array.isArray(value) && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

export function createStopForm(
  type: StopType,
  lockedPosition = false,
  required = true,
): StopForm {
  const rangeService = [
    'shipper',
    'intermediate-pickup',
    'intermediate-delivery',
    'final-consignee',
  ].includes(type);
  const exactService = type === 'fuel' || type === 'scale';
  const serviceMinutes =
    type === 'start-location' ? 0 : type === 'fuel' ? 30 : type === 'scale' ? 15 : 45;
  return {
    localId: identifier('stop'),
    type,
    required,
    lockedPosition,
    locationDescription: '',
    addressText: '',
    latitude: null,
    longitude: null,
    timeZone: browserTimeZone(),
    appointmentMode: 'none',
    appointmentStartLocal: '',
    appointmentEndLocal: '',
    lateToleranceMinutes: 0,
    facilityOpenLocal: '',
    facilityCloseLocal: '',
    checkInMinutes: type === 'start-location' ? 30 : 0,
    serviceMode: rangeService ? 'range' : exactService ? 'exact' : 'expected',
    serviceMinutes,
    serviceMinimumMinutes: rangeService ? 30 : serviceMinutes,
    serviceMaximumMinutes: rangeService ? 60 : serviceMinutes,
    historicalSourceName: '',
    historicalSampleSize: null,
    waitingDutyStatus: 'OFF_DUTY',
    checkInDutyStatus: 'ON_DUTY_NOT_DRIVING',
    serviceDutyStatus: 'ON_DUTY_NOT_DRIVING',
    earlyParkingAllowed: false,
    overnightParkingAllowed: false,
    notes: '',
    instructions: '',
  };
}

export function defaultTripDraft(): TripDraft {
  const departure = new Date(Date.now() + 60 * 60_000);
  const departureLocal = localInputValue(departure);
  const priorDutyMinutes = Object.freeze(Array.from({ length: 8 }, () => 0));
  return {
    version: 2,
    draftId: identifier('draft'),
    apiBaseUrl: '',
    driver: { displayName: '' },
    hos: {
      departureLocal,
      departureTimeZone: browserTimeZone(),
      currentDutyStatus: 'ON_DUTY_NOT_DRIVING',
      currentDutyStatusStartedLocal: departureLocal,
      drivingMinutesRemaining: 660,
      shiftMinutesRemaining: 840,
      cycleMinutesRemaining: 4_200,
      cycleType: 'SEVENTY_HOURS_EIGHT_DAYS',
      drivenMinutesSinceInterruption: 0,
      onDutyMinutesCurrentShift: 0,
      offDutyMinutesBeforeDeparture: 600,
      qualifyingTenHourBreakCompleted: true,
      priorDutyMinutes,
      recapReturns: Object.freeze([]),
      sleeperBerthEligible: true,
      existingSleeperPeriods: Object.freeze([]),
      splitSleeperEnabled: false,
      restart34HourPlanned: false,
      adverseConditionSelected: false,
      carrierMaxDailyDrivingMinutes: 660,
      carrierMaxDutyMinutes: 840,
      nightlyRestEnabled: false,
      nightlyRestStart: '22:00',
      nightlyRestEnd: '08:00',
    },
    tractor: {
      unitNumber: '',
      tractorType: 'sleeper',
      axleCount: 3,
      overallLengthFeet: 20,
      heightFeet: 13.5,
      widthInches: 102,
      emptyWeightPounds: 19_000,
      registeredGrossWeightPounds: 80_000,
      fuelCapacityGallons: 200,
      estimatedFuelRangeMiles: 1_200,
      governedSpeedMph: 65,
      planningSpeedMph: 55,
      fallbackSpeedMph: 50,
      hazmatEquipped: false,
      apuAvailable: true,
      idleAllowed: false,
    },
    trailer: {
      unitNumber: '',
      trailerType: 'dry-van',
      axleCount: 2,
      axleConfiguration: 'sliding',
      slidingTandemCapability: true,
      lengthFeet: 53,
      heightFeet: 13.5,
      widthInches: 102,
      currentKpraFeet: 40,
      minimumKpraFeet: 36,
      maximumKpraFeet: 43,
      emptyWeightPounds: 14_000,
      maximumPayloadPounds: 54_000,
      reefer: false,
    },
    load: {
      referenceNumber: '',
      commodityDescription: '',
      hazmat: false,
      hazmatClass: '',
      cargoWeightPounds: 40_000,
      steerAxleWeightPounds: 12_000,
      driveAxleWeightPounds: 33_000,
      trailerAxleWeightPounds: 32_000,
      totalGrossWeightPounds: 77_000,
      lengthFeet: 48,
      heightFeet: 8,
      widthFeet: 8,
      permitRequirement: 'unknown',
      permitIdentifiers: Object.freeze([]),
    },
    stops: Object.freeze([
      createStopForm('start-location', true),
      createStopForm('final-consignee', true),
    ]),
    route: {
      ruleSetVersion: '',
      policy: 'fastest-compliant',
      avoidTolls: false,
      avoidFerries: false,
      avoidTunnels: false,
      autoCalculate: false,
    },
  };
}

function normalizedSavedDraft(value: unknown): TripDraft {
  const envelope = savedDraftEnvelopeSchema.parse(value);
  const source = record(envelope);
  const base = defaultTripDraft();
  const sourceStops = Array.isArray(source.stops) ? source.stops : [];
  const stops =
    sourceStops.length < 2
      ? base.stops
      : sourceStops.map((rawStop, index) => {
          const endpointType: StopType =
            index === 0
              ? 'start-location'
              : index === sourceStops.length - 1
                ? 'final-consignee'
                : 'other';
          const merged = {
            ...createStopForm(endpointType, index === 0 || index === sourceStops.length - 1),
            ...record(rawStop),
          };
          if (index === 0) {
            return {
              ...merged,
              type: 'start-location' as const,
              required: true,
              lockedPosition: true,
            };
          }
          if (index === sourceStops.length - 1) {
            return {
              ...merged,
              type: 'final-consignee' as const,
              required: true,
              lockedPosition: true,
            };
          }
          return merged;
        });
  return tripDraftSchema.parse({
    ...base,
    ...source,
    version: 2,
    draftId:
      typeof source.draftId === 'string' && source.draftId.trim() !== ''
        ? source.draftId
        : base.draftId,
    driver: { ...base.driver, ...record(source.driver) },
    hos: { ...base.hos, ...record(source.hos) },
    tractor: { ...base.tractor, ...record(source.tractor) },
    trailer: { ...base.trailer, ...record(source.trailer) },
    load: { ...base.load, ...record(source.load) },
    stops,
    route: { ...base.route, ...record(source.route) },
  });
}

export function draftReducer(draft: TripDraft, action: DraftAction): TripDraft {
  switch (action.type) {
    case 'replace':
      return action.draft;
    case 'driver':
      return { ...draft, driver: action.value };
    case 'hos':
      return { ...draft, hos: action.value };
    case 'tractor':
      return { ...draft, tractor: action.value };
    case 'trailer':
      return { ...draft, trailer: action.value };
    case 'load':
      return { ...draft, load: action.value };
    case 'route':
      return { ...draft, route: action.value };
    case 'stop':
      return {
        ...draft,
        stops: draft.stops.map((stop) =>
          stop.localId === action.stop.localId ? action.stop : stop,
        ),
      };
    case 'add-stop': {
      const insertion = createStopForm(action.stopType);
      return {
        ...draft,
        stops: [...draft.stops.slice(0, -1), insertion, draft.stops.at(-1)!],
      };
    }
    case 'insert-stop': {
      const index = draft.stops.findIndex(
        (stop) => stop.localId === action.afterLocalId,
      );
      if (index < 0 || index >= draft.stops.length - 1) return draft;
      const insertion = createStopForm('other');
      return {
        ...draft,
        stops: [
          ...draft.stops.slice(0, index + 1),
          insertion,
          ...draft.stops.slice(index + 1),
        ],
      };
    }
    case 'duplicate-stop': {
      const index = draft.stops.findIndex(
        (stop) => stop.localId === action.localId,
      );
      const source = draft.stops[index];
      if (source === undefined || source.lockedPosition) return draft;
      const duplicate: StopForm = {
        ...source,
        localId: identifier('stop'),
        publicId: undefined,
        lockedPosition: false,
      };
      return {
        ...draft,
        stops: [
          ...draft.stops.slice(0, index + 1),
          duplicate,
          ...draft.stops.slice(index + 1),
        ],
      };
    }
    case 'remove-stop':
      return {
        ...draft,
        stops: draft.stops.filter(
          (stop) => stop.localId !== action.localId || stop.lockedPosition,
        ),
      };
    case 'move-stop': {
      const index = draft.stops.findIndex(
        (stop) => stop.localId === action.localId,
      );
      const target = index + action.direction;
      const moving = draft.stops[index];
      const receiving = draft.stops[target];
      if (
        moving === undefined ||
        receiving === undefined ||
        moving.lockedPosition ||
        receiving.lockedPosition
      ) {
        return draft;
      }
      const stops = [...draft.stops];
      stops[index] = receiving;
      stops[target] = moving;
      return { ...draft, stops };
    }
  }
}

export function saveDraft(draft: TripDraft): void {
  const saved: TripDraft = { ...draft, savedAt: new Date().toISOString() };
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(saved));
  localStorage.removeItem(LEGACY_DRAFT_STORAGE_KEY);
}

export function loadDraft(): TripDraft | undefined {
  const raw =
    localStorage.getItem(DRAFT_STORAGE_KEY) ??
    localStorage.getItem(LEGACY_DRAFT_STORAGE_KEY);
  if (raw === null) return undefined;
  try {
    const parsed = normalizedSavedDraft(JSON.parse(raw));
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(parsed));
    localStorage.removeItem(LEGACY_DRAFT_STORAGE_KEY);
    return parsed;
  } catch {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    localStorage.removeItem(LEGACY_DRAFT_STORAGE_KEY);
    return undefined;
  }
}

export function clearDraft(): void {
  localStorage.removeItem(DRAFT_STORAGE_KEY);
  localStorage.removeItem(LEGACY_DRAFT_STORAGE_KEY);
}

export function localToInstant(local: string, timeZone: string): UtcInstant {
  return utcInstant(
    Temporal.PlainDateTime.from(local)
      .toZonedDateTime(timeZone)
      .toInstant()
      .toString(),
  );
}

export function tractorFromForm(form: TractorForm): TractorProfile {
  return tractorProfile({
    unitNumber: form.unitNumber,
    tractorType: form.tractorType,
    axleCount: form.axleCount,
    overallLength: lengthInFeet(form.overallLengthFeet),
    height: lengthInFeet(form.heightFeet),
    width: lengthInInches(form.widthInches),
    emptyWeight: weightInPounds(form.emptyWeightPounds),
    registeredGrossWeight: weightInPounds(form.registeredGrossWeightPounds),
    fuelCapacity: volumeInUsGallons(form.fuelCapacityGallons),
    estimatedFuelRange: distanceInMiles(form.estimatedFuelRangeMiles),
    governedSpeed: speedInMilesPerHour(form.governedSpeedMph),
    planningCruiseSpeed: speedInMilesPerHour(form.planningSpeedMph),
    hazmatEquipped: form.hazmatEquipped,
    californiaCompliance: { status: 'not-evaluated' },
    idleAuxiliaryPower: {
      idleAllowed: form.idleAllowed,
      auxiliaryPowerUnitAvailable: form.apuAvailable,
    },
    fieldEvidence: [],
    extensionMetadata: {},
  });
}

export function trailerFromForm(form: TrailerForm): TrailerProfile {
  return trailerProfile({
    trailerNumber: form.unitNumber,
    trailerType: form.trailerType,
    length: lengthInFeet(form.lengthFeet),
    width: lengthInInches(form.widthInches),
    height: lengthInFeet(form.heightFeet),
    axleCount: form.axleCount,
    slidingTandemCapability: form.slidingTandemCapability,
    axleConfiguration: form.axleConfiguration,
    currentKpra: lengthInFeet(form.currentKpraFeet),
    minimumAchievableKpra: lengthInFeet(form.minimumKpraFeet),
    maximumAchievableKpra: lengthInFeet(form.maximumKpraFeet),
    railPositionMappings: [],
    emptyWeight: weightInPounds(form.emptyWeightPounds),
    maximumPayload: weightInPounds(form.maximumPayloadPounds),
    reefer: form.reefer,
    liftgate: false,
    specialEquipment: [],
    fieldEvidence: [],
    extensionMetadata: {},
  });
}

export function loadFromForm(form: LoadForm): LoadProfile {
  return loadProfile({
    loadIdentifier: form.referenceNumber,
    commodity: form.commodityDescription,
    hazmat: form.hazmat,
    ...(form.hazmat && form.hazmatClass.trim() !== ''
      ? { hazmatClass: form.hazmatClass }
      : {}),
    grossCargoWeight: weightInPounds(form.cargoWeightPounds),
    steerAxleWeight: weightInPounds(form.steerAxleWeightPounds),
    driveAxleWeight: weightInPounds(form.driveAxleWeightPounds),
    trailerAxleWeight: weightInPounds(form.trailerAxleWeightPounds),
    totalGrossCombinationWeight: weightInPounds(form.totalGrossWeightPounds),
    length: lengthInFeet(form.lengthFeet),
    height: lengthInFeet(form.heightFeet),
    width: lengthInFeet(form.widthFeet),
    permitRequirement: form.permitRequirement,
    permits: form.permitIdentifiers.map((identifierValue) => ({
      identifier: identifierValue,
      restrictions: [],
    })),
    escortRequirements: [],
    routeRestrictions: [],
    secureParkingRequirement: 'none',
    fieldEvidence: [],
    extensionMetadata: {},
  });
}

export function equipmentFromDraft(draft: TripDraft): EquipmentCombination {
  return {
    tractor: tractorFromForm(draft.tractor),
    trailer: trailerFromForm(draft.trailer),
    load: loadFromForm(draft.load),
  };
}

function appointment(stop: StopForm): Readonly<Record<string, unknown>> {
  switch (stop.appointmentMode) {
    case 'none':
      return { mode: 'none' };
    case 'earliest':
      return {
        mode: 'earliest',
        at: {
          localDateTime: localDateTime(stop.appointmentStartLocal),
          timeZone: stop.timeZone,
        },
      };
    case 'latest':
    case 'fixed':
      return {
        mode: stop.appointmentMode,
        at: {
          localDateTime: localDateTime(stop.appointmentStartLocal),
          timeZone: stop.timeZone,
        },
        lateTolerance: durationInMinutes(stop.lateToleranceMinutes),
      };
    case 'window':
    case 'open-window':
      return {
        mode: stop.appointmentMode,
        window: {
          start: {
            localDateTime: localDateTime(stop.appointmentStartLocal),
            timeZone: stop.timeZone,
          },
          end: {
            localDateTime: localDateTime(stop.appointmentEndLocal),
            timeZone: stop.timeZone,
          },
        },
        lateTolerance: durationInMinutes(stop.lateToleranceMinutes),
      };
  }
}

function serviceDuration(stop: StopForm): Readonly<Record<string, unknown>> {
  switch (stop.serviceMode) {
    case 'exact':
    case 'expected':
      return {
        mode: stop.serviceMode,
        duration: durationInMinutes(stop.serviceMinutes),
      };
    case 'range':
      return {
        mode: 'range',
        minimum: durationInMinutes(stop.serviceMinimumMinutes),
        expected: durationInMinutes(stop.serviceMinutes),
        maximum: durationInMinutes(stop.serviceMaximumMinutes),
      };
    case 'historical-average':
      return {
        mode: 'historical-average',
        duration: durationInMinutes(stop.serviceMinutes),
        sourceName: stop.historicalSourceName,
        ...(stop.historicalSampleSize === null
          ? {}
          : { sampleSize: stop.historicalSampleSize }),
      };
  }
}

function facilityHours(stop: StopForm): Readonly<Record<string, unknown>> {
  if (stop.facilityOpenLocal === '' || stop.facilityCloseLocal === '') {
    return { windows: [] };
  }
  return {
    windows: [
      {
        start: {
          localDateTime: localDateTime(stop.facilityOpenLocal),
          timeZone: stop.timeZone,
        },
        end: {
          localDateTime: localDateTime(stop.facilityCloseLocal),
          timeZone: stop.timeZone,
        },
      },
    ],
  };
}

export function stopPlan(stop: StopForm, sequence: number): TripStopPlan {
  return TripStopPlanSchema.parse({
    id: stop.publicId ?? stop.localId,
    sequence,
    type: stop.type,
    required: stop.required,
    lockedPosition: stop.lockedPosition,
    location: {
      description: stop.locationDescription,
      timeZone: stop.timeZone,
      ...(stop.addressText.trim() === '' ? {} : { addressText: stop.addressText }),
      ...(stop.latitude === null ? {} : { latitude: stop.latitude }),
      ...(stop.longitude === null ? {} : { longitude: stop.longitude }),
      resolutionStatus: 'user-confirmed',
      sourceName: 'TripRouteCalc Stage 18 setup UI',
    },
    appointment: appointment(stop),
    facilityHours: facilityHours(stop),
    checkInDuration: durationInMinutes(stop.checkInMinutes),
    serviceDuration: serviceDuration(stop),
    waitingDutyStatus: stop.waitingDutyStatus,
    checkInDutyStatus: stop.checkInDutyStatus,
    serviceDutyStatus: stop.serviceDutyStatus,
    earlyParkingAllowed: stop.earlyParkingAllowed,
    overnightParkingAllowed: stop.overnightParkingAllowed,
    ...(stop.notes.trim() === '' ? {} : { notes: stop.notes }),
    ...(stop.instructions.trim() === ''
      ? {}
      : { instructions: stop.instructions }),
  });
}

function recapReturnFromForm(
  form: CycleRecapReturnForm,
  timeZone: string,
): Readonly<Record<string, unknown>> {
  return {
    sourceDate: form.sourceDate,
    availableAt: localToInstant(form.availableLocal, timeZone),
    returnedTime: durationInMinutes(form.returnedMinutes),
  };
}

function sleeperPeriodFromForm(
  form: SleeperPeriodForm,
  timeZone: string,
): Readonly<Record<string, unknown>> {
  return {
    id: form.id,
    startAt: localToInstant(form.startLocal, timeZone),
    endAt: localToInstant(form.endLocal, timeZone),
    duration: durationInMinutes(form.durationMinutes),
    candidateRole: form.candidateRole,
    ...(form.pairId.trim() === '' ? {} : { pairId: form.pairId }),
    source: form.source,
    explanation: form.explanation,
  };
}

export function hosFromDraft(
  draft: TripDraft,
  driverId?: string,
): DriverHosDepartureState {
  const departureAt = localToInstant(
    draft.hos.departureLocal,
    draft.hos.departureTimeZone,
  );
  const currentDutyStatusStartedAt = localToInstant(
    draft.hos.currentDutyStatusStartedLocal,
    draft.hos.departureTimeZone,
  );
  return buildStage18HosDepartureState({
    ...(driverId === undefined ? {} : { driverId }),
    driverNameOrIdentifier: draft.driver.displayName,
    departureAt,
    departureTimeZone: draft.hos.departureTimeZone,
    currentDutyStatus: draft.hos.currentDutyStatus,
    currentDutyStatusStartedAt,
    drivingMinutesRemaining: draft.hos.drivingMinutesRemaining,
    shiftMinutesRemaining: draft.hos.shiftMinutesRemaining,
    cycleMinutesRemaining: draft.hos.cycleMinutesRemaining,
    cycleType: draft.hos.cycleType,
    drivenMinutesSinceLastQualifyingInterruption:
      draft.hos.drivenMinutesSinceInterruption,
    onDutyMinutesCurrentShift: draft.hos.onDutyMinutesCurrentShift,
    offDutyMinutesImmediatelyBeforeDeparture:
      draft.hos.offDutyMinutesBeforeDeparture,
    qualifyingTenHourBreakCompleted:
      draft.hos.qualifyingTenHourBreakCompleted,
    priorDutyMinutes: draft.hos.priorDutyMinutes,
    recapReturns: draft.hos.recapReturns.map((entry) =>
      recapReturnFromForm(entry, draft.hos.departureTimeZone),
    ),
    sleeperBerthEligible: draft.hos.sleeperBerthEligible,
    existingSleeperPeriods: draft.hos.existingSleeperPeriods.map((period) =>
      sleeperPeriodFromForm(period, draft.hos.departureTimeZone),
    ),
    splitSleeperEnabled: draft.hos.splitSleeperEnabled,
    restart34HourPlanned: draft.hos.restart34HourPlanned,
    carrierMaxDailyDrivingMinutes: draft.hos.carrierMaxDailyDrivingMinutes,
    carrierMaxDutyMinutes: draft.hos.carrierMaxDutyMinutes,
    ...(draft.hos.nightlyRestEnabled
      ? {
          nightlyRestPreference: {
            startLocalTime: draft.hos.nightlyRestStart,
            endLocalTime: draft.hos.nightlyRestEnd,
            timeZone: draft.hos.departureTimeZone,
          },
        }
      : {}),
  });
}

export function validateDraft(draft: TripDraft): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (draft.driver.displayName.trim() === '') {
    issues.push({
      severity: 'error',
      path: 'driver.displayName',
      message: 'Select or name the driver.',
    });
  }
  if (draft.tractor.unitNumber.trim() === '') {
    issues.push({ severity: 'error', path: 'tractor.unitNumber', message: 'Enter a tractor unit number.' });
  }
  if (draft.trailer.unitNumber.trim() === '') {
    issues.push({ severity: 'error', path: 'trailer.unitNumber', message: 'Enter a trailer number.' });
  }
  if (draft.load.referenceNumber.trim() === '') {
    issues.push({ severity: 'error', path: 'load.referenceNumber', message: 'Enter a load reference.' });
  }
  if (draft.load.commodityDescription.trim() === '') {
    issues.push({ severity: 'error', path: 'load.commodityDescription', message: 'Describe the commodity.' });
  }
  if (draft.route.ruleSetVersion.trim() === '') {
    issues.push({
      severity: 'error',
      path: 'route.ruleSetVersion',
      message: 'Enter the reviewed regulatory rule-set version.',
    });
  }
  if (draft.stops.length < 2) {
    issues.push({ severity: 'error', path: 'stops', message: 'A trip needs a start and final stop.' });
  }
  if (draft.stops[0]?.type !== 'start-location') {
    issues.push({ severity: 'error', path: 'stops.0.type', message: 'The first stop must remain the start location.' });
  }
  if (draft.stops.at(-1)?.type !== 'final-consignee') {
    issues.push({ severity: 'error', path: `stops.${String(Math.max(0, draft.stops.length - 1))}.type`, message: 'The final stop must remain the final consignee.' });
  }
  draft.stops.forEach((stop, index) => {
    const path = `stops.${String(index)}`;
    if (stop.locationDescription.trim() === '') {
      issues.push({ severity: 'error', path: `${path}.locationDescription`, message: `Stop ${String(index + 1)} needs a location.` });
    }
    if (stop.latitude === null || stop.longitude === null) {
      issues.push({ severity: 'error', path: `${path}.coordinates`, message: `Stop ${String(index + 1)} needs confirmed latitude and longitude for commercial routing.` });
    }
    try {
      stopPlan(stop, index + 1);
    } catch (error) {
      issues.push({
        severity: 'error',
        path,
        message: error instanceof Error ? error.message : 'Stop validation failed.',
      });
    }
  });
  try {
    hosFromDraft(draft, draft.driver.id);
  } catch (error) {
    issues.push({
      severity: 'error',
      path: 'hos',
      message: error instanceof Error ? error.message : 'HOS input validation failed.',
    });
  }
  try {
    const combination = equipmentFromDraft(draft);
    const validation = validateEquipmentCombination(combination);
    validation.issues.forEach((issue) => {
      issues.push({
        severity:
          issue.level === 'blocking-error'
            ? 'error'
            : issue.level === 'action-required-warning'
              ? 'warning'
              : 'information',
        path: issue.path,
        message: issue.message,
      });
    });
  } catch (error) {
    issues.push({
      severity: 'error',
      path: 'equipment',
      message: error instanceof Error ? error.message : 'Equipment validation failed.',
    });
  }
  if (draft.hos.adverseConditionSelected) {
    issues.push({
      severity: 'warning',
      path: 'hos.adverseConditionSelected',
      message:
        'Adverse-condition selection requires supporting evidence and is not activated automatically by the setup UI.',
    });
  }
  return issues;
}

export function commercialLocation(
  stop: StopForm,
  referenceId: string,
): ResolvedCommercialLocation {
  if (stop.latitude === null || stop.longitude === null) {
    throw new RangeError('Commercial route locations require coordinates.');
  }
  return {
    referenceId,
    description: stop.locationDescription,
    latitude: stop.latitude,
    longitude: stop.longitude,
    timeZone: stop.timeZone as ResolvedCommercialLocation['timeZone'],
    resolutionSource: 'user-confirmed',
    confidence: 'medium',
    unavailableFields: [],
  };
}

export function routeRequestFromDraft(
  draft: TripDraft,
  publicStops: readonly StopForm[],
): ReturnType<typeof buildStage18CommercialRouteRequest> {
  const first = publicStops[0];
  if (first === undefined || first.publicId === undefined) {
    throw new RangeError('The start stop must be persisted before routing.');
  }
  const avoidances = [
    ...(draft.route.avoidTolls ? (['tolls'] as const) : []),
    ...(draft.route.avoidFerries ? (['ferries'] as const) : []),
    ...(draft.route.avoidTunnels ? (['tunnels'] as const) : []),
  ];
  return buildStage18CommercialRouteRequest({
    requestId: identifier('route-request'),
    requestedAt: utcInstant(new Date().toISOString()),
    departureAt: localToInstant(
      draft.hos.departureLocal,
      draft.hos.departureTimeZone,
    ),
    equipment: equipmentFromDraft(draft),
    origin: commercialLocation(first, first.publicId),
    orderedStops: publicStops.slice(1).map((stop, index) => {
      if (stop.publicId === undefined) {
        throw new RangeError('Every route stop must be persisted before routing.');
      }
      return {
        stopId: stop.publicId,
        sequence: index + 1,
        required: stop.required,
        location: commercialLocation(stop, stop.publicId),
      };
    }),
    routePolicy: draft.route.policy,
    avoidances,
  });
}

export function simulationInputFromDraft(
  draft: TripDraft,
  driverId: string,
  route: NormalizedCommercialRouteResult,
): Omit<EtaSimulationInput, 'stops' | 'revisionReference'> {
  const segments = route.legs.flatMap((leg) => leg.segments);
  return {
    route,
    initialHosContext: {
      departureState: hosFromDraft(draft, driverId),
      dutyEvents: [],
    },
    speedModel: buildStage18SpeedModel({
      governedMph: draft.tractor.governedSpeedMph,
      planningMph: draft.tractor.planningSpeedMph,
      fallbackMph: draft.tractor.fallbackSpeedMph,
    }) as EtaSimulationInput['speedModel'],
    segmentConditions: segments.map((segment) => ({
      segmentId: segment.segmentId,
      roadClass: 'OTHER' as const,
      startTimeZone: draft.hos.departureTimeZone as EtaSimulationInput['segmentConditions'][number]['startTimeZone'],
      endTimeZone: draft.hos.departureTimeZone as EtaSimulationInput['segmentConditions'][number]['endTimeZone'],
      traffic: { status: 'UNAVAILABLE' as const, reason: 'No live traffic provider is configured.' },
      weather: { status: 'UNAVAILABLE' as const, reason: 'No live weather provider is configured.' },
      explanation: 'The setup UI supplies no live traffic or weather evidence.',
    })),
    operationalEvents: [],
    availableOperationalLocations: [],
    complianceActions: [],
    hosAvailabilityActions: [],
    homeTerminalTimeZone: draft.hos.departureTimeZone as EtaSimulationInput['homeTerminalTimeZone'],
  };
}

export function publicProfileFromUnknown<T>(
  value: unknown,
  schema: z.ZodType<T>,
): T {
  return schema.parse(value);
}

export const profileSchemas = {
  tractor: TractorProfileSchema,
  trailer: TrailerProfileSchema,
  load: LoadProfileSchema,
};
