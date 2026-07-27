import {
  completeStopPayload,
  ensureStopPlanningFacts,
  loadProfilePayload,
  loadStage18CompleteFacts,
  saveStage18CompleteFacts,
  tractorProfilePayload,
  trailerProfilePayload,
} from './stage18-details.js';
import type { Stage18CompleteFacts } from './stage18-details.js';
import type {
  TripSetupState,
  TripStopDraft,
  ValidationIssue,
} from './model.js';
import {
  PlanningPayloadError,
  createPlanPayload,
} from './planning-payload.js';
import { validateStage18TripSetup } from './stage18-validation.js';

export interface ApiProblem {
  readonly status: number;
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}

export interface CalculationResponse {
  readonly calculationId?: string;
  readonly revisionNumber?: number;
  readonly status?: string;
  readonly warnings?: readonly unknown[];
  readonly trip?: Readonly<Record<string, unknown>>;
  readonly calculation?: Readonly<Record<string, unknown>>;
  readonly calculationStatus?: string;
}

interface DriverResponse {
  readonly driverId: string;
  readonly displayName: string;
}

interface EquipmentResponse {
  readonly tractorId?: string;
  readonly trailerId?: string;
  readonly loadId?: string;
  readonly profile?: unknown;
}

interface TripRevisionResponse {
  readonly revisionNumber: number;
}

interface TripResponse {
  readonly tripId: string;
  readonly currentRevision: TripRevisionResponse;
}

interface AddedStopResponse {
  readonly trip: TripResponse;
  readonly stop: { readonly id: string };
}

function errors(issues: readonly ValidationIssue[]): readonly ValidationIssue[] {
  return issues.filter((issue): boolean => issue.severity === 'error');
}

function stopFacts(stop: TripStopDraft): ReturnType<typeof ensureStopPlanningFacts> {
  return ensureStopPlanningFacts(stop.localId, stop);
}

export function createStopPayload(
  stop: TripStopDraft,
): Readonly<Record<string, unknown>> {
  return {
    sequence: stop.sequence + 1,
    ...completeStopPayload(stop, stopFacts(stop)),
  };
}

export function createStopPatchPayload(
  stop: TripStopDraft,
): Readonly<Record<string, unknown>> {
  return completeStopPayload(stop, stopFacts(stop));
}

class ApiProblemError extends Error implements ApiProblem {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  public constructor(problem: ApiProblem) {
    super(problem.message);
    this.name = 'ApiProblemError';
    this.status = problem.status;
    this.code = problem.code;
    this.details = problem.details;
  }
}

export class TripSetupApiClient {
  readonly #baseUrl: string;
  readonly #getToken: () => string;

  public constructor(baseUrl: string, getToken: () => string) {
    this.#baseUrl = baseUrl.replace(/\/$/u, '');
    this.#getToken = getToken;
  }

