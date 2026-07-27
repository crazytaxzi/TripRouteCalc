export interface ClockInputs {
  readonly driveMinutesRemaining: number;
  readonly shiftMinutesRemaining: number;
  readonly cycleMinutesRemaining: number;
}

export type AppointmentMode = 'none' | 'fixed' | 'window';
export type ServiceMode = 'exact' | 'expected' | 'range';
export type DutyStatus =
  | 'off_duty'
  | 'sleeper_berth'
  | 'driving'
  | 'on_duty_not_driving';
export type CycleType = '70_in_8' | '60_in_7' | '';
export type FactProvenance =
  | 'user_entered'
  | 'imported_eld'
  | 'carrier_record'
  | '';

export interface DailyDutyTotal {
  readonly date: string;
  readonly onDutyMinutes: number;
}

export interface CycleRecap {
  readonly availableAt: string;
  readonly minutesReturning: number;
}

export interface SleeperPeriod {
  readonly startAt: string;
  readonly endAt: string;
}

export interface RestPreference {
  readonly enabled: boolean;
  readonly startLocalTime: string;
  readonly endLocalTime: string;
}

export interface DriverHosInputs {
  readonly cycleType: CycleType;
  readonly drivenSinceQualifyingInterruptionMinutes: number;
  readonly onDutyCurrentShiftMinutes: number;
  readonly offDutyBeforeDepartureMinutes: number;
  readonly qualifyingTenHourBreakCompleted: boolean;
  readonly priorDutyTotals: readonly DailyDutyTotal[];
  readonly cycleRecaps: readonly CycleRecap[];
  readonly sleeperBerthEligible: boolean;
  readonly existingSleeperPeriods: readonly SleeperPeriod[];
  readonly splitSleeperEnabled: boolean;
  readonly plannedThirtyFourHourRestart: boolean;
  readonly carrierMaximumDrivingMinutes: number;
  readonly carrierMaximumDutyMinutes: number;
  readonly restPreference: RestPreference;
  readonly provenance: FactProvenance;
}

export const STOP_TYPES = [
  'start_location',
  'tractor_pickup',
  'trailer_pickup',
  'shipper',
  'intermediate_pickup',
  'intermediate_delivery',
  'final_consignee',
  'fuel',
  'scale',
  'inspection',
  'maintenance',
  'food',
  'driver_break',
  'sleeper_rest',
  'terminal',
  'border_crossing',
  'other',
] as const;
export type StopType = (typeof STOP_TYPES)[number];

export interface AppointmentSettings {
  readonly mode: AppointmentMode;
  readonly timeZone: string;
  readonly fixedAt?: string | undefined;
  readonly earliestAt?: string | undefined;
  readonly latestAt?: string | undefined;
  readonly lateToleranceMinutes: number;
  readonly earlyParkingAllowed: boolean;
  readonly overnightParkingAllowed: boolean;
}

export interface ServiceSettings {
  readonly mode: ServiceMode;
  readonly exactMinutes?: number | undefined;
  readonly expectedMinutes?: number | undefined;
  readonly minimumMinutes?: number | undefined;
  readonly maximumMinutes?: number | undefined;
  readonly dutyStatus: DutyStatus;
}

export interface TripStopDraft {
  readonly localId: string;
  readonly serverId?: string | undefined;
  readonly sequence: number;
  readonly type: StopType;
  readonly label: string;
  readonly address: string;
  readonly required: boolean;
  readonly lockedPosition: boolean;
  readonly appointment: AppointmentSettings;
  readonly service: ServiceSettings;
  readonly notes: string;
}

export interface ProfileSelection {
  readonly selectedId: string;
  readonly displayName: string;
}

