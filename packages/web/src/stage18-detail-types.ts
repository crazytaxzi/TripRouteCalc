import type { DutyStatus, TripStopDraft } from './model.js';

export const STAGE18_DETAILS_STORAGE_KEY =
  'trip-route-calc-stage18-complete-facts-v1';

export type EquipmentEvidenceSource =
  | 'measured'
  | 'manufacturer-rated'
  | 'carrier-configured'
  | 'user-estimated';

export type RoutePolicy =
  | 'fastest-compliant'
  | 'shortest-compliant'
  | 'balanced-compliant';

export type RouteAvoidance =
  | 'tolls'
  | 'ferries'
  | 'tunnels'
  | 'uncontrolled-border-crossings'
  | 'unpaved-roads'
  | 'seasonal-roads'
  | 'hazmat-restricted-roads'
  | 'permit-only-roads';

export type CompleteAppointmentMode =
  | 'none'
  | 'earliest'
  | 'latest'
  | 'fixed'
  | 'window'
  | 'open-window';

export type CompleteServiceMode =
  | 'exact'
  | 'expected'
  | 'range'
  | 'historical-average';

export interface DriverProfileFacts {
  readonly id?: string | undefined;
  readonly displayName: string;
  readonly dirty: boolean;
}

export interface EvidenceFacts {
  readonly sourceType: EquipmentEvidenceSource | '';
  readonly sourceName: string;
}

export interface TractorProfileFacts extends EvidenceFacts {
  readonly id?: string | undefined;
  readonly dirty: boolean;
  readonly unitNumber: string;
  readonly vin: string;
  readonly tractorType: 'day-cab' | 'sleeper' | 'cabover' | 'other';
  readonly axleCount: number;
  readonly overallLengthFeet: number;
  readonly wheelbaseFeet: number;
  readonly heightFeet: number;
  readonly widthInches: number;
  readonly emptyWeightPounds: number;
  readonly grossVehicleWeightRatingPounds: number;
  readonly registeredGrossWeightPounds: number;
  readonly fuelCapacityGallons: number;
  readonly estimatedFuelRangeMiles: number;
  readonly governedSpeedMph: number;
  readonly planningCruiseSpeedMph: number;
  readonly hazmatEquipped: boolean;
  readonly californiaComplianceStatus:
    | 'not-evaluated'
    | 'carrier-asserted-compliant'
    | 'carrier-asserted-noncompliant'
    | 'manual-verification-required';
  readonly californiaComplianceSource: string;
  readonly californiaComplianceVerifiedAt: string;
  readonly californiaComplianceExplanation: string;
  readonly idleAllowed: boolean;
  readonly auxiliaryPowerUnitAvailable: boolean;
  readonly notes: string;
}

export interface TrailerProfileFacts extends EvidenceFacts {
  readonly id?: string | undefined;
  readonly dirty: boolean;
  readonly trailerNumber: string;
  readonly trailerType:
    | 'dry-van'
    | 'refrigerated'
    | 'flatbed'
    | 'similar-general-freight';
  readonly lengthFeet: number;
  readonly widthInches: number;
  readonly heightFeet: number;
  readonly axleCount: number;
  readonly slidingTandemCapability: boolean;
  readonly axleConfiguration: 'fixed' | 'sliding';
  readonly currentKpraFeet: number;
  readonly minimumKpraFeet: number;
  readonly maximumKpraFeet: number;
  readonly currentRailPosition: string;
  readonly railPositionMappingsText: string;
  readonly emptyWeightPounds: number;
  readonly grossVehicleWeightRatingPounds: number;
  readonly maximumPayloadPounds: number;
  readonly reefer: boolean;
  readonly liftgate: boolean;
  readonly specialEquipmentText: string;
  readonly notes: string;
}

export interface LoadProfileFacts extends EvidenceFacts {
  readonly id?: string | undefined;
  readonly dirty: boolean;
  readonly loadIdentifier: string;
  readonly commodity: string;
  readonly hazmat: boolean;
  readonly hazmatClass: string;
  readonly grossCargoWeightPounds: number;
  readonly steerAxleWeightPounds: number;
  readonly driveAxleWeightPounds: number;
  readonly trailerAxleWeightPounds: number;
  readonly totalGrossCombinationWeightPounds: number;
  readonly lengthFeet: number;
  readonly widthFeet: number;
  readonly heightFeet: number;
  readonly frontOverhangFeet: number;
  readonly rearOverhangFeet: number;
  readonly reeferRequired: boolean;
  readonly minimumTemperatureFahrenheit: number | null;
  readonly maximumTemperatureFahrenheit: number | null;
  readonly setPointTemperatureFahrenheit: number | null;
  readonly temperatureExplanation: string;
  readonly permitRequirement: 'not-required' | 'required' | 'unknown';
  readonly permitsText: string;
  readonly escortRequirementsText: string;
  readonly routeRestrictionsText: string;
  readonly secureParkingRequirement:
    | 'none'
    | 'high-value'
    | 'secure-parking'
    | 'high-value-and-secure-parking';
  readonly notes: string;
}

