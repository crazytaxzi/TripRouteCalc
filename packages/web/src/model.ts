export type ClockInputs = {
  readonly driveMinutesRemaining: number;
  readonly shiftMinutesRemaining: number;
  readonly cycleMinutesRemaining: number;
};

export type AppointmentMode = 'none' | 'fixed' | 'window';
export type ServiceMode = 'exact' | 'expected' | 'range';
export type DutyStatus = 'off_duty' | 'sleeper_berth' | 'driving' | 'on_duty_not_driving';

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

export type AppointmentSettings = {
  readonly mode: AppointmentMode;
  readonly timeZone: string;
  readonly fixedAt?: string | undefined;
  readonly earliestAt?: string | undefined;
  readonly latestAt?: string | undefined;
  readonly lateToleranceMinutes: number;
  readonly earlyParkingAllowed: boolean;
  readonly overnightParkingAllowed: boolean;
};

export type ServiceSettings = {
  readonly mode: ServiceMode;
  readonly exactMinutes?: number | undefined;
  readonly expectedMinutes?: number | undefined;
  readonly minimumMinutes?: number | undefined;
  readonly maximumMinutes?: number | undefined;
  readonly dutyStatus: DutyStatus;
};

export type TripStopDraft = {
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
};

export type ProfileSelection = {
  readonly selectedId: string;
  readonly displayName: string;
};

export type TripSetupState = {
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
  readonly stops: readonly TripStopDraft[];
  readonly autoRecalculate: boolean;
  readonly dirty: boolean;
  readonly calculationPending: boolean;
  readonly lastCalculationAt?: string | undefined;
  readonly lastError?: string | undefined;
};

export type ValidationIssue = {
  readonly path: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
};

let nextLocalStopId = 1;

export function createStop(type: StopType, sequence: number): TripStopDraft {
  const defaultMinutes = type === 'fuel' ? 30 : type === 'scale' ? 15 : type === 'start_location' ? 30 : 60;
  return {
    localId: `local-stop-${nextLocalStopId++}`,
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
      expectedMinutes: defaultMinutes,
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
    stops: [createStop('start_location', 0), createStop('shipper', 1), createStop('final_consignee', 2)],
    autoRecalculate: false,
    dirty: false,
    calculationPending: false,
  };
}

function resequence(stops: readonly TripStopDraft[]): readonly TripStopDraft[] {
  return stops.map((stop, sequence) => ({ ...stop, sequence }));
}

export function insertStop(state: TripSetupState, index: number, type: StopType = 'other'): TripSetupState {
  const boundedIndex = Math.max(0, Math.min(index, state.stops.length));
  const stops = [...state.stops];
  stops.splice(boundedIndex, 0, createStop(type, boundedIndex));
  return { ...state, stops: resequence(stops), dirty: true };
}

export function duplicateStop(state: TripSetupState, localId: string): TripSetupState {
  const index = state.stops.findIndex((stop) => stop.localId === localId);
  const source = state.stops[index];
  if (index < 0 || source === undefined) return state;
  const copy: TripStopDraft = {
    ...source,
    localId: `local-stop-${nextLocalStopId++}`,
    serverId: undefined,
    lockedPosition: false,
    label: source.label === '' ? '' : `${source.label} copy`,
  };
  const stops = [...state.stops];
  stops.splice(index + 1, 0, copy);
  return { ...state, stops: resequence(stops), dirty: true };
}

export function removeStop(state: TripSetupState, localId: string): TripSetupState {
  const stop = state.stops.find((candidate) => candidate.localId === localId);
  if (stop === undefined || stop.lockedPosition) return state;
  return { ...state, stops: resequence(state.stops.filter((candidate) => candidate.localId !== localId)), dirty: true };
}

export function moveStop(state: TripSetupState, localId: string, direction: -1 | 1): TripSetupState {
  const from = state.stops.findIndex((stop) => stop.localId === localId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= state.stops.length) return state;
  const current = state.stops[from];
  const target = state.stops[to];
  if (current === undefined || target === undefined || current.lockedPosition || target.lockedPosition) return state;
  const stops = [...state.stops];
  stops[from] = target;
  stops[to] = current;
  return { ...state, stops: resequence(stops), dirty: true };
}