export interface TripSetupState {
  readonly tripId?: string | undefined;
  readonly revisionNumber: number;
  readonly driver: ProfileSelection;
  readonly tractor: ProfileSelection;
  readonly trailer: ProfileSelection;
  readonly load: ProfileSelection;
  readonly departureAt: string;
  readonly departureTimeZone: string;
  readonly currentDutyStatus: DutyStatus | '';
  readonly currentDutyStatusBeganAt: string;
  readonly clocks: ClockInputs;
  readonly hos: DriverHosInputs;
  readonly stops: readonly TripStopDraft[];
  readonly deletedServerStopIds: readonly string[];
  readonly autoRecalculate: boolean;
  readonly dirty: boolean;
  readonly calculationPending: boolean;
  readonly lastCalculationAt?: string | undefined;
  readonly lastError?: string | undefined;
}

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

let nextLocalStopId = 1;

function defaultHosInputs(): DriverHosInputs {
  return {
    cycleType: '',
    drivenSinceQualifyingInterruptionMinutes: 0,
    onDutyCurrentShiftMinutes: 0,
    offDutyBeforeDepartureMinutes: 0,
    qualifyingTenHourBreakCompleted: false,
    priorDutyTotals: [],
    cycleRecaps: [],
    sleeperBerthEligible: false,
    existingSleeperPeriods: [],
    splitSleeperEnabled: false,
    plannedThirtyFourHourRestart: false,
    carrierMaximumDrivingMinutes: 660,
    carrierMaximumDutyMinutes: 840,
    restPreference: {
      enabled: false,
      startLocalTime: '',
      endLocalTime: '',
    },
    provenance: '',
  };
}

function defaultServiceMinutes(type: StopType): number {
  if (type === 'fuel') return 30;
  if (type === 'scale') return 15;
  if (type === 'start_location') return 30;
  return 60;
}

export function createStop(type: StopType, sequence: number): TripStopDraft {
  return {
    localId: `local-stop-${String(nextLocalStopId++)}`,
    sequence,
    type,
    label: '',
    address: '',
    required: true,
    lockedPosition: type === 'start_location' || type === 'final_consignee',
    appointment: {
      mode: 'none',
      timeZone: 'America/Boise',
      lateToleranceMinutes: 0,
      earlyParkingAllowed: false,
      overnightParkingAllowed: false,
    },
    service: {
      mode: 'expected',
      expectedMinutes: defaultServiceMinutes(type),
      dutyStatus: 'on_duty_not_driving',
    },
    notes: '',
  };
}

export function createInitialTripSetupState(): TripSetupState {
  return {
    revisionNumber: 0,
    driver: { selectedId: '', displayName: '' },
    tractor: { selectedId: '', displayName: '' },
    trailer: { selectedId: '', displayName: '' },
    load: { selectedId: '', displayName: '' },
    departureAt: '',
    departureTimeZone: 'America/Boise',
    currentDutyStatus: '',
    currentDutyStatusBeganAt: '',
    clocks: {
      driveMinutesRemaining: 0,
      shiftMinutesRemaining: 0,
      cycleMinutesRemaining: 0,
    },
    hos: defaultHosInputs(),
    stops: [
      createStop('start_location', 0),
      createStop('shipper', 1),
      createStop('final_consignee', 2),
    ],
    deletedServerStopIds: [],
    autoRecalculate: false,
    dirty: false,
    calculationPending: false,
  };
}

function resequence(stops: readonly TripStopDraft[]): readonly TripStopDraft[] {
  return stops.map((stop, sequence): TripStopDraft => ({ ...stop, sequence }));
}

export function insertStop(
  state: TripSetupState,
  index: number,
  type: StopType = 'other',
): TripSetupState {
  const boundedIndex = Math.max(0, Math.min(index, state.stops.length));
  const stops = [...state.stops];
  stops.splice(boundedIndex, 0, createStop(type, boundedIndex));
  return { ...state, stops: resequence(stops), dirty: true };
}

export function duplicateStop(
  state: TripSetupState,
  localId: string,
): TripSetupState {
  const index = state.stops.findIndex((stop): boolean => stop.localId === localId);
  const source = state.stops[index];
  if (index < 0 || source === undefined) return state;
  const copy: TripStopDraft = {
    ...source,
    localId: `local-stop-${String(nextLocalStopId++)}`,
    serverId: undefined,
    lockedPosition: false,
    label: source.label === '' ? '' : `${source.label} copy`,
  };
  const stops = [...state.stops];
  stops.splice(index + 1, 0, copy);
  return { ...state, stops: resequence(stops), dirty: true };
}

