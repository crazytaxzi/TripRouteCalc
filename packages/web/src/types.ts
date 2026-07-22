export type DutyStatus =
  | 'OFF_DUTY'
  | 'SLEEPER_BERTH'
  | 'DRIVING'
  | 'ON_DUTY_NOT_DRIVING';

export type DutyEventSource =
  | 'USER_ENTERED'
  | 'ELD_PROVIDER'
  | 'CARRIER_SYSTEM'
  | 'CALCULATED'
  | 'VERIFIED_RECORD';

export type SleeperCandidateRole = 'SHORT_PERIOD' | 'LONG_PERIOD';

export type CaliforniaComplianceStatus =
  | 'not-evaluated'
  | 'carrier-asserted-compliant'
  | 'carrier-asserted-noncompliant'
  | 'manual-verification-required';

export type SecureParkingRequirement =
  | 'none'
  | 'high-value'
  | 'secure-parking'
  | 'high-value-and-secure-parking';

export type StopType =
  | 'start-location'
  | 'tractor-pickup'
  | 'trailer-pickup'
  | 'shipper'
  | 'intermediate-pickup'
  | 'intermediate-delivery'
  | 'final-consignee'
  | 'fuel'
  | 'scale'
  | 'inspection'
  | 'maintenance'
  | 'food'
  | 'driver-break'
  | 'sleeper-rest'
  | 'terminal'
  | 'border-crossing'
  | 'other';

export type StopAppointmentMode =
  | 'none'
  | 'earliest'
  | 'latest'
  | 'fixed'
  | 'window'
  | 'open-window';

export type StopServiceMode =
  | 'exact'
  | 'expected'
  | 'range'
  | 'historical-average';

export interface DriverForm {
  readonly id?: string | undefined;
  readonly displayName: string;
}

export interface CycleRecapReturnForm {
  readonly localId: string;
  readonly sourceDate: string;
  readonly availableLocal: string;
  readonly returnedMinutes: number;
}

export interface SleeperPeriodForm {
  readonly id: string;
  readonly startLocal: string;
  readonly endLocal: string;
  readonly durationMinutes: number;
  readonly candidateRole: SleeperCandidateRole;
  readonly pairId: string;
  readonly source: DutyEventSource;
  readonly explanation: string;
}

export interface HosForm {
  readonly departureLocal: string;
  readonly departureTimeZone: string;
  readonly currentDutyStatus: DutyStatus;
  readonly currentDutyStatusStartedLocal: string;
  readonly drivingMinutesRemaining: number;
  readonly shiftMinutesRemaining: number;
  readonly cycleMinutesRemaining: number;
  readonly cycleType:
    | 'SIXTY_HOURS_SEVEN_DAYS'
    | 'SEVENTY_HOURS_EIGHT_DAYS';
  readonly drivenMinutesSinceInterruption: number;
  readonly onDutyMinutesCurrentShift: number;
  readonly offDutyMinutesBeforeDeparture: number;
  readonly qualifyingTenHourBreakCompleted: boolean;
  readonly priorDutyMinutes: readonly number[];
  readonly recapReturns: readonly CycleRecapReturnForm[];
  readonly sleeperBerthEligible: boolean;
  readonly existingSleeperPeriods: readonly SleeperPeriodForm[];
  readonly splitSleeperEnabled: boolean;
  readonly restart34HourPlanned: boolean;
  readonly adverseConditionSelected: boolean;
  readonly carrierMaxDailyDrivingMinutes: number;
  readonly carrierMaxDutyMinutes: number;
  readonly nightlyRestEnabled: boolean;
  readonly nightlyRestStart: string;
  readonly nightlyRestEnd: string;
}

export interface TractorForm {
  readonly id?: string | undefined;
  readonly unitNumber: string;
  readonly vin?: string | undefined;
  readonly tractorType: 'day-cab' | 'sleeper' | 'cabover' | 'other';
  readonly axleCount: number;
  readonly overallLengthFeet: number;
  readonly wheelbaseFeet?: number | undefined;
  readonly heightFeet: number;
  readonly widthInches: number;
  readonly emptyWeightPounds: number;
  readonly registeredGrossWeightPounds: number;
  readonly fuelCapacityGallons: number;
  readonly estimatedFuelRangeMiles: number;
  readonly governedSpeedMph: number;
  readonly planningSpeedMph: number;
  readonly fallbackSpeedMph: number;
  readonly hazmatEquipped: boolean;
  readonly californiaComplianceStatus?: CaliforniaComplianceStatus | undefined;
  readonly californiaComplianceSourceName?: string | undefined;
  readonly californiaComplianceVerifiedAt?: string | undefined;
  readonly californiaComplianceExplanation?: string | undefined;
  readonly apuAvailable: boolean;
  readonly idleAllowed: boolean;
  readonly notes?: string | undefined;
}

export interface TrailerRailPositionMappingForm {
  readonly localId: string;
  readonly railPosition: string;
  readonly kpraFeet: number;
  readonly verificationSource: string;
  readonly verifiedAt: string;
  readonly explanation: string;
}

