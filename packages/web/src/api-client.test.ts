// @vitest-environment jsdom

import {
  distanceInMiles,
  durationInMinutes,
  speedInMilesPerHour,
  utcInstant,
} from '@trip-route-calc/foundation';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TripPlanningClient } from './api-client.js';
import { defaultTripDraft } from './model.js';
import type { StopForm, TripDraft } from './types.js';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function requestBody(init?: RequestInit): Record<string, unknown> {
  if (typeof init?.body !== 'string') return {};
  const parsed: unknown = JSON.parse(init.body);
  if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new TypeError('Test request body was not an object.');
  }
  return parsed as Record<string, unknown>;
}

function readyStop(
  stop: StopForm,
  description: string,
  latitude: number,
  longitude: number,
): StopForm {
  return {
    ...stop,
    locationDescription: description,
    addressText: description,
    latitude,
    longitude,
    timeZone: 'America/Denver',
  };
}

function validDraft(): TripDraft {
  const base = defaultTripDraft();
  const start = base.stops[0];
  const final = base.stops[1];
  if (start === undefined || final === undefined) {
    throw new Error('Default trip did not include structural endpoint stops.');
  }
  return {
    ...base,
    driver: { displayName: 'Workflow Driver' },
    tractor: { ...base.tractor, unitNumber: 'TR-180' },
    trailer: { ...base.trailer, unitNumber: 'TL-180' },
    load: {
      ...base.load,
      referenceNumber: 'LOAD-180',
      commodityDescription: 'General freight',
      permitRequirement: 'not-required',
    },
    stops: [
      readyStop(start, 'Denver origin', 39.7392, -104.9903),
      readyStop(final, 'Colorado Springs destination', 38.8339, -104.8214),
    ],
    route: { ...base.route, ruleSetVersion: 'reviewed-fixture-v1' },
  };
}

function routePayload(
  originStopId: string,
  destinationStopId: string,
): Readonly<Record<string, unknown>> {
  const geometry = {
    format: 'geojson-line-string',
    coordinates: [
      [-104.9903, 39.7392],
      [-104.8214, 38.8339],
    ],
  };
  return {
    routeId: 'route-public-1',
    routeKind: 'commercial-vehicle',
    provider: {
      providerName: 'licensed-test-provider',
      providerVersion: 'fixture-v1',
      providerRequestId: 'provider-request-1',
      requestedAt: utcInstant('2026-07-21T18:00:00.000Z'),
      respondedAt: utcInstant('2026-07-21T18:00:01.000Z'),
      confidence: 'high',
    },
    totalDistance: distanceInMiles(70),
    travelDuration: durationInMinutes(90),
    geometry,
    legs: [
      {
        legId: 'leg-public-1',
        sequence: 1,
        originReferenceId: originStopId,
        destinationStopId,
        distance: distanceInMiles(70),
        travelDuration: durationInMinutes(90),
        geometry,
        segments: [
          {
            segmentId: 'segment-public-1',
            sequence: 1,
            distance: distanceInMiles(70),
            travelDuration: durationInMinutes(90),
            geometry,
            expectedSpeed: speedInMilesPerHour(47),
            jurisdictionCodes: ['US-CO'],
            verificationStatus: 'verified',
            restrictions: [],
            unavailableFields: [],
          },
        ],
        unavailableFields: [],
      },
    ],
    restrictions: [],
    unavailableFields: [],
    assessment: {
      commercialPlanningStatus: 'usable',
      providerVerificationStatus: 'commercial-provider-verified',
      legalFinalizationStatus: 'blocked-pending-regulatory-evaluation',
      blockingReasons: [],
      confidenceReasons: [],
    },
  };
}

interface WorkflowServer {
  readonly fetchMock: ReturnType<typeof vi.fn>;
  readonly writes: string[];
  readonly stopWrites: string[];
  readonly calculationTripIds: string[];
  revision(): number;
}

