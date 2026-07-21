import {
  assessCommercialRoute,
} from '@trip-route-calc/foundation';
import type {
  LoadProfile,
  TractorProfile,
  TrailerProfile,
} from '@trip-route-calc/foundation';
import { z } from 'zod';

import {
  loadFromForm,
  routeRequestFromDraft,
  simulationInputFromDraft,
  stopPlan,
  tractorFromForm,
  trailerFromForm,
} from './model.js';
import type {
  PlanningOutcome,
  ProfileLists,
  ProfileOption,
  StopForm,
  TripDraft,
} from './types.js';

const objectSchema = z.record(z.unknown());
const objectArraySchema = z.array(objectSchema);

export class PlanningApiError extends Error {
  public override readonly name = 'PlanningApiError';

  public constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details: Readonly<Record<string, unknown>>,
  ) {
    super(message);
  }
}

export interface SubmissionResult {
  readonly draft: TripDraft;
  readonly outcome: PlanningOutcome;
}

function object(value: unknown, label: string): Record<string, unknown> {
  const result = objectSchema.safeParse(value);
  if (!result.success) throw new TypeError(`${label} was not an object.`);
  return result.data;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} was not a non-empty string.`);
  }
  return value;
}

function number(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} was not a finite number.`);
  }
  return value;
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === '/') return '';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

async function digest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const result = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(result))
    .slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function idempotencyKey(prefix: string, value: unknown): Promise<string> {
  return `stage18-${prefix}-${await digest(value)}`;
}

function publicStopsFromTrip(
  response: Record<string, unknown>,
  sourceStops: readonly StopForm[],
): readonly StopForm[] {
  const rows = objectArraySchema.parse(response.stops);
  if (rows.length !== sourceStops.length) {
    throw new TypeError('Trip response stop count did not match the submitted draft.');
  }
  return sourceStops.map((stop, index) => ({
    ...stop,
    publicId: string(rows[index]?.stopId, `stops[${String(index)}].stopId`),
  }));
}

export class TripPlanningClient {
  readonly #baseUrl: string;
  readonly #token: string;
  readonly #signal?: AbortSignal;

  public constructor(options: {
    readonly baseUrl: string;
    readonly token: string;
    readonly signal?: AbortSignal;
  }) {
    this.#baseUrl = normalizeBaseUrl(options.baseUrl);
    this.#token = options.token.trim();
    this.#signal = options.signal;
  }

