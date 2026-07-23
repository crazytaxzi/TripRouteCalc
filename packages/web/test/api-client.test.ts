import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  TripSetupApiClient,
  createStopPayload,
} from '../src/api-client.js';
import {
  createInitialTripSetupState,
  type TripSetupState,
} from '../src/model.js';

function completeState(): TripSetupState {
  const initial = createInitialTripSetupState();
  return {
    ...initial,
    tripId: 'trip-public-id',
    revisionNumber: 7,
    driver: { selectedId: 'driver-public-id', displayName: 'Driver One' },
    tractor: { selectedId: 'tractor-public-id', displayName: 'tractor-public-id' },
    trailer: { selectedId: 'trailer-public-id', displayName: 'trailer-public-id' },
    load: { selectedId: 'load-public-id', displayName: 'load-public-id' },
    departureAt: '2026-07-22T10:00',
    currentDutyStatus: 'on_duty_not_driving',
    currentDutyStatusBeganAt: '2026-07-22T09:30',
    clocks: {
      driveMinutesRemaining: 600,
      shiftMinutesRemaining: 780,
      cycleMinutesRemaining: 3_600,
    },
    stops: initial.stops.map((stop, index) => ({
      ...stop,
      serverId: `stop-public-id-${String(index + 1)}`,
      address: `Stop ${String(index + 1)} address`,
    })),
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function tripResponse(revisionNumber: number): Response {
  return jsonResponse({
    tripId: 'trip-1',
    currentRevision: { revisionNumber },
  });
}

afterEach((): void => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Stage 18 API transport', () => {
  it('uses the accepted singular calculate endpoint', async (): Promise<void> => {
    const fetchMock = vi.fn<typeof fetch>((): Promise<Response> =>
      Promise.resolve(
        jsonResponse(
          { calculationId: 'calc-1', revisionNumber: 8, status: 'AVAILABLE' },
          201,
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const client = new TripSetupApiClient('/api', (): string => 'token');

    await client.calculate(completeState());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/trips/trip-public-id/calculate',
    );
  });

  it('creates driver, trip, and stops while chaining revisions', async (): Promise<void> => {
    const responses = [
      jsonResponse({ driverId: 'driver-1', displayName: 'Driver One' }, 201),
      jsonResponse(
        { tripId: 'trip-1', currentRevision: { revisionNumber: 1 } },
        201,
      ),
      jsonResponse(
        {
          trip: { tripId: 'trip-1', currentRevision: { revisionNumber: 2 } },
          stop: { id: 'stop-1' },
        },
        201,
      ),
      jsonResponse(
        {
          trip: { tripId: 'trip-1', currentRevision: { revisionNumber: 3 } },
          stop: { id: 'stop-2' },
        },
        201,
      ),
      jsonResponse(
        {
          trip: { tripId: 'trip-1', currentRevision: { revisionNumber: 4 } },
          stop: { id: 'stop-3' },
        },
        201,
      ),
      tripResponse(5),
    ];
    const fetchMock = vi.fn<typeof fetch>((): Promise<Response> => {
      const response = responses.shift();
      if (response === undefined) {
        return Promise.reject(new Error('Unexpected request.'));
      }
      return Promise.resolve(response);
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new TripSetupApiClient('/api', (): string => 'token');
    const initial = createInitialTripSetupState();
    const saved = await client.save({
      ...initial,
      driver: { selectedId: '', displayName: 'Driver One' },
      stops: initial.stops.map((stop, index) => ({
        ...stop,
        address: `Stop ${String(index + 1)} address`,
      })),
    });

    expect(saved.tripId).toBe('trip-1');
    expect(saved.revisionNumber).toBe(5);
    expect(saved.driver.selectedId).toBe('driver-1');
    expect(saved.stops.map((stop) => stop.serverId)).toEqual([
      'stop-1',
      'stop-2',
      'stop-3',
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(fetchMock.mock.calls[5]?.[0]).toBe('/api/trips/trip-1/stops/reorder');
  });

  it('synchronizes persisted deletes, patches, and reorder revisions', async (): Promise<void> => {
    const state = completeState();
    const responses = [
      tripResponse(8),
      tripResponse(9),
      tripResponse(10),
      tripResponse(11),
      tripResponse(12),
      tripResponse(13),
    ];
    const fetchMock = vi.fn<typeof fetch>((): Promise<Response> => {
      const response = responses.shift();
      return response === undefined
        ? Promise.reject(new Error('Unexpected request.'))
        : Promise.resolve(response);
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new TripSetupApiClient('/api', (): string => 'token');

    const saved = await client.save({
      ...state,
      deletedServerStopIds: ['removed-stop-id'],
      stops: state.stops.map((stop, index) => ({
        ...stop,
        label: `Updated ${String(index + 1)}`,
      })),
    });

    expect(saved.revisionNumber).toBe(13);
    expect(saved.deletedServerStopIds).toEqual([]);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/trips/trip-public-id',
      '/api/trips/trip-public-id/stops/removed-stop-id',
      '/api/trips/trip-public-id/stops/stop-public-id-1',
      '/api/trips/trip-public-id/stops/stop-public-id-2',
      '/api/trips/trip-public-id/stops/stop-public-id-3',
      '/api/trips/trip-public-id/stops/reorder',
    ]);
  });

  it('serializes stop fields into the accepted Stage 17 contract', (): void => {
    const initialStop = createInitialTripSetupState().stops[0];
    if (initialStop === undefined) throw new Error('Initial stop missing.');
    const stop = {
      ...initialStop,
      address: '123 Main St',
      label: 'Origin',
    };
    const payload = createStopPayload(stop);

    expect(payload).toMatchObject({
      sequence: 1,
      type: 'start-location',
      location: {
        description: 'Origin',
        addressText: '123 Main St',
        resolutionStatus: 'user-confirmed',
      },
      checkInDutyStatus: 'ON_DUTY_NOT_DRIVING',
      serviceDutyStatus: 'ON_DUTY_NOT_DRIVING',
    });
  });
});
