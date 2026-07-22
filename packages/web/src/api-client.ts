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
  detailedLoadFromForm as loadFromForm,
  detailedRouteRequestFromDraft as routeRequestFromDraft,
  saveDetailedDraft as saveDraft,
  detailedTractorFromForm as tractorFromForm,
  detailedTrailerFromForm as trailerFromForm,
} from './equipment-detail-model.js';
import {
  simulationInputFromDraft,
  stopPlan,
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

function nullableString(value: unknown, label: string): string | null {
  if (value === null) return null;
  return string(value, label);
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === '/') return '';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonical(child)]),
  );
}

function equivalent(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

async function digest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(value)));
  const result = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(result))
    .slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function idempotencyKey(prefix: string, value: unknown): Promise<string> {
  return `stage18-${prefix}-${await digest(value)}`;
}

function tripFromOperation(
  response: Record<string, unknown>,
  label: string,
): Record<string, unknown> {
  return response.trip === undefined ? response : object(response.trip, label);
}

function revisionNumber(trip: Record<string, unknown>): number {
  return number(
    object(trip.currentRevision, 'currentRevision').revisionNumber,
    'currentRevision.revisionNumber',
  );
}

function stopRows(trip: Record<string, unknown>): readonly Record<string, unknown>[] {
  return objectArraySchema.parse(trip.stops);
}

function stopId(row: Record<string, unknown>, index: number): string {
  return string(row.id ?? row.stopId, `stops[${String(index)}].id`);
}

function stopSequence(row: Record<string, unknown>, index: number): number {
  return number(row.sequence, `stops[${String(index)}].sequence`);
}

function stopPatch(stop: StopForm): Record<string, unknown> {
  const plan = stopPlan(stop, 1);
  return Object.fromEntries(
    Object.entries(plan).filter(
      ([key]) => key !== 'id' && key !== 'sequence',
    ),
  );
}

function createStopPayload(stop: StopForm, sequence: number): Record<string, unknown> {
  const plan = stopPlan(stop, sequence);
  return Object.fromEntries(
    Object.entries(plan).filter(([key]) => key !== 'id'),
  );
}

function serverStopPatch(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).filter(
      ([key]) => key !== 'id' && key !== 'stopId' && key !== 'sequence',
    ),
  );
}

function hydratePersistedPrefix(
  rows: readonly Record<string, unknown>[],
  sourceStops: readonly StopForm[],
): readonly StopForm[] {
  const explicitIds = new Set(
    sourceStops.flatMap((stop) =>
      stop.publicId === undefined ? [] : [stop.publicId],
    ),
  );
  if (explicitIds.size > 0) return sourceStops;
  return sourceStops.map((stop, index) => {
    const row = rows[index];
    return row === undefined
      ? stop
      : { ...stop, publicId: stopId(row, index) };
  });
}

function clearPersistedStopIds(stops: readonly StopForm[]): readonly StopForm[] {
  return stops.map((stop) => ({ ...stop, publicId: undefined }));
}