export interface TrailerForm {
  readonly id?: string | undefined;
  readonly unitNumber: string;
  readonly trailerType:
    | 'dry-van'
    | 'refrigerated'
    | 'flatbed'
    | 'similar-general-freight';
  readonly axleCount: number;
  readonly axleConfiguration: 'fixed' | 'sliding';
  readonly slidingTandemCapability: boolean;
  readonly lengthFeet: number;
  readonly heightFeet: number;
  readonly widthInches: number;
  readonly currentKpraFeet: number;
  readonly minimumKpraFeet: number;
  readonly maximumKpraFeet: number;
  readonly currentRailPosition?: string | undefined;
  readonly railPositionMappings?: readonly TrailerRailPositionMappingForm[] | undefined;
  readonly emptyWeightPounds: number;
  readonly maximumPayloadPounds: number;
  readonly reefer: boolean;
  readonly liftgate?: boolean | undefined;
  readonly specialEquipment?: readonly string[] | undefined;
  readonly notes?: string | undefined;
}

export interface LoadPermitForm {
  readonly localId: string;
  readonly identifier: string;
  readonly jurisdictionCode: string;
  readonly restrictions: readonly string[];
}

export interface LoadForm {
  readonly id?: string | undefined;
  readonly referenceNumber: string;
  readonly commodityDescription: string;
  readonly hazmat: boolean;
  readonly hazmatClass: string;
  readonly cargoWeightPounds: number;
  readonly steerAxleWeightPounds: number;
  readonly driveAxleWeightPounds: number;
  readonly trailerAxleWeightPounds: number;
  readonly totalGrossWeightPounds: number;
  readonly lengthFeet: number;
  readonly heightFeet: number;
  readonly widthFeet: number;
  readonly frontOverhangFeet?: number | undefined;
  readonly rearOverhangFeet?: number | undefined;
  readonly temperatureReeferRequired?: boolean | undefined;
  readonly temperatureMinimumFahrenheit?: number | null | undefined;
  readonly temperatureMaximumFahrenheit?: number | null | undefined;
  readonly temperatureSetPointFahrenheit?: number | null | undefined;
  readonly temperatureExplanation?: string | undefined;
  readonly permitRequirement: 'not-required' | 'required' | 'unknown';
  readonly permitIdentifiers: readonly string[];
  readonly permits?: readonly LoadPermitForm[] | undefined;
  readonly escortRequirements?: readonly string[] | undefined;
  readonly routeRestrictions?: readonly string[] | undefined;
  readonly secureParkingRequirement?: SecureParkingRequirement | undefined;
  readonly notes?: string | undefined;
}

export interface StopForm {
  readonly localId: string;
  readonly publicId?: string | undefined;
  readonly type: StopType;
  readonly required: boolean;
  readonly lockedPosition: boolean;
  readonly locationDescription: string;
  readonly addressText: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly timeZone: string;
  readonly appointmentMode: StopAppointmentMode;
  readonly appointmentStartLocal: string;
  readonly appointmentEndLocal: string;
  readonly lateToleranceMinutes: number;
  readonly facilityOpenLocal: string;
  readonly facilityCloseLocal: string;
  readonly checkInMinutes: number;
  readonly serviceMode: StopServiceMode;
  readonly serviceMinutes: number;
  readonly serviceMinimumMinutes: number;
  readonly serviceMaximumMinutes: number;
  readonly historicalSourceName: string;
  readonly historicalSampleSize: number | null;
  readonly waitingDutyStatus: DutyStatus;
  readonly checkInDutyStatus: DutyStatus;
  readonly serviceDutyStatus: DutyStatus;
  readonly earlyParkingAllowed: boolean;
  readonly overnightParkingAllowed: boolean;
  readonly notes: string;
  readonly instructions: string;
}

export interface RouteForm {
  readonly ruleSetVersion: string;
  readonly policy:
    | 'fastest-compliant'
    | 'shortest-compliant'
    | 'balanced-compliant';
  readonly avoidTolls: boolean;
  readonly avoidFerries: boolean;
  readonly avoidTunnels: boolean;
  readonly autoCalculate: boolean;
}

export interface TripDraft {
  readonly version: 2;
  readonly draftId: string;
  readonly tripId?: string | undefined;
  readonly apiBaseUrl: string;
  readonly driver: DriverForm;
  readonly hos: HosForm;
  readonly tractor: TractorForm;
  readonly trailer: TrailerForm;
  readonly load: LoadForm;
  readonly stops: readonly StopForm[];
  readonly route: RouteForm;
  readonly savedAt?: string | undefined;
}

export interface ValidationIssue {
  readonly severity: 'error' | 'warning' | 'information';
  readonly path: string;
  readonly message: string;
}

export interface ProfileOption {
  readonly id: string;
  readonly label: string;
  readonly profile?: unknown;
}

export interface ProfileLists {
  readonly drivers: readonly ProfileOption[];
  readonly tractors: readonly ProfileOption[];
  readonly trailers: readonly ProfileOption[];
  readonly loads: readonly ProfileOption[];
}

export interface PlanningOutcome {
  readonly status: 'idle' | 'submitting' | 'complete' | 'blocked' | 'failed';
  readonly message: string;
  readonly tripId?: string | undefined;
  readonly revisionNumber?: number | undefined;
  readonly confidence?: string | undefined;
  readonly warnings: readonly string[];
}