export function removeStop(state: TripSetupState, localId: string): TripSetupState {
  const stop = state.stops.find((candidate): boolean => candidate.localId === localId);
  if (stop === undefined || stop.lockedPosition) return state;
  const deletedServerStopIds =
    stop.serverId === undefined || state.deletedServerStopIds.includes(stop.serverId)
      ? state.deletedServerStopIds
      : [...state.deletedServerStopIds, stop.serverId];
  return {
    ...state,
    stops: resequence(
      state.stops.filter((candidate): boolean => candidate.localId !== localId),
    ),
    deletedServerStopIds,
    dirty: true,
  };
}

export function moveStop(
  state: TripSetupState,
  localId: string,
  direction: -1 | 1,
): TripSetupState {
  const from = state.stops.findIndex((stop): boolean => stop.localId === localId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= state.stops.length) return state;
  const current = state.stops[from];
  const target = state.stops[to];
  if (
    current === undefined ||
    target === undefined ||
    current.lockedPosition ||
    target.lockedPosition
  ) {
    return state;
  }
  const stops = [...state.stops];
  stops[from] = target;
  stops[to] = current;
  return { ...state, stops: resequence(stops), dirty: true };
}

export function updateStop(
  state: TripSetupState,
  localId: string,
  patch: Partial<Omit<TripStopDraft, 'localId' | 'sequence'>>,
): TripSetupState {
  return {
    ...state,
    dirty: true,
    stops: state.stops.map((stop): TripStopDraft =>
      stop.localId === localId ? { ...stop, ...patch } : stop,
    ),
  };
}

function issue(path: string, message: string): ValidationIssue {
  return { path, message, severity: 'error' };
}

function validateNonnegativeMinutes(
  issues: ValidationIssue[],
  path: string,
  value: number,
): void {
  if (!Number.isFinite(value) || value < 0) {
    issues.push(issue(path, 'Enter a nonnegative duration in minutes.'));
  }
}

function validatePriorDutyTotals(
  hos: DriverHosInputs,
  issues: ValidationIssue[],
): void {
  const expectedPriorDays = hos.cycleType === '60_in_7' ? 6 : 7;
  if (hos.cycleType !== '' && hos.priorDutyTotals.length !== expectedPriorDays) {
    issues.push(
      issue(
        'hos.priorDutyTotals',
        `Enter ${String(expectedPriorDays)} prior daily on-duty totals for the selected cycle.`,
      ),
    );
  }
  hos.priorDutyTotals.forEach((day, index): void => {
    if (day.date === '') {
      issues.push(
        issue(`hos.priorDutyTotals.${String(index)}.date`, 'Enter the duty-total date.'),
      );
    }
    validateNonnegativeMinutes(
      issues,
      `hos.priorDutyTotals.${String(index)}.onDutyMinutes`,
      day.onDutyMinutes,
    );
  });
}

