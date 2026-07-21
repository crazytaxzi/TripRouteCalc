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
      readyStop(base.stops[0]!, 'Denver origin', 39.7392, -104.9903),
      readyStop(base.stops[1]!, 'Colorado Springs destination', 38.8339, -104.8214),
    ],
    route: { ...base.route, ruleSetVersion: 'reviewed-fixture-v1' },
  };
}

function routePayload(): Readonly<Record<string, unknown>> {
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
        originReferenceId: 'stop-public-1',
        destinationStopId: 'stop-public-2',
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Stage 18 planning API client', () => {
  it('saves profiles, revisions, stops, route evidence, and calculation in order', async () => {
    let revision = 1;
    const publicStops: Record<string, unknown>[] = [];
    const writes: string[] = [];

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = new URL(String(input), 'https://trip.example');
        const method = init?.method ?? 'GET';
        if (method !== 'GET') {
          writes.push(`${method} ${url.pathname}`);
          const headers = new Headers(init?.headers);
          if (url.pathname !== '/api/routes/validate') {
            expect(headers.get('idempotency-key')).toMatch(/^stage18-/u);
          }
        }

        if (url.pathname === '/api/drivers' && method === 'POST') {
          return json({ driverId: 'driver-public-1' }, 201);
        }
        if (url.pathname === '/api/equipment/tractors' && method === 'POST') {
          return json({ tractorId: 'tractor-public-1' }, 201);
        }
        if (url.pathname === '/api/equipment/trailers' && method === 'POST') {
          return json({ trailerId: 'trailer-public-1' }, 201);
        }
        if (url.pathname === '/api/equipment/loads' && method === 'POST') {
          return json({ loadId: 'load-public-1' }, 201);
        }
        if (url.pathname === '/api/trips' && method === 'POST') {
          return json(
            {
              tripId: 'trip-public-1',
              currentRevision: { revisionNumber: revision },
              stops: [],
            },
            201,
          );
        }
        if (url.pathname === '/api/trips/trip-public-1' && method === 'PATCH') {
          revision += 1;
          return json({
            tripId: 'trip-public-1',
            currentRevision: { revisionNumber: revision },
            stops: publicStops,
          });
        }
        if (
          url.pathname === '/api/trips/trip-public-1/stops' &&
          method === 'POST'
        ) {
          revision += 1;
          publicStops.push({
            stopId: `stop-public-${String(publicStops.length + 1)}`,
          });
          return json(
            {
              tripId: 'trip-public-1',
              currentRevision: { revisionNumber: revision },
              stops: publicStops,
            },
            201,
          );
        }
        if (url.pathname === '/api/routes/validate' && method === 'POST') {
          return json({ route: routePayload() });
        }
        if (
          url.pathname === '/api/trips/trip-public-1/calculate' &&
          method === 'POST'
        ) {
          revision += 1;
          return json(
            {
              trip: {
                tripId: 'trip-public-1',
                currentRevision: { revisionNumber: revision },
              },
              calculation: {
                expected: {
                  status: 'COMPLETE',
                  confidence: 'LOW',
                  explanations: [
                    'Live traffic and weather evidence are unavailable.',
                  ],
                },
              },
            },
            201,
          );
        }
        throw new Error(`Unexpected request: ${method} ${url.pathname}`);
      },
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new TripPlanningClient({
      baseUrl: 'https://trip.example',
      token: 'test-bearer-token',
    });
    const result = await client.submitDraft(validDraft());

    expect(result.outcome.status).toBe('complete');
    expect(result.outcome.tripId).toBe('trip-public-1');
    expect(result.outcome.revisionNumber).toBe(5);
    expect(result.draft.driver.id).toBe('driver-public-1');
    expect(result.draft.stops.map((stop) => stop.publicId)).toEqual([
      'stop-public-1',
      'stop-public-2',
    ]);
    expect(writes).toEqual([
      'POST /api/drivers',
      'POST /api/equipment/tractors',
      'POST /api/equipment/trailers',
      'POST /api/equipment/loads',
      'POST /api/trips',
      'PATCH /api/trips/trip-public-1',
      'POST /api/trips/trip-public-1/stops',
      'POST /api/trips/trip-public-1/stops',
      'POST /api/routes/validate',
      'POST /api/trips/trip-public-1/calculate',
    ]);
  });
});