export function updateStop(state: TripSetupState, localId: string, patch: Partial<Omit<TripStopDraft, 'localId' | 'sequence'>>): TripSetupState {
  return {
    ...state,
    dirty: true,
    stops: state.stops.map((stop) => (stop.localId === localId ? { ...stop, ...patch } : stop)),
  };
}

function validateService(stop: TripStopDraft): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (stop.service.mode === 'exact' && !(Number.isFinite(stop.service.exactMinutes) && (stop.service.exactMinutes ?? 0) >= 0)) {
    issues.push({ path: `stops.${stop.sequence}.service.exactMinutes`, message: 'Enter an exact service duration.', severity: 'error' });
  }
  if (stop.service.mode === 'expected' && !(Number.isFinite(stop.service.expectedMinutes) && (stop.service.expectedMinutes ?? 0) >= 0)) {
    issues.push({ path: `stops.${stop.sequence}.service.expectedMinutes`, message: 'Enter an expected service duration.', severity: 'error' });
  }
  if (stop.service.mode === 'range') {
    const minimum = stop.service.minimumMinutes ?? -1;
    const maximum = stop.service.maximumMinutes ?? -1;
    if (minimum < 0 || maximum < minimum) {
      issues.push({ path: `stops.${stop.sequence}.service`, message: 'Service range must have a nonnegative minimum and a maximum at least as large.', severity: 'error' });
    }
  }
  return issues;
}

export function validateTripSetup(state: TripSetupState): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (state.driver.selectedId === '') issues.push({ path: 'driver', message: 'Select or create a driver.', severity: 'error' });
  if (state.tractor.selectedId === '') issues.push({ path: 'tractor', message: 'Select or create a tractor.', severity: 'error' });
  if (state.trailer.selectedId === '') issues.push({ path: 'trailer', message: 'Select or create a trailer.', severity: 'error' });
  if (state.load.selectedId === '') issues.push({ path: 'load', message: 'Select or create a load profile.', severity: 'error' });
  if (state.departureAt === '') issues.push({ path: 'departureAt', message: 'Enter a departure date and time.', severity: 'error' });
  if (state.currentDutyStatus === '') issues.push({ path: 'currentDutyStatus', message: 'Choose the current duty status. It is never defaulted silently.', severity: 'error' });
  if (state.currentDutyStatusBeganAt === '') issues.push({ path: 'currentDutyStatusBeganAt', message: 'Enter when the current duty status began.', severity: 'error' });
  for (const [key, value] of Object.entries(state.clocks)) {
    if (!Number.isFinite(value) || value < 0) issues.push({ path: `clocks.${key}`, message: 'Clock values must be nonnegative.', severity: 'error' });
  }
  if (state.stops.length < 2) issues.push({ path: 'stops', message: 'A trip requires at least a start and final destination.', severity: 'error' });
  state.stops.forEach((stop) => {
    if (stop.address.trim() === '') issues.push({ path: `stops.${stop.sequence}.address`, message: `Stop ${stop.sequence + 1} needs a location or address.`, severity: 'error' });
    if (stop.appointment.mode === 'fixed' && stop.appointment.fixedAt === undefined) issues.push({ path: `stops.${stop.sequence}.appointment.fixedAt`, message: 'Enter the fixed appointment time.', severity: 'error' });
    if (stop.appointment.mode === 'window' && (stop.appointment.earliestAt === undefined || stop.appointment.latestAt === undefined)) issues.push({ path: `stops.${stop.sequence}.appointment`, message: 'Enter both ends of the appointment window.', severity: 'error' });
    issues.push(...validateService(stop));
  });
  return issues;
}

export function serializeDraft(state: TripSetupState): string {
  return JSON.stringify(state);
}

export function restoreDraft(serialized: string): TripSetupState | undefined {
  try {
    const value = JSON.parse(serialized) as unknown;
    if (typeof value !== 'object' || value === null || !('stops' in value) || !Array.isArray((value as { stops?: unknown }).stops)) return undefined;
    return value as TripSetupState;
  } catch {
    return undefined;
  }
}