function validateHos(state: TripSetupState): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { hos } = state;
  if (hos.cycleType === '') {
    issues.push(
      issue('hos.cycleType', 'Choose the 60-hour/7-day or 70-hour/8-day cycle.'),
    );
  }
  if (hos.provenance === '') {
    issues.push(
      issue(
        'hos.provenance',
        'Identify whether the HOS facts were user-entered or imported.',
      ),
    );
  }
  const minuteFields: readonly [string, number][] = [
    [
      'hos.drivenSinceQualifyingInterruptionMinutes',
      hos.drivenSinceQualifyingInterruptionMinutes,
    ],
    ['hos.onDutyCurrentShiftMinutes', hos.onDutyCurrentShiftMinutes],
    ['hos.offDutyBeforeDepartureMinutes', hos.offDutyBeforeDepartureMinutes],
    ['hos.carrierMaximumDrivingMinutes', hos.carrierMaximumDrivingMinutes],
    ['hos.carrierMaximumDutyMinutes', hos.carrierMaximumDutyMinutes],
  ];
  minuteFields.forEach(([path, value]): void => {
    validateNonnegativeMinutes(issues, path, value);
  });
  if (hos.carrierMaximumDrivingMinutes === 0) {
    issues.push(
      issue(
        'hos.carrierMaximumDrivingMinutes',
        'Carrier maximum driving time must be greater than zero.',
      ),
    );
  }
  if (hos.carrierMaximumDutyMinutes === 0) {
    issues.push(
      issue(
        'hos.carrierMaximumDutyMinutes',
        'Carrier maximum duty time must be greater than zero.',
      ),
    );
  }
  if (hos.carrierMaximumDrivingMinutes > hos.carrierMaximumDutyMinutes) {
    issues.push(
      issue(
        'hos.carrierMaximumDrivingMinutes',
        'Carrier driving target cannot exceed the carrier duty target.',
      ),
    );
  }
  validatePriorDutyTotals(hos, issues);
  hos.cycleRecaps.forEach((recap, index): void => {
    if (recap.availableAt === '') {
      issues.push(
        issue(
          `hos.cycleRecaps.${String(index)}.availableAt`,
          'Enter when recap hours return.',
        ),
      );
    }
    validateNonnegativeMinutes(
      issues,
      `hos.cycleRecaps.${String(index)}.minutesReturning`,
      recap.minutesReturning,
    );
  });
  if (hos.splitSleeperEnabled && !hos.sleeperBerthEligible) {
    issues.push(
      issue(
        'hos.splitSleeperEnabled',
        'Split sleeper cannot be enabled when the driver is not eligible.',
      ),
    );
  }
  hos.existingSleeperPeriods.forEach((period, index): void => {
    if (period.startAt === '' || period.endAt === '') {
      issues.push(
        issue(
          `hos.existingSleeperPeriods.${String(index)}`,
          'Enter both the start and end of each sleeper period.',
        ),
      );
      return;
    }
    if (Date.parse(period.endAt) <= Date.parse(period.startAt)) {
      issues.push(
        issue(
          `hos.existingSleeperPeriods.${String(index)}.endAt`,
          'Sleeper period end must be after its start.',
        ),
      );
    }
  });
  if (
    hos.restPreference.enabled &&
    (hos.restPreference.startLocalTime === '' ||
      hos.restPreference.endLocalTime === '')
  ) {
    issues.push(
      issue(
        'hos.restPreference',
        'Enter both preferred nightly rest times or disable the preference.',
      ),
    );
  }
  return issues;
}

function validateService(stop: TripStopDraft): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (
    stop.service.mode === 'exact' &&
    (!Number.isFinite(stop.service.exactMinutes) ||
      (stop.service.exactMinutes ?? -1) < 0)
  ) {
    issues.push(
      issue(
        `stops.${String(stop.sequence)}.service.exactMinutes`,
        'Enter an exact service duration.',
      ),
    );
  }
  if (
    stop.service.mode === 'expected' &&
    (!Number.isFinite(stop.service.expectedMinutes) ||
      (stop.service.expectedMinutes ?? -1) < 0)
  ) {
    issues.push(
      issue(
        `stops.${String(stop.sequence)}.service.expectedMinutes`,
        'Enter an expected service duration.',
      ),
    );
  }
  if (stop.service.mode === 'range') {
    const minimum = stop.service.minimumMinutes ?? -1;
    const maximum = stop.service.maximumMinutes ?? -1;
    if (minimum < 0 || maximum < minimum) {
      issues.push(
        issue(
          `stops.${String(stop.sequence)}.service`,
          'Service range must have a nonnegative minimum and a maximum at least as large.',
        ),
      );
    }
  }
  return issues;
}