export interface StopPlanningFacts {
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly resolutionStatus: '' | 'resolved' | 'user-confirmed';
  readonly sourceName: string;
  readonly providerReference: string;
  readonly appointmentMode: CompleteAppointmentMode;
  readonly appointmentAt: string;
  readonly appointmentStartAt: string;
  readonly appointmentEndAt: string;
  readonly lateToleranceMinutes: number;
  readonly facilityHoursText: string;
  readonly checkInMinutes: number;
  readonly waitingDutyStatus: DutyStatus;
  readonly checkInDutyStatus: DutyStatus;
  readonly serviceDutyStatus: DutyStatus;
  readonly serviceMode: CompleteServiceMode;
  readonly serviceMinutes: number;
  readonly serviceMinimumMinutes: number;
  readonly serviceExpectedMinutes: number;
  readonly serviceMaximumMinutes: number;
  readonly historicalSourceName: string;
  readonly historicalSampleSize: number | null;
  readonly earlyParkingAllowed: boolean;
  readonly overnightParkingAllowed: boolean;
  readonly instructions: string;
}

export interface Stage18CompleteFacts {
  readonly version: 1;
  readonly driver: DriverProfileFacts;
  readonly tractor: TractorProfileFacts;
  readonly trailer: TrailerProfileFacts;
  readonly load: LoadProfileFacts;
  readonly route: Readonly<{
    policy: RoutePolicy | '';
    avoidances: readonly RouteAvoidance[];
  }>;
  readonly stops: Readonly<Record<string, StopPlanningFacts>>;
}

function defaultDriver(): DriverProfileFacts {
  return { displayName: '', dirty: false };
}

export function defaultTractor(): TractorProfileFacts {
  return {
    dirty: true,
    unitNumber: '',
    vin: '',
    tractorType: 'sleeper',
    axleCount: 3,
    overallLengthFeet: 0,
    wheelbaseFeet: 0,
    heightFeet: 0,
    widthInches: 0,
    emptyWeightPounds: 0,
    grossVehicleWeightRatingPounds: 0,
    registeredGrossWeightPounds: 0,
    fuelCapacityGallons: 0,
    estimatedFuelRangeMiles: 0,
    governedSpeedMph: 0,
    planningCruiseSpeedMph: 0,
    hazmatEquipped: false,
    californiaComplianceStatus: 'not-evaluated',
    californiaComplianceSource: '',
    californiaComplianceVerifiedAt: '',
    californiaComplianceExplanation: '',
    idleAllowed: false,
    auxiliaryPowerUnitAvailable: false,
    notes: '',
    sourceType: '',
    sourceName: '',
  };
}

export function defaultTrailer(): TrailerProfileFacts {
  return {
    dirty: true,
    trailerNumber: '',
    trailerType: 'dry-van',
    lengthFeet: 0,
    widthInches: 0,
    heightFeet: 0,
    axleCount: 2,
    slidingTandemCapability: true,
    axleConfiguration: 'sliding',
    currentKpraFeet: 0,
    minimumKpraFeet: 0,
    maximumKpraFeet: 0,
    currentRailPosition: '',
    railPositionMappingsText: '',
    emptyWeightPounds: 0,
    grossVehicleWeightRatingPounds: 0,
    maximumPayloadPounds: 0,
    reefer: false,
    liftgate: false,
    specialEquipmentText: '',
    notes: '',
    sourceType: '',
    sourceName: '',
  };
}

export function defaultLoad(): LoadProfileFacts {
  return {
    dirty: true,
    loadIdentifier: '',
    commodity: '',
    hazmat: false,
    hazmatClass: '',
    grossCargoWeightPounds: 0,
    steerAxleWeightPounds: 0,
    driveAxleWeightPounds: 0,
    trailerAxleWeightPounds: 0,
    totalGrossCombinationWeightPounds: 0,
    lengthFeet: 0,
    widthFeet: 0,
    heightFeet: 0,
    frontOverhangFeet: 0,
    rearOverhangFeet: 0,
    reeferRequired: false,
    minimumTemperatureFahrenheit: null,
    maximumTemperatureFahrenheit: null,
    setPointTemperatureFahrenheit: null,
    temperatureExplanation: '',
    permitRequirement: 'unknown',
    permitsText: '',
    escortRequirementsText: '',
    routeRestrictionsText: '',
    secureParkingRequirement: 'none',
    notes: '',
    sourceType: '',
    sourceName: '',
  };
}