export class TripPlanningClient {
  readonly #baseUrl: string;
  readonly #token: string;
  readonly #signal: AbortSignal | undefined;

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
      method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
      payload?: unknown;
      idempotencyKey?: string;
      acceptedStatuses?: readonly number[];
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
    const accepted = options.acceptedStatuses?.includes(response.status) === true;
    if (!response.ok && !accepted) {
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

  async #createTrip(
    draft: TripDraft,
    driverId: string,
    reason: 'initial' | 'missing' | 'driver-change',
  ): Promise<string> {
    const payload = {
      driverId,
      ruleSetVersion: draft.route.ruleSetVersion,
    };
    const response = await this.#request('/api/trips', {
      method: 'POST',
      payload,
      idempotencyKey: await idempotencyKey('trip-create', {
        draftId: draft.draftId,
        previousTripId: draft.tripId ?? null,
        reason,
        payload,
      }),
    });
    return string(response.tripId, 'tripId');
  }

  async #syncStops(
    tripId: string,
    initialTrip: Record<string, unknown>,
    sourceStops: readonly StopForm[],
  ): Promise<Readonly<{
    trip: Record<string, unknown>;
    stops: readonly StopForm[];
  }>> {
    let trip = initialTrip;
    let revision = revisionNumber(trip);
    let rows = stopRows(trip);
    let stops = hydratePersistedPrefix(rows, sourceStops);
    const serverIds = new Set(rows.map((row, index) => stopId(row, index)));
    stops = stops.map((stop) =>
      stop.publicId !== undefined && !serverIds.has(stop.publicId)
        ? { ...stop, publicId: undefined }
        : stop,
    );

    const desiredIds = new Set(
      stops.flatMap((stop) =>
        stop.publicId === undefined ? [] : [stop.publicId],
      ),
    );
    for (const [index, row] of [...rows].entries()) {
      const id = stopId(row, index);
      if (desiredIds.has(id)) continue;
      const payload = { expectedRevisionNumber: revision };
      const response = await this.#request(
        `/api/trips/${tripId}/stops/${id}`,
        {
          method: 'DELETE',
          payload,
          idempotencyKey: await idempotencyKey('trip-stop-delete', {
            tripId,
            id,
            payload,
          }),
        },
      );
      trip = tripFromOperation(response, 'deleted-stop trip');
      revision = revisionNumber(trip);
      rows = stopRows(trip);
    }

    for (const stop of stops) {
      if (stop.publicId === undefined) continue;
      const rowIndex = rows.findIndex(
        (row, index) => stopId(row, index) === stop.publicId,
      );
      const row = rows[rowIndex];
      if (row === undefined) continue;
      const patch = stopPatch(stop);
      if (equivalent(patch, serverStopPatch(row))) continue;
      const payload = { expectedRevisionNumber: revision, patch };
      const response = await this.#request(
        `/api/trips/${tripId}/stops/${stop.publicId}`,
        {
          method: 'PATCH',
          payload,
          idempotencyKey: await idempotencyKey('trip-stop-patch', {
            tripId,
            stopId: stop.publicId,
            payload,
          }),
        },
      );
      trip = tripFromOperation(response, 'patched-stop trip');
      revision = revisionNumber(trip);
      rows = stopRows(trip);
    }

    for (const stop of stops) {
      if (stop.publicId !== undefined) continue;
      const nextSequence =
        rows.reduce(
          (maximum, row, index) =>
            Math.max(maximum, stopSequence(row, index)),
          0,
        ) + 1;
      const create = createStopPayload(stop, nextSequence);
      const payload = { expectedRevisionNumber: revision, stop: create };
      const response = await this.#request(`/api/trips/${tripId}/stops`, {
        method: 'POST',
        payload,
        idempotencyKey: await idempotencyKey('trip-stop-create', {
          tripId,
          localId: stop.localId,
          payload,
        }),
      });
      trip = tripFromOperation(response, 'created-stop trip');
      revision = revisionNumber(trip);
      rows = stopRows(trip);
      const created = object(response.stop, 'created stop');
      const createdId = string(created.id ?? created.stopId, 'created stop id');
      stops = stops.map((candidate) =>
        candidate.localId === stop.localId
          ? { ...candidate, publicId: createdId }
          : candidate,
      );
    }

    const desiredOrder = stops.map((stop, index) =>
      string(stop.publicId, `desired stop ${String(index + 1)} id`),
    );
    let currentOrder = rows.map((row, index) => stopId(row, index));
    const sequencesAreContiguous = rows.every(
      (row, index) => stopSequence(row, index) === index + 1,
    );
    if (!equivalent(currentOrder, desiredOrder) || !sequencesAreContiguous) {
      const finalStop = stops.at(-1);
      let temporarilyUnlockedFinal = false;
      if (
        finalStop?.publicId !== undefined &&
        finalStop.lockedPosition &&
        currentOrder.indexOf(finalStop.publicId) !== desiredOrder.length - 1
      ) {
        const payload = {
          expectedRevisionNumber: revision,
          patch: { lockedPosition: false },
        };
        const response = await this.#request(
          `/api/trips/${tripId}/stops/${finalStop.publicId}`,
          {
            method: 'PATCH',
            payload,
            idempotencyKey: await idempotencyKey('trip-final-unlock', {
              tripId,
              stopId: finalStop.publicId,
              payload,
            }),
          },
        );
        trip = tripFromOperation(response, 'temporarily unlocked final trip');
        revision = revisionNumber(trip);
        rows = stopRows(trip);
        currentOrder = rows.map((row, index) => stopId(row, index));
        temporarilyUnlockedFinal = true;
      }

      const payload = {
        expectedRevisionNumber: revision,
        stopIds: desiredOrder,
      };
      const response = await this.#request(
        `/api/trips/${tripId}/stops/reorder`,
        {
          method: 'POST',
          payload,
          idempotencyKey: await idempotencyKey('trip-stop-reorder', {
            tripId,
            payload,
          }),
        },
      );
      trip = tripFromOperation(response, 'reordered-stop trip');
      revision = revisionNumber(trip);
      rows = stopRows(trip);

      if (temporarilyUnlockedFinal && finalStop?.publicId !== undefined) {
        const relockPayload = {
          expectedRevisionNumber: revision,
          patch: { lockedPosition: true },
        };
        const relockResponse = await this.#request(
          `/api/trips/${tripId}/stops/${finalStop.publicId}`,
          {
            method: 'PATCH',
            payload: relockPayload,
            idempotencyKey: await idempotencyKey('trip-final-relock', {
              tripId,
              stopId: finalStop.publicId,
              payload: relockPayload,
            }),
          },
        );
        trip = tripFromOperation(relockResponse, 'relocked final trip');
      }
    }

    return { trip, stops };
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

    let tripId: string;
    let startsNewTrip = false;
    if (savedDraft.tripId === undefined) {
      tripId = await this.#createTrip(savedDraft, driverId, 'initial');
      startsNewTrip = true;
    } else {
      tripId = savedDraft.tripId;
    }

    let trip: Record<string, unknown>;
    try {
      trip = await this.#request(`/api/trips/${tripId}`);
    } catch (error) {
      if (!(error instanceof PlanningApiError) || error.statusCode !== 404) {
        throw error;
      }
      tripId = await this.#createTrip(savedDraft, driverId, 'missing');
      startsNewTrip = true;
      trip = await this.#request(`/api/trips/${tripId}`);
    }

    if (string(trip.driverId, 'trip.driverId') !== driverId) {
      tripId = await this.#createTrip(savedDraft, driverId, 'driver-change');
      startsNewTrip = true;
      trip = await this.#request(`/api/trips/${tripId}`);
    }

    const workingDraft: TripDraft = {
      ...savedDraft,
      tripId,
      stops: startsNewTrip
        ? clearPersistedStopIds(savedDraft.stops)
        : savedDraft.stops,
    };
    let revision = revisionNumber(trip);
    const equipment = object(trip.equipment, 'trip.equipment');
    const patch: Record<string, unknown> = {};
    if (nullableString(equipment.tractorId, 'trip.equipment.tractorId') !== tractorId) {
      patch.tractorId = tractorId;
    }
    if (nullableString(equipment.trailerId, 'trip.equipment.trailerId') !== trailerId) {
      patch.trailerId = trailerId;
    }
    if (nullableString(equipment.loadId, 'trip.equipment.loadId') !== loadId) {
      patch.loadId = loadId;
    }
    if (trip.ruleSetVersion !== workingDraft.route.ruleSetVersion) {
      patch.ruleSetVersion = workingDraft.route.ruleSetVersion;
    }
    if (Object.keys(patch).length > 0) {
      const payload = { expectedRevisionNumber: revision, ...patch };
      const response = await this.#request(`/api/trips/${tripId}`, {
        method: 'PATCH',
        payload,
        idempotencyKey: await idempotencyKey('trip-patch', {
          tripId,
          payload,
        }),
      });
      trip = tripFromOperation(response, 'patched trip');
    }

    const synchronized = await this.#syncStops(
      tripId,
      trip,
      workingDraft.stops,
    );
    trip = synchronized.trip;
    revision = revisionNumber(trip);
    const persistedDraft: TripDraft = {
      ...workingDraft,
      stops: synchronized.stops,
    };
    saveDraft(persistedDraft);

    const routeInput = routeRequestFromDraft(
      persistedDraft,
      persistedDraft.stops,
    );
    if (routeInput.status === 'blocked') {
      return {
        draft: persistedDraft,
        outcome: {
          status: 'blocked',
          message:
            'Equipment or load evidence is incomplete for commercial routing.',
          tripId,
          revisionNumber: revision,
          warnings: routeInput.issues.map((issue) => issue.message),
        },
      };
    }

    const routeResponse = await this.#request('/api/routes/validate', {
      method: 'POST',
      payload: routeInput.request,
      acceptedStatuses: [422],
    });
    const routePayload = { ...object(routeResponse.route, 'route') };
    delete routePayload.assessment;
    const route = assessCommercialRoute(routePayload);
    if (route.assessment.commercialPlanningStatus === 'blocked') {
      return {
        draft: persistedDraft,
        outcome: {
          status: 'blocked',
          message: 'The commercial route requires correction or manual verification.',
          tripId,
          revisionNumber: revision,
          warnings: route.assessment.blockingReasons,
        },
      };
    }

    const simulation = {
      ...simulationInputFromDraft(persistedDraft, driverId, route),
      stops: persistedDraft.stops.map((stop, index) =>
        stopPlan(stop, index + 1),
      ),
      revisionReference: 'server-replaces-this-reference',
    };
    const calculationPayload = {
      expectedRevisionNumber: revision,
      simulation,
    };
    const calculationResponse = await this.#request(
      `/api/trips/${tripId}/calculate`,
      {
        method: 'POST',
        payload: calculationPayload,
        idempotencyKey: await idempotencyKey(
          'trip-calculate',
          { tripId, calculationPayload },
        ),
        acceptedStatuses: [422],
      },
    );
    const calculatedTrip = object(
      calculationResponse.trip,
      'calculated trip',
    );
    const calculation = object(calculationResponse.calculation, 'calculation');
    const expected = object(calculation.expected, 'expected calculation');
    const explanations = Array.isArray(expected.explanations)
      ? expected.explanations.filter(
          (value): value is string => typeof value === 'string',
        )
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
        revisionNumber: revisionNumber(calculatedTrip),
        ...(typeof expected.confidence === 'string'
          ? { confidence: expected.confidence }
          : {}),
        warnings: explanations,
      },
    };
  }
}
