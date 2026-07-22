import type { TripSetupState, ValidationIssue } from './model.js';
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
      const problem = payload as Partial<ApiProblem>;
      throw {
        status: response.status,
        code: problem.code ?? 'request_failed',
        message: problem.message ?? 'The server rejected the request.',
        details: problem.details,
      } satisfies ApiProblem;
    }
    return payload as T;
  }

  public async calculate(state: TripSetupState): Promise<CalculationResponse> {
    const issues = validateTripSetup(state).filter((issue) => issue.severity === 'error');
    if (issues.length > 0) throw new TripSetupValidationError(issues);
    if (state.tripId === undefined) throw new TripSetupValidationError([{ path: 'tripId', message: 'Save the trip before calculation.', severity: 'error' }]);
    return this.#request<CalculationResponse>(`/trips/${encodeURIComponent(state.tripId)}/calculations`, {
      method: 'POST',
      headers: { 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ expectedRevisionNumber: state.revisionNumber, simulation: createSimulationPayload(state) }),
    });
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
    stops: state.stops.map((stop) => ({
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
    this.#timer = setTimeout(() => {
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