function workflowServer(options: {
  readonly blockedCalculation?: boolean;
} = {}): WorkflowServer {
  let revision = 1;
  let ruleSetVersion = 'reviewed-fixture-v1';
  const tripId = 'trip-public-1';
  const driverId = 'driver-public-1';
  const equipment: Record<string, string | null> = {
    tractorId: null,
    trailerId: null,
    loadId: null,
  };
  const stops: Record<string, unknown>[] = [];
  const writes: string[] = [];
  const stopWrites: string[] = [];
  const calculationTripIds: string[] = [];

  const tripBody = (): Record<string, unknown> => ({
    tripId,
    driverId,
    currentRevision: { revisionNumber: revision },
    equipment: { ...equipment },
    ruleSetVersion,
    stops: stops.map((stop) => ({ ...stop })),
  });

  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = new URL(String(input), 'https://trip.example');
      const method = init?.method ?? 'GET';
      if (method !== 'GET') {
        const write = `${method} ${url.pathname}`;
        writes.push(write);
        if (url.pathname.includes('/stops')) stopWrites.push(write);
        const headers = new Headers(init?.headers);
        if (url.pathname !== '/api/routes/validate') {
          expect(headers.get('idempotency-key')).toMatch(/^stage18-/u);
        }
      }

      if (url.pathname === '/api/drivers' && method === 'POST') {
        return json({ driverId }, 201);
      }
      if (url.pathname === `/api/drivers/${driverId}` && method === 'PATCH') {
        return json({ driverId });
      }
      if (url.pathname === '/api/equipment/tractors' && method === 'POST') {
        return json({ tractorId: 'tractor-public-1' }, 201);
      }
      if (
        url.pathname === '/api/equipment/tractors/tractor-public-1' &&
        method === 'PATCH'
      ) {
        return json({ tractorId: 'tractor-public-1' });
      }
      if (url.pathname === '/api/equipment/trailers' && method === 'POST') {
        return json({ trailerId: 'trailer-public-1' }, 201);
      }
      if (
        url.pathname === '/api/equipment/trailers/trailer-public-1' &&
        method === 'PATCH'
      ) {
        return json({ trailerId: 'trailer-public-1' });
      }
      if (url.pathname === '/api/equipment/loads' && method === 'POST') {
        return json({ loadId: 'load-public-1' }, 201);
      }
      if (
        url.pathname === '/api/equipment/loads/load-public-1' &&
        method === 'PATCH'
      ) {
        return json({ loadId: 'load-public-1' });
      }
      if (url.pathname === '/api/trips' && method === 'POST') {
        return json(tripBody(), 201);
      }
      if (url.pathname === `/api/trips/${tripId}` && method === 'GET') {
        return json(tripBody());
      }
      if (url.pathname === `/api/trips/${tripId}` && method === 'PATCH') {
        const body = requestBody(init);
        if (typeof body.tractorId === 'string') equipment.tractorId = body.tractorId;
        if (typeof body.trailerId === 'string') equipment.trailerId = body.trailerId;
        if (typeof body.loadId === 'string') equipment.loadId = body.loadId;
        if (typeof body.ruleSetVersion === 'string') {
          ruleSetVersion = body.ruleSetVersion;
        }
        revision += 1;
        return json(tripBody());
      }
      if (
        url.pathname === `/api/trips/${tripId}/stops` &&
        method === 'POST'
      ) {
        const body = requestBody(init);
        const stop = body.stop;
        if (stop === null || Array.isArray(stop) || typeof stop !== 'object') {
          throw new TypeError('Create-stop body did not include a stop object.');
        }
        const row = {
          id: `stop-public-${String(stops.length + 1)}`,
          ...(stop as Record<string, unknown>),
        };
        stops.push(row);
        revision += 1;
        return json({ trip: tripBody(), stop: row }, 201);
      }
      if (url.pathname === '/api/routes/validate' && method === 'POST') {
        const first = stops[0];
        const last = stops.at(-1);
        if (first === undefined || last === undefined) {
          throw new Error('Route validation occurred before stops were persisted.');
        }
        return json({
          route: routePayload(String(first.id), String(last.id)),
        });
      }
      if (
        url.pathname === `/api/trips/${tripId}/calculate` &&
        method === 'POST'
      ) {
        calculationTripIds.push(tripId);
        revision += 1;
        const blocked = options.blockedCalculation === true;
        return json(
          {
            trip: tripBody(),
            calculation: {
              expected: {
                status: blocked ? 'BLOCKED' : 'COMPLETE',
                confidence: 'LOW',
                explanations: [
                  blocked
                    ? 'Production regulatory evidence is unavailable.'
                    : 'Live traffic and weather evidence are unavailable.',
                ],
              },
            },
            ...(blocked
              ? {
                  blocking: {
                    code: 'LEGAL_BLOCKING_FINDING',
                    reasons: ['Production regulatory evidence is unavailable.'],
                  },
                }
              : {}),
          },
          blocked ? 422 : 201,
        );
      }
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    },
  );

  return {
    fetchMock,
    writes,
    stopWrites,
    calculationTripIds,
    revision: () => revision,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Stage 18 planning API client', () => {
  it('persists the real nested stop response and resumes the same trip', async () => {
    const server = workflowServer();
    vi.stubGlobal('fetch', server.fetchMock);

    const client = new TripPlanningClient({
      baseUrl: 'https://trip.example',
      token: 'test-bearer-token',
    });
    const first = await client.submitDraft(validDraft());

    expect(first.outcome.status).toBe('complete');
    expect(first.outcome.tripId).toBe('trip-public-1');
    expect(first.outcome.revisionNumber).toBe(5);
    expect(first.draft.tripId).toBe('trip-public-1');
    expect(first.draft.driver.id).toBe('driver-public-1');
    expect(first.draft.stops.map((stop) => stop.publicId)).toEqual([
      'stop-public-1',
      'stop-public-2',
    ]);
    expect(server.stopWrites).toEqual([
      'POST /api/trips/trip-public-1/stops',
      'POST /api/trips/trip-public-1/stops',
    ]);

    const stopWriteCount = server.stopWrites.length;
    const second = await client.submitDraft(first.draft);

    expect(second.outcome.status).toBe('complete');
    expect(second.outcome.tripId).toBe('trip-public-1');
    expect(second.outcome.revisionNumber).toBe(6);
    expect(second.draft.tripId).toBe('trip-public-1');
    expect(server.stopWrites).toHaveLength(stopWriteCount);
    expect(server.calculationTripIds).toEqual([
      'trip-public-1',
      'trip-public-1',
    ]);
    expect(
      server.writes.filter((write) => write === 'POST /api/trips'),
    ).toHaveLength(1);
  });

  it('returns and preserves a structured blocked calculation response', async () => {
    const server = workflowServer({ blockedCalculation: true });
    vi.stubGlobal('fetch', server.fetchMock);

    const client = new TripPlanningClient({
      baseUrl: 'https://trip.example',
      token: 'test-bearer-token',
    });
    const result = await client.submitDraft(validDraft());

    expect(result.outcome.status).toBe('blocked');
    expect(result.outcome.message).toMatch(/legal or evidence blocker/iu);
    expect(result.outcome.warnings).toContain(
      'Production regulatory evidence is unavailable.',
    );
    expect(result.outcome.revisionNumber).toBe(server.revision());
    expect(result.draft.tripId).toBe('trip-public-1');
    expect(result.draft.stops.every((stop) => stop.publicId !== undefined)).toBe(
      true,
    );
  });
});
