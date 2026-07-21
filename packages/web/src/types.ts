export type DutyStatus =
  | 'OFF_DUTY'
  | 'SLEEPER_BERTH'
  | 'DRIVING'
  | 'ON_DUTY_NOT_DRIVING';

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
  readonly sleeperBerthEligible: boolean;
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
  readonly tractorType: 'day-cab' | 'sleeper' | 'cabover' | 'other';
  readonly axleCount: number;
  readonly overallLengthFeet: number;
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
  readonly apuAvailable: boolean;
  readonly idleAllowed: boolean;
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
  readonly emptyWeightPounds: number;
  readonly maximumPayloadPounds: number;
  readonly reefer: boolean;
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
  readonly permitRequirement: 'not-required' | 'required' | 'unknown';
  readonly permitIdentifiers: readonly string[];
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