  async #request(
    path: string,
    options: Readonly<{
      method?: 'GET' | 'POST' | 'PATCH';
      payload?: unknown;
      idempotencyKey?: string;
    }> = {},
  ): Promise<Record<string, unknown>> {
    if (this.#token === '') {
      throw new PlanningApiError(
        401,
        'AUTHENTICATION_REQUIRED',
        'Enter a bearer token for the authenticated carrier account.',
        {},
      );
    }
    const response = await fetch(`${this.#baseUrl}${path}`, {
      method: options.method ?? 'GET',
      signal: this.#signal,
      headers: {
        authorization: `Bearer ${this.#token}`,
        ...(options.payload === undefined
          ? {}
          : { 'content-type': 'application/json' }),
        ...(options.idempotencyKey === undefined
          ? {}
          : { 'idempotency-key': options.idempotencyKey }),
      },
      ...(options.payload === undefined
        ? {}
        : { body: JSON.stringify(options.payload) }),
    });
    const payload = object(await response.json(), 'API response');
    if (!response.ok) {
      const error = object(payload.error, 'API error');
      throw new PlanningApiError(
        response.status,
        typeof error.code === 'string' ? error.code : 'API_FAILURE',
        typeof error.message === 'string'
          ? error.message
          : 'The TripRouteCalc API rejected the request.',
        object(error.details ?? {}, 'API error details'),
      );
    }
    return payload;
  }

  public async loadProfiles(): Promise<ProfileLists> {
    const [drivers, tractors, trailers, loads] = await Promise.all([
      this.#request('/api/drivers'),
      this.#request('/api/equipment/tractors'),
      this.#request('/api/equipment/trailers'),
      this.#request('/api/equipment/loads'),
    ]);
    const driverOptions: ProfileOption[] = objectArraySchema
      .parse(drivers.drivers)
      .map((row) => ({
        id: string(row.driverId, 'driverId'),
        label: string(row.displayName, 'driver displayName'),
      }));
    const equipmentOptions = (
      response: Record<string, unknown>,
      collection: 'tractors' | 'trailers' | 'loads',
      idField: 'tractorId' | 'trailerId' | 'loadId',
      labelField: 'unitNumber' | 'trailerNumber' | 'loadIdentifier',
    ): readonly ProfileOption[] =>
      objectArraySchema.parse(response[collection]).map((row) => {
        const profile = object(row.profile, `${collection} profile`);
        return {
          id: string(row[idField], idField),
          label: string(profile[labelField], labelField),
          profile,
        };
      });
    return {
      drivers: driverOptions,
      tractors: equipmentOptions(
        tractors,
        'tractors',
        'tractorId',
        'unitNumber',
      ),
      trailers: equipmentOptions(
        trailers,
        'trailers',
        'trailerId',
        'trailerNumber',
      ),
      loads: equipmentOptions(loads, 'loads', 'loadId', 'loadIdentifier'),
    };
  }

  async #saveDriver(draft: TripDraft): Promise<string> {
    const payload = { displayName: draft.driver.displayName };
    const key = await idempotencyKey('driver', {
      id: draft.driver.id ?? null,
      payload,
    });
    const response = await this.#request(
      draft.driver.id === undefined
        ? '/api/drivers'
        : `/api/drivers/${draft.driver.id}`,
      {
        method: draft.driver.id === undefined ? 'POST' : 'PATCH',
        payload,
        idempotencyKey: key,
      },
    );
    return string(response.driverId, 'driverId');
  }

  async #saveEquipment(
    kind: 'tractor' | 'trailer' | 'load',
    currentId: string | undefined,
    profile: TractorProfile | TrailerProfile | LoadProfile,
  ): Promise<string> {
    const key = await idempotencyKey(kind, { currentId: currentId ?? null, profile });
    const response = await this.#request(
      currentId === undefined
        ? `/api/equipment/${kind}s`
        : `/api/equipment/${kind}s/${currentId}`,
      {
        method: currentId === undefined ? 'POST' : 'PATCH',
        payload: profile,
        idempotencyKey: key,
      },
    );
    return string(response[`${kind}Id`], `${kind}Id`);
  }

  public async submitDraft(draft: TripDraft): Promise<SubmissionResult> {
    const driverId = await this.#saveDriver(draft);
    const [tractorId, trailerId, loadId] = await Promise.all([
      this.#saveEquipment(
        'tractor',
        draft.tractor.id,
        tractorFromForm(draft.tractor),
      ),
      this.#saveEquipment(
        'trailer',
        draft.trailer.id,
        trailerFromForm(draft.trailer),
      ),
      this.#saveEquipment('load', draft.load.id, loadFromForm(draft.load)),
    ]);
    const savedDraft: TripDraft = {
      ...draft,
      driver: { ...draft.driver, id: driverId },
      tractor: { ...draft.tractor, id: tractorId },
      trailer: { ...draft.trailer, id: trailerId },
      load: { ...draft.load, id: loadId },
    };

    const createTripPayload = {
      driverId,
      ruleSetVersion: savedDraft.route.ruleSetVersion,
    };
    const createdTrip = await this.#request('/api/trips', {
      method: 'POST',
      payload: createTripPayload,
      idempotencyKey: await idempotencyKey('trip-create', createTripPayload),
    });
    const tripId = string(createdTrip.tripId, 'tripId');
    const initialRevision = object(createdTrip.currentRevision, 'currentRevision');
    let revisionNumber = number(
      initialRevision.revisionNumber,
      'currentRevision.revisionNumber',
    );

    const equipmentPayload = {
      expectedRevisionNumber: revisionNumber,
      tractorId,
      trailerId,
      loadId,
    };
    const equipmentTrip = await this.#request(`/api/trips/${tripId}`, {
      method: 'PATCH',
      payload: equipmentPayload,
      idempotencyKey: await idempotencyKey('trip-equipment', equipmentPayload),
    });
    revisionNumber = number(
      object(equipmentTrip.currentRevision, 'currentRevision').revisionNumber,
      'currentRevision.revisionNumber',
    );

    let publicStops: readonly StopForm[] = [];
    for (const [index, sourceStop] of savedDraft.stops.entries()) {
      const plan = stopPlan(sourceStop, index + 1);
      const { id: _id, sequence: _sequence, ...stop } = plan;
      const stopPayload = { expectedRevisionNumber: revisionNumber, stop };
      const updatedTrip = await this.#request(`/api/trips/${tripId}/stops`, {
        method: 'POST',
        payload: stopPayload,
        idempotencyKey: await idempotencyKey(
          `trip-stop-${String(index + 1)}`,
          stopPayload,
        ),
      });
      revisionNumber = number(
        object(updatedTrip.currentRevision, 'currentRevision').revisionNumber,
        'currentRevision.revisionNumber',
      );
      publicStops = publicStopsFromTrip(updatedTrip, savedDraft.stops);
    }

    const persistedDraft: TripDraft = { ...savedDraft, stops: publicStops };
    const routeInput = routeRequestFromDraft(persistedDraft, publicStops);
    if (routeInput.status === 'blocked') {
      return {
        draft: persistedDraft,
        outcome: {
          status: 'blocked',
          message:
            'Equipment or load evidence is incomplete for commercial routing.',
          tripId,
          revisionNumber,
          warnings: routeInput.issues.map((issue) => issue.message),
        },
      };
    }

    const routeResponse = await this.#request('/api/routes/validate', {
      method: 'POST',
      payload: routeInput.request,
    });
    const rawRoute = object(routeResponse.route, 'route');
    const { assessment: _assessment, ...routePayload } = rawRoute;
    const route = assessCommercialRoute(routePayload);
    if (route.assessment.commercialPlanningStatus === 'blocked') {
      return {
        draft: persistedDraft,
        outcome: {
          status: 'blocked',
          message: 'The commercial route requires correction or manual verification.',
          tripId,
          revisionNumber,
          warnings: route.assessment.blockingReasons,
        },
      };
    }

    const simulation = {
      ...simulationInputFromDraft(persistedDraft, driverId, route),
      stops: publicStops.map((stop, index) => stopPlan(stop, index + 1)),
      revisionReference: 'server-replaces-this-reference',
    };
    const calculationPayload = {
      expectedRevisionNumber: revisionNumber,
      simulation,
    };
    const calculationResponse = await this.#request(
      `/api/trips/${tripId}/calculate`,
      {
        method: 'POST',
        payload: calculationPayload,
        idempotencyKey: await idempotencyKey(
          'trip-calculate',
          calculationPayload,
        ),
      },
    );
    const trip = object(calculationResponse.trip, 'calculated trip');
    const calculatedRevision = object(trip.currentRevision, 'currentRevision');
    const calculation = object(calculationResponse.calculation, 'calculation');
    const expected = object(calculation.expected, 'expected calculation');
    const explanations = Array.isArray(expected.explanations)
      ? expected.explanations.filter((value): value is string => typeof value === 'string')
      : [];

    return {
      draft: persistedDraft,
      outcome: {
        status: expected.status === 'BLOCKED' ? 'blocked' : 'complete',
        message:
          expected.status === 'BLOCKED'
            ? 'The trip was saved, but a legal or evidence blocker prevents a usable plan.'
            : 'The trip was saved and calculated.',
        tripId,
        revisionNumber: number(
          calculatedRevision.revisionNumber,
          'currentRevision.revisionNumber',
        ),
        confidence:
          typeof expected.confidence === 'string' ? expected.confidence : undefined,
        warnings: explanations,
      },
    };
  }
}
