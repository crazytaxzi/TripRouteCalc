import type {
  AppointmentSettings,
  ServiceSettings,
  TripSetupState,
  TripStopDraft,
  ValidationIssue,
} from './model.js';
import { validateTripSetup } from './model.js';

export type ApiProblem = {
  readonly status: number;
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
};

export type CalculationResponse = {
  readonly calculationId: string;
  readonly revisionNumber: number;
  readonly status: string;
  readonly warnings?: readonly unknown[];
};

type DriverResponse = {
  readonly driverId: string;
  readonly displayName: string;
};

type TripRevisionResponse = {
  readonly revisionNumber: number;
};

type TripResponse = {
  readonly tripId: string;
  readonly currentRevision: TripRevisionResponse;
};

type AddedStopResponse = {
  readonly trip: TripResponse;
  readonly stop: { readonly id: string };
};

function duration(minutes: number): Readonly<{ value: number; unit: 'minute' }> {
  return { value: minutes, unit: 'minute' };
}

function publicStopType(type: TripStopDraft['type']): string {
  return type.replaceAll('_', '-');
}

function publicDutyStatus(status: ServiceSettings['dutyStatus']): string {
  return status.toUpperCase();
}

function appointmentPayload(settings: AppointmentSettings): Readonly<Record<string, unknown>> {
  const lateTolerance = duration(settings.lateToleranceMinutes);
  if (settings.mode === 'fixed' && settings.fixedAt !== undefined) {
    return {
      mode: 'fixed',
      at: { localDateTime: settings.fixedAt, timeZone: settings.timeZone },
      lateTolerance,
    };
  }
  if (
    settings.mode === 'window' &&
    settings.earliestAt !== undefined &&
    settings.latestAt !== undefined
  ) {
    return {
      mode: 'window',
      window: {
        start: { localDateTime: settings.earliestAt, timeZone: settings.timeZone },
        end: { localDateTime: settings.latestAt, timeZone: settings.timeZone },
      },
      lateTolerance,
    };
  }
  return { mode: 'none' };
}

function servicePayload(settings: ServiceSettings): Readonly<Record<string, unknown>> {
  if (settings.mode === 'exact') {
    return { mode: 'exact', duration: duration(settings.exactMinutes ?? 0) };
  }
  if (settings.mode === 'range') {
    const minimum = settings.minimumMinutes ?? 0;
    const maximum = settings.maximumMinutes ?? minimum;
    const expected = Math.max(minimum, Math.min(settings.expectedMinutes ?? minimum, maximum));
    return {
      mode: 'range',
      minimum: duration(minimum),
      expected: duration(expected),
      maximum: duration(maximum),
    };
  }
  return { mode: 'expected', duration: duration(settings.expectedMinutes ?? 0) };
}

export function createStopPayload(stop: TripStopDraft): Readonly<Record<string, unknown>> {
  return {
    sequence: stop.sequence + 1,
    type: publicStopType(stop.type),
    required: stop.required,
    lockedPosition: stop.lockedPosition,
    location: {
      description: stop.label.trim() === '' ? stop.address : stop.label,
      addressText: stop.address,
      timeZone: stop.appointment.timeZone,
      resolutionStatus: 'user-confirmed',
    },
    appointment: appointmentPayload(stop.appointment),
    facilityHours: { windows: [] },
    checkInDuration: duration(0),
    serviceDuration: servicePayload(stop.service),
    waitingDutyStatus: publicDutyStatus(stop.service.dutyStatus),
    checkInDutyStatus: 'ON_DUTY_NOT_DRIVING',
    serviceDutyStatus: publicDutyStatus(stop.service.dutyStatus),
    earlyParkingAllowed: stop.appointment.earlyParkingAllowed,
    overnightParkingAllowed: stop.appointment.overnightParkingAllowed,
    ...(stop.notes.trim() === '' ? {} : { notes: stop.notes }),
  };
}

export class TripSetupApiClient {
  readonly #baseUrl: string;
  readonly #getToken: () => string;

  public constructor(baseUrl: string, getToken: () => string) {
    this.#baseUrl = baseUrl.replace(/\/$/, '');
    this.#getToken = getToken;
  }