export function defaultStopPlanningFacts(
  stop?: Pick<TripStopDraft, 'appointment' | 'service'>,
): StopPlanningFacts {
  const appointmentMode = stop?.appointment.mode ?? 'none';
  const serviceMode = stop?.service.mode ?? 'expected';
  return {
    latitude: null,
    longitude: null,
    resolutionStatus: '',
    sourceName: '',
    providerReference: '',
    appointmentMode,
    appointmentAt: stop?.appointment.fixedAt ?? '',
    appointmentStartAt: stop?.appointment.earliestAt ?? '',
    appointmentEndAt: stop?.appointment.latestAt ?? '',
    lateToleranceMinutes: stop?.appointment.lateToleranceMinutes ?? 0,
    facilityHoursText: '',
    checkInMinutes: 0,
    waitingDutyStatus: stop?.service.dutyStatus ?? 'on_duty_not_driving',
    checkInDutyStatus: 'on_duty_not_driving',
    serviceDutyStatus: stop?.service.dutyStatus ?? 'on_duty_not_driving',
    serviceMode,
    serviceMinutes:
      stop?.service.exactMinutes ?? stop?.service.expectedMinutes ?? 0,
    serviceMinimumMinutes: stop?.service.minimumMinutes ?? 0,
    serviceExpectedMinutes: stop?.service.expectedMinutes ?? 0,
    serviceMaximumMinutes: stop?.service.maximumMinutes ?? 0,
    historicalSourceName: '',
    historicalSampleSize: null,
    earlyParkingAllowed: stop?.appointment.earlyParkingAllowed ?? false,
    overnightParkingAllowed: stop?.appointment.overnightParkingAllowed ?? false,
    instructions: '',
  };
}

export function createStage18CompleteFacts(): Stage18CompleteFacts {
  return {
    version: 1,
    driver: defaultDriver(),
    tractor: defaultTractor(),
    trailer: defaultTrailer(),
    load: defaultLoad(),
    route: { policy: '', avoidances: [] },
    stops: {},
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && !Array.isArray(value) && typeof value === 'object';
}

function mergeStop(value: unknown): StopPlanningFacts {
  const initial = defaultStopPlanningFacts();
  return isRecord(value) ? { ...initial, ...value } : initial;
}

export function restoreStage18CompleteFacts(
  serialized: string | null,
): Stage18CompleteFacts {
  const initial = createStage18CompleteFacts();
  if (serialized === null || serialized.trim() === '') return initial;
  try {
    const value: unknown = JSON.parse(serialized);
    if (!isRecord(value)) return initial;
    const stopsValue = isRecord(value.stops) ? value.stops : {};
    const stops = Object.fromEntries(
      Object.entries(stopsValue).map(([id, stop]) => [id, mergeStop(stop)]),
    );
    return {
      version: 1,
      driver: isRecord(value.driver)
        ? { ...initial.driver, ...value.driver }
        : initial.driver,
      tractor: isRecord(value.tractor)
        ? { ...initial.tractor, ...value.tractor }
        : initial.tractor,
      trailer: isRecord(value.trailer)
        ? { ...initial.trailer, ...value.trailer }
        : initial.trailer,
      load: isRecord(value.load)
        ? { ...initial.load, ...value.load }
        : initial.load,
      route: isRecord(value.route)
        ? { ...initial.route, ...value.route }
        : initial.route,
      stops,
    };
  } catch {
    return initial;
  }
}

let currentFacts: Stage18CompleteFacts | undefined;

export function loadStage18CompleteFacts(): Stage18CompleteFacts {
  currentFacts ??= restoreStage18CompleteFacts(
    typeof localStorage === 'undefined'
      ? null
      : localStorage.getItem(STAGE18_DETAILS_STORAGE_KEY),
  );
  return currentFacts;
}

export function saveStage18CompleteFacts(facts: Stage18CompleteFacts): void {
  currentFacts = facts;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STAGE18_DETAILS_STORAGE_KEY, JSON.stringify(facts));
  }
}

export function updateStage18CompleteFacts(
  update: (facts: Stage18CompleteFacts) => Stage18CompleteFacts,
): Stage18CompleteFacts {
  const next = update(loadStage18CompleteFacts());
  saveStage18CompleteFacts(next);
  return next;
}

export function ensureStopPlanningFacts(
  localId: string,
  stop?: Pick<TripStopDraft, 'appointment' | 'service'>,
): StopPlanningFacts {
  const facts = loadStage18CompleteFacts();
  const existing = facts.stops[localId];
  if (existing !== undefined) return existing;
  const created = defaultStopPlanningFacts(stop);
  saveStage18CompleteFacts({
    ...facts,
    stops: { ...facts.stops, [localId]: created },
  });
  return created;
}