  async #request<T>(path: string, init: RequestInit): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('content-type', 'application/json');
    headers.set('authorization', `Bearer ${this.#getToken()}`);
    const response = await fetch(`${this.#baseUrl}${path}`, {
      ...init,
      headers,
    });
    const payload = (await response.json()) as unknown;
    if (!response.ok) {
      const envelope = payload as { readonly error?: Partial<ApiProblem> };
      const problem = envelope.error ?? (payload as Partial<ApiProblem>);
      throw new ApiProblemError({
        status: response.status,
        code: problem.code ?? 'request_failed',
        message: problem.message ?? 'The server rejected the request.',
        details: problem.details,
      });
    }
    return payload as T;
  }

  async #write<T>(
    path: string,
    method: 'POST' | 'PATCH' | 'DELETE',
    body: unknown,
  ): Promise<T> {
    return this.#request<T>(path, {
      method,
      headers: { 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify(body),
    });
  }

  async #materializeDriver(
    state: TripSetupState,
    facts: Stage18CompleteFacts,
  ): Promise<Readonly<{
    driver: TripSetupState['driver'];
    facts: Stage18CompleteFacts;
  }>> {
    const enteredName =
      facts.driver.displayName.trim() === ''
        ? state.driver.displayName.trim()
        : facts.driver.displayName.trim();
    let id = facts.driver.id ?? state.driver.selectedId;
    let displayName = enteredName;
    if (id === '') {
      const created = await this.#write<DriverResponse>('/drivers', 'POST', {
        displayName,
      });
      id = created.driverId;
      displayName = created.displayName;
    } else if (facts.driver.dirty) {
      const updated = await this.#write<DriverResponse>(
        `/drivers/${encodeURIComponent(id)}`,
        'PATCH',
        { displayName },
      );
      displayName = updated.displayName;
    }
    return {
      driver: { selectedId: id, displayName },
      facts: {
        ...facts,
        driver: { id, displayName, dirty: false },
      },
    };
  }

  async #materializeEquipment(
    state: TripSetupState,
    facts: Stage18CompleteFacts,
  ): Promise<Readonly<{
    tractorId: string;
    trailerId: string;
    loadId: string;
    facts: Stage18CompleteFacts;
  }>> {
    let next = facts;

    let tractorId = next.tractor.id ?? state.tractor.selectedId;
    const tractorNeedsWrite =
      next.tractor.id !== undefined || state.tractor.selectedId === '';
    if (tractorId === '') {
      const created = await this.#write<EquipmentResponse>(
        '/equipment/tractors',
        'POST',
        tractorProfilePayload(next.tractor),
      );
      tractorId = created.tractorId ?? '';
    } else if (tractorNeedsWrite && next.tractor.dirty) {
      await this.#write<EquipmentResponse>(
        `/equipment/tractors/${encodeURIComponent(tractorId)}`,
        'PATCH',
        tractorProfilePayload(next.tractor),
      );
    }
    if (tractorId === '') {
      throw new Error('The tractor profile response omitted its public identifier.');
    }
    next = {
      ...next,
      tractor: { ...next.tractor, id: tractorId, dirty: false },
    };

    let trailerId = next.trailer.id ?? state.trailer.selectedId;
    const trailerNeedsWrite =
      next.trailer.id !== undefined || state.trailer.selectedId === '';
    if (trailerId === '') {
      const created = await this.#write<EquipmentResponse>(
        '/equipment/trailers',
        'POST',
        trailerProfilePayload(next.trailer),
      );
      trailerId = created.trailerId ?? '';
    } else if (trailerNeedsWrite && next.trailer.dirty) {
      await this.#write<EquipmentResponse>(
        `/equipment/trailers/${encodeURIComponent(trailerId)}`,
        'PATCH',
        trailerProfilePayload(next.trailer),
      );
    }
    if (trailerId === '') {
      throw new Error('The trailer profile response omitted its public identifier.');
    }
    next = {
      ...next,
      trailer: { ...next.trailer, id: trailerId, dirty: false },
    };

    let loadId = next.load.id ?? state.load.selectedId;
    const loadNeedsWrite = next.load.id !== undefined || state.load.selectedId === '';
    if (loadId === '') {
      const created = await this.#write<EquipmentResponse>(
        '/equipment/loads',
        'POST',
        loadProfilePayload(next.load),
      );
      loadId = created.loadId ?? '';
    } else if (loadNeedsWrite && next.load.dirty) {
      await this.#write<EquipmentResponse>(
        `/equipment/loads/${encodeURIComponent(loadId)}`,
        'PATCH',
        loadProfilePayload(next.load),
      );
    }
    if (loadId === '') {
      throw new Error('The load profile response omitted its public identifier.');
    }
    next = {
      ...next,
      load: { ...next.load, id: loadId, dirty: false },
    };

    return { tractorId, trailerId, loadId, facts: next };
  }

  public async save(state: TripSetupState): Promise<TripSetupState> {
    const validation = errors(validateStage18TripSetup(state));
    if (validation.length > 0) throw new TripSetupValidationError(validation);

    const driverResult = await this.#materializeDriver(
      state,
      loadStage18CompleteFacts(),
    );
    const equipment = await this.#materializeEquipment(
      state,
      driverResult.facts,
    );
    saveStage18CompleteFacts(equipment.facts);

    const driver = driverResult.driver;
    const tractor = {
      selectedId: equipment.tractorId,
      displayName: equipment.facts.tractor.unitNumber,
    };
    const trailer = {
      selectedId: equipment.trailerId,
      displayName: equipment.facts.trailer.trailerNumber,
    };
    const load = {
      selectedId: equipment.loadId,
      displayName: equipment.facts.load.loadIdentifier,
    };

    let tripId = state.tripId;
    let revisionNumber = state.revisionNumber;
    const stops = [...state.stops];
    if (tripId === undefined) {
      const created = await this.#write<TripResponse>('/trips', 'POST', {
        driverId: driver.selectedId,
        ruleSetVersion: 'unselected',
      });
      tripId = created.tripId;
      revisionNumber = created.currentRevision.revisionNumber;
    }

    const encodedTripId = encodeURIComponent(tripId);
    const patched = await this.#write<TripResponse>(
      `/trips/${encodedTripId}`,
      'PATCH',
      {
        expectedRevisionNumber: revisionNumber,
        tractorId: tractor.selectedId,
        trailerId: trailer.selectedId,
        loadId: load.selectedId,
      },
    );
    revisionNumber = patched.currentRevision.revisionNumber;

    for (const deletedStopId of state.deletedServerStopIds) {
      const deleted = await this.#write<TripResponse>(
        `/trips/${encodedTripId}/stops/${encodeURIComponent(deletedStopId)}`,
        'DELETE',
        { expectedRevisionNumber: revisionNumber },
      );
      revisionNumber = deleted.currentRevision.revisionNumber;
    }

    for (const [index, stop] of stops.entries()) {
      if (stop.serverId === undefined) {
        const added = await this.#write<AddedStopResponse>(
          `/trips/${encodedTripId}/stops`,
          'POST',
          {
            expectedRevisionNumber: revisionNumber,
            stop: createStopPayload(stop),
          },
        );
        revisionNumber = added.trip.currentRevision.revisionNumber;
        stops[index] = { ...stop, serverId: added.stop.id };
        continue;
      }
      const updated = await this.#write<TripResponse>(
        `/trips/${encodedTripId}/stops/${encodeURIComponent(stop.serverId)}`,
        'PATCH',
        {
          expectedRevisionNumber: revisionNumber,
          patch: createStopPatchPayload(stop),
        },
      );
      revisionNumber = updated.currentRevision.revisionNumber;
    }

    const stopIds = stops.map((stop): string => {
      if (stop.serverId === undefined) {
        throw new Error('Saved stop is missing its server identifier.');
      }
      return stop.serverId;
    });
    if (stopIds.length > 0) {
      const reordered = await this.#write<TripResponse>(
        `/trips/${encodedTripId}/stops/reorder`,
        'POST',
        { expectedRevisionNumber: revisionNumber, stopIds },
      );
      revisionNumber = reordered.currentRevision.revisionNumber;
    }

    return {
      ...state,
      tripId,
      revisionNumber,
      driver,
      tractor,
      trailer,
      load,
      stops,
      deletedServerStopIds: [],
      dirty: false,
      lastError: undefined,
    };
  }

  public async calculate(state: TripSetupState): Promise<CalculationResponse> {
    const validation = errors(validateStage18TripSetup(state));
    if (validation.length > 0) throw new TripSetupValidationError(validation);
    if (state.tripId === undefined) {
      throw new TripSetupValidationError([
        {
          path: 'tripId',
          message: 'Save the trip before calculation.',
          severity: 'error',
        },
      ]);
    }
    let payload: Record<string, unknown>;
    try {
      const facts = loadStage18CompleteFacts();
      payload = {
        ...createPlanPayload(state),
        routePolicy: facts.route.policy,
        avoidances: facts.route.avoidances,
      };
    } catch (error) {
      if (error instanceof PlanningPayloadError) {
        throw new TripSetupValidationError([
          { path: error.path, message: error.message, severity: 'error' },
        ]);
      }
      throw error;
    }
    return this.#write<CalculationResponse>(
      `/trips/${encodeURIComponent(state.tripId)}/plan`,
      'POST',
      payload,
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

export function createSimulationPayload(
  state: TripSetupState,
): Record<string, unknown> {
  return {
    departureAt: state.departureAt,
    departureTimeZone: state.departureTimeZone,
    currentDutyStatus: state.currentDutyStatus,
    currentDutyStatusBeganAt: state.currentDutyStatusBeganAt,
    clocks: state.clocks,
    stops: state.stops.map(
      (stop): Readonly<Record<string, unknown>> => ({
        id: stop.serverId,
        type: stop.type,
        sequence: stop.sequence,
        address: stop.address,
        required: stop.required,
        lockedPosition: stop.lockedPosition,
        appointment: stop.appointment,
        service: stop.service,
        notes: stop.notes,
      }),
    ),
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