  async #request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${this.#baseUrl}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.#getToken()}`,
        ...init.headers,
      },
    });
    const payload = (await response.json()) as unknown;
    if (!response.ok) {
      const envelope = payload as {
        readonly error?: Partial<ApiProblem>;
      };
      const problem = envelope.error ?? (payload as Partial<ApiProblem>);
      throw {
        status: response.status,
        code: problem.code ?? 'request_failed',
        message: problem.message ?? 'The server rejected the request.',
        details: problem.details,
      } satisfies ApiProblem;
    }
    return payload as T;
  }

  async #write<T>(path: string, method: 'POST' | 'PATCH', body: unknown): Promise<T> {
    return this.#request<T>(path, {
      method,
      headers: { 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify(body),
    });
  }

  public async save(state: TripSetupState): Promise<TripSetupState> {
    let driver = state.driver;
    if (driver.selectedId === '') {
      if (driver.displayName.trim() === '') {
        throw new TripSetupValidationError([
          { path: 'driver', message: 'Enter a driver name or identifier.', severity: 'error' },
        ]);
      }
      const created = await this.#write<DriverResponse>('/drivers', 'POST', {
        displayName: driver.displayName.trim(),
      });
      driver = { selectedId: created.driverId, displayName: created.displayName };
    }

    let tripId = state.tripId;
    let revisionNumber = state.revisionNumber;
    let stops = [...state.stops];
    if (tripId === undefined) {
      const created = await this.#write<TripResponse>('/trips', 'POST', {
        driverId: driver.selectedId,
        ruleSetVersion: 'unselected',
      });
      tripId = created.tripId;
      revisionNumber = created.currentRevision.revisionNumber;
    }

    const equipmentPatch: Record<string, unknown> = { expectedRevisionNumber: revisionNumber };
    if (state.tractor.selectedId !== '') equipmentPatch.tractorId = state.tractor.selectedId;
    if (state.trailer.selectedId !== '') equipmentPatch.trailerId = state.trailer.selectedId;
    if (state.load.selectedId !== '') equipmentPatch.loadId = state.load.selectedId;
    if (Object.keys(equipmentPatch).length > 1) {
      const patched = await this.#write<TripResponse>(`/trips/${encodeURIComponent(tripId)}`, 'PATCH', equipmentPatch);
      revisionNumber = patched.currentRevision.revisionNumber;
    }

    for (const [index, stop] of stops.entries()) {
      if (stop.serverId !== undefined) continue;
      const added = await this.#write<AddedStopResponse>(
        `/trips/${encodeURIComponent(tripId)}/stops`,
        'POST',
        { expectedRevisionNumber: revisionNumber, stop: createStopPayload(stop) },
      );
      revisionNumber = added.trip.currentRevision.revisionNumber;
      stops[index] = { ...stop, serverId: added.stop.id };
    }

    return {
      ...state,
      tripId,
      revisionNumber,
      driver,
      stops,
      dirty: false,
      lastError: undefined,
    };
  }

  public async calculate(state: TripSetupState): Promise<CalculationResponse> {
    const issues = validateTripSetup(state).filter((issue): boolean => issue.severity === 'error');
    if (issues.length > 0) throw new TripSetupValidationError(issues);
    if (state.tripId === undefined) {
      throw new TripSetupValidationError([
        { path: 'tripId', message: 'Save the trip before calculation.', severity: 'error' },
      ]);
    }
    return this.#write<CalculationResponse>(
      `/trips/${encodeURIComponent(state.tripId)}/calculate`,
      'POST',
      {
        expectedRevisionNumber: state.revisionNumber,
        simulation: createSimulationPayload(state),
      },
    );
  }
}

export class TripSetupValidationError extends Error {
  public readonly issues: readonly ValidationIssue[];

  public constructor(issues: readonly ValidationIssue[]) {
    super('Trip setup is incomplete.');
    this.name = 'TripSetupValidationError';
    this.issues = issues;
  }
}

export function createSimulationPayload(state: TripSetupState): Record<string, unknown> {
  return {
    departureAt: state.departureAt,
    departureTimeZone: state.departureTimeZone,
    currentDutyStatus: state.currentDutyStatus,
    currentDutyStatusBeganAt: state.currentDutyStatusBeganAt,
    clocks: state.clocks,
    stops: state.stops.map((stop): Readonly<Record<string, unknown>> => ({
      id: stop.serverId,
      type: stop.type,
      sequence: stop.sequence,
      address: stop.address,
      required: stop.required,
      lockedPosition: stop.lockedPosition,
      appointment: stop.appointment,
      service: stop.service,
      notes: stop.notes,
    })),
  };
}

export class RecalculationController {
  readonly #delayMs: number;
  readonly #calculate: () => Promise<void>;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #running = false;
  #queued = false;

  public constructor(calculate: () => Promise<void>, delayMs = 750) {
    this.#calculate = calculate;
    this.#delayMs = delayMs;
  }

  public request(): void {
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#timer = setTimeout((): void => {
      this.#timer = undefined;
      void this.#run();
    }, this.#delayMs);
  }

  public cancel(): void {
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#queued = false;
  }

  async #run(): Promise<void> {
    if (this.#running) {
      this.#queued = true;
      return;
    }
    this.#running = true;
    try {
      await this.#calculate();
    } finally {
      this.#running = false;
      if (this.#queued) {
        this.#queued = false;
        this.request();
      }
    }
  }
}