function validateClocks(state: TripSetupState, issues: ValidationIssue[]): void {
  const fields: readonly [string, number][] = [
    ['driveMinutesRemaining', state.clocks.driveMinutesRemaining],
    ['shiftMinutesRemaining', state.clocks.shiftMinutesRemaining],
    ['cycleMinutesRemaining', state.clocks.cycleMinutesRemaining],
  ];
  fields.forEach(([key, value]): void => {
    validateNonnegativeMinutes(issues, `clocks.${key}`, value);
  });
}

export function validateTripSetup(
  state: TripSetupState,
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (state.driver.selectedId === '') {
    issues.push(issue('driver', 'Select or create a driver.'));
  }
  if (state.tractor.selectedId === '') {
    issues.push(issue('tractor', 'Select or create a tractor.'));
  }
  if (state.trailer.selectedId === '') {
    issues.push(issue('trailer', 'Select or create a trailer.'));
  }
  if (state.load.selectedId === '') {
    issues.push(issue('load', 'Select or create a load profile.'));
  }
  if (state.departureAt === '') {
    issues.push(issue('departureAt', 'Enter a departure date and time.'));
  }
  if (state.currentDutyStatus === '') {
    issues.push(
      issue(
        'currentDutyStatus',
        'Choose the current duty status. It is never defaulted silently.',
      ),
    );
  }
  if (state.currentDutyStatusBeganAt === '') {
    issues.push(
      issue('currentDutyStatusBeganAt', 'Enter when the current duty status began.'),
    );
  }
  validateClocks(state, issues);
  issues.push(...validateHos(state));
  if (state.stops.length < 2) {
    issues.push(issue('stops', 'A trip requires at least a start and final destination.'));
  }
  state.stops.forEach((stop): void => {
    const sequence = String(stop.sequence);
    if (stop.address.trim() === '') {
      issues.push(
        issue(
          `stops.${sequence}.address`,
          `Stop ${String(stop.sequence + 1)} needs a location or address.`,
        ),
      );
    }
    if (
      stop.appointment.mode === 'fixed' &&
      stop.appointment.fixedAt === undefined
    ) {
      issues.push(
        issue(
          `stops.${sequence}.appointment.fixedAt`,
          'Enter the fixed appointment time.',
        ),
      );
    }
    if (
      stop.appointment.mode === 'window' &&
      (stop.appointment.earliestAt === undefined ||
        stop.appointment.latestAt === undefined)
    ) {
      issues.push(
        issue(
          `stops.${sequence}.appointment`,
          'Enter both ends of the appointment window.',
        ),
      );
    }
    issues.push(...validateService(stop));
  });
  return issues;
}

export function serializeDraft(state: TripSetupState): string {
  return JSON.stringify(state);
}

function isDraftObject(value: unknown): value is Partial<TripSetupState> & {
  readonly stops: readonly TripStopDraft[];
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'stops' in value &&
    Array.isArray(value.stops)
  );
}

export function restoreDraft(serialized: string): TripSetupState | undefined {
  try {
    const value: unknown = JSON.parse(serialized);
    if (!isDraftObject(value)) return undefined;
    const initial = createInitialTripSetupState();
    return {
      ...initial,
      ...value,
      clocks: { ...initial.clocks, ...value.clocks },
      hos: {
        ...initial.hos,
        ...value.hos,
        priorDutyTotals: Array.isArray(value.hos?.priorDutyTotals)
          ? value.hos.priorDutyTotals
          : [],
        cycleRecaps: Array.isArray(value.hos?.cycleRecaps)
          ? value.hos.cycleRecaps
          : [],
        existingSleeperPeriods: Array.isArray(
          value.hos?.existingSleeperPeriods,
        )
          ? value.hos.existingSleeperPeriods
          : [],
        restPreference: {
          ...initial.hos.restPreference,
          ...value.hos?.restPreference,
        },
      },
      stops: value.stops,
      deletedServerStopIds: Array.isArray(value.deletedServerStopIds)
        ? value.deletedServerStopIds
        : [],
    };
  } catch {
    return undefined;
  }
}
