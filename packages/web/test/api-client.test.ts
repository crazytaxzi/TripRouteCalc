import { afterEach, describe, expect, it, vi } from 'vitest';

import { TripSetupApiClient, createStopPayload } from '../src/api-client.js';
import {
  createStage18CompleteFacts,
  defaultStopPlanningFacts,
  saveStage18CompleteFacts,
} from '../src/stage18-details.js';
import type { Stage18CompleteFacts } from '../src/stage18-details.js';
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
    tractor: {
      selectedId: 'tractor-public-id',
      displayName: 'TR-1',
    },
    trailer: {
      selectedId: 'trailer-public-id',
      displayName: 'TL-1',
    },
    load: { selectedId: 'load-public-id', displayName: 'LD-1' },
    departureAt: '2026-07-23T10:00',
    departureTimeZone: 'America/Boise',
    currentDutyStatus: 'on_duty_not_driving',
    currentDutyStatusBeganAt: '2026-07-23T09:30',
    clocks: {
      driveMinutesRemaining: 600,
      shiftMinutesRemaining: 780,
      cycleMinutesRemaining: 3_600,
    },
    hos: {
      ...initial.hos,
      cycleType: '70_in_8',
      provenance: 'user_entered',
      qualifyingTenHourBreakCompleted: true,
      offDutyBeforeDepartureMinutes: 600,
      priorDutyTotals: Array.from({ length: 8 }, (_, index) => ({
        date: `2026-07-${String(index + 15).padStart(2, '0')}`,
        onDutyMinutes: 480,
      })),
    },
    stops: initial.stops.map((stop, index) => ({
      ...stop,
      serverId: `stop-public-id-${String(index + 1)}`,
      address: `Stop ${String(index + 1)} address`,
      appointment: { ...stop.appointment, timeZone: 'America/Boise' },
    })),
  };
}

function completeFacts(state: TripSetupState): Stage18CompleteFacts {
  const initial = createStage18CompleteFacts();
  return {
    ...initial,
    driver: {
      id: state.driver.selectedId || undefined,
      displayName: state.driver.displayName,
      dirty: false,
    },
    tractor: {
      ...initial.tractor,
      ...(state.tractor.selectedId === '' ? {} : { id: state.tractor.selectedId }),
      dirty: state.tractor.selectedId === '',
      unitNumber: 'TR-1',
      axleCount: 3,
      overallLengthFeet: 20,
      heightFeet: 13,
      widthInches: 96,
      registeredGrossWeightPounds: 80_000,
      governedSpeedMph: 65,
      planningCruiseSpeedMph: 55,
      sourceType: 'measured',
      sourceName: 'Carrier equipment record',
    },
    trailer: {
      ...initial.trailer,
      ...(state.trailer.selectedId === '' ? {} : { id: state.trailer.selectedId }),
      dirty: state.trailer.selectedId === '',
      trailerNumber: 'TL-1',
      lengthFeet: 53,
      heightFeet: 13.5,
      widthInches: 102,
      currentKpraFeet: 40,
      minimumKpraFeet: 37,
      maximumKpraFeet: 43,
      maximumPayloadPounds: 54_000,
      sourceType: 'measured',
      sourceName: 'Physical measurements',
    },
    load: {
      ...initial.load,
      ...(state.load.selectedId === '' ? {} : { id: state.load.selectedId }),
      dirty: state.load.selectedId === '',
      loadIdentifier: 'LD-1',
      commodity: 'Palletized food',
      grossCargoWeightPounds: 42_000,
      steerAxleWeightPounds: 12_000,
      driveAxleWeightPounds: 33_000,
      trailerAxleWeightPounds: 33_000,
      totalGrossCombinationWeightPounds: 78_000,
      lengthFeet: 48,
      widthFeet: 8,
      heightFeet: 8,
      permitRequirement: 'not-required',
      sourceType: 'measured',
      sourceName: 'Scale and bill of lading',
    },
    route: {
      policy: 'balanced-compliant',
      avoidances: ['ferries', 'unpaved-roads'],
    },
    stops: Object.fromEntries(
      state.stops.map((stop, index) => [
        stop.localId,
        {
          ...defaultStopPlanningFacts(stop),
          latitude: 43.6 + index,
          longitude: -116.2 - index,
          resolutionStatus: 'user-confirmed',
          sourceName: 'User-confirmed map pin',
          checkInMinutes: 15,
          serviceMode: 'expected',
          serviceMinutes: 60,
          instructions: 'Use the truck entrance.',
        },
      ]),
    ),
  };
}

function seedFacts(state: TripSetupState): void {
  saveStage18CompleteFacts(completeFacts(state));
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
  it('uses entered facts and explicit route choices without browser-authored route objects', async (): Promise<void> => {
    const state = completeState();
    seedFacts(state);
    const fetchMock = vi.fn<typeof fetch>((): Promise<Response> =>
      Promise.resolve(
        jsonResponse(
          { calculationId: 'calc-1', revisionNumber: 8, status: 'AVAILABLE' },
          201,
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: (): string => 'request-key-1234' });
    const client = new TripSetupApiClient('/api', (): string => 'token');

    await client.calculate(state);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/trips/trip-public-id/plan',
    );
    const request = fetchMock.mock.calls[0]?.[1];
    if (request?.body === undefined || typeof request.body !== 'string') {
      throw new Error('Planning request did not contain a JSON body.');
    }
    const body = JSON.parse(request.body) as Record<string, unknown>;
    expect(body).toMatchObject({
      expectedRevisionNumber: 7,
      departureAt: '2026-07-23T10:00:00-06:00',
      currentDutyStatusBeganAt: '2026-07-23T09:30:00-06:00',
      routePolicy: 'balanced-compliant',
      avoidances: ['ferries', 'unpaved-roads'],
      hos: {
        cycleType: '70_in_8',
        provenance: 'user_entered',
        priorDutyTotals: state.hos.priorDutyTotals,
      },
    });
    expect(body).not.toHaveProperty('simulation');
    expect(body).not.toHaveProperty('route');
    expect(body).not.toHaveProperty('operationalEvents');
    expect(body).not.toHaveProperty('complianceActions');
  });

  it('creates reusable profiles, trip, and complete stops while chaining revisions', async (): Promise<void> => {
    const initial = createInitialTripSetupState();
    const state: TripSetupState = {
      ...initial,
      driver: { selectedId: '', displayName: 'Driver One' },
      stops: initial.stops.map((stop, index) => ({
        ...stop,
        address: `Stop ${String(index + 1)} address`,
        appointment: { ...stop.appointment, timeZone: 'America/Boise' },
      })),
    };
    seedFacts(state);
    const responses = [
      jsonResponse({ driverId: 'driver-1', displayName: 'Driver One' }, 201),
      jsonResponse({ tractorId: 'tractor-1' }, 201),
      jsonResponse({ trailerId: 'trailer-1' }, 201),
      jsonResponse({ loadId: 'load-1' }, 201),
      jsonResponse(
        { tripId: 'trip-1', currentRevision: { revisionNumber: 1 } },
        201,
      ),
      tripResponse(2),
      jsonResponse(
        { trip: { tripId: 'trip-1', currentRevision: { revisionNumber: 3 } }, stop: { id: 'stop-1' } },
        201,
      ),
      jsonResponse(
        { trip: { tripId: 'trip-1', currentRevision: { revisionNumber: 4 } }, stop: { id: 'stop-2' } },
        201,
      ),
      jsonResponse(
        { trip: { tripId: 'trip-1', currentRevision: { revisionNumber: 5 } }, stop: { id: 'stop-3' } },
        201,
      ),
      tripResponse(6),
    ];
    const fetchMock = vi.fn<typeof fetch>((): Promise<Response> => {
      const response = responses.shift();
      return response === undefined
        ? Promise.reject(new Error('Unexpected request.'))
        : Promise.resolve(response);
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: (): string => 'request-key-1234' });
    const client = new TripSetupApiClient('/api', (): string => 'token');

    const saved = await client.save(state);

    expect(saved.tripId).toBe('trip-1');
    expect(saved.revisionNumber).toBe(6);
    expect(saved.driver.selectedId).toBe('driver-1');
    expect(saved.tractor.selectedId).toBe('tractor-1');
    expect(saved.trailer.selectedId).toBe('trailer-1');
    expect(saved.load.selectedId).toBe('load-1');
    expect(saved.stops.map((stop) => stop.serverId)).toEqual([
      'stop-1',
      'stop-2',
      'stop-3',
    ]);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/drivers',
      '/api/equipment/tractors',
      '/api/equipment/trailers',
      '/api/equipment/loads',
      '/api/trips',
      '/api/trips/trip-1',
      '/api/trips/trip-1/stops',
      '/api/trips/trip-1/stops',
      '/api/trips/trip-1/stops',
      '/api/trips/trip-1/stops/reorder',
    ]);
  });

  it('synchronizes persisted deletes, patches, and reorder revisions', async (): Promise<void> => {
    const state = completeState();
    seedFacts(state);
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
    vi.stubGlobal('crypto', { randomUUID: (): string => 'request-key-1234' });
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

  it('serializes complete stop evidence and separate operational facts', (): void => {
    const state = completeState();
    seedFacts(state);
    const stop = state.stops[0];
    if (stop === undefined) throw new Error('Initial stop missing.');
    const payload = createStopPayload({ ...stop, label: 'Origin' });

    expect(payload).toMatchObject({
      sequence: 1,
      type: 'start-location',
      location: {
        description: 'Origin',
        latitude: 43.6,
        longitude: -116.2,
        resolutionStatus: 'user-confirmed',
        sourceName: 'User-confirmed map pin',
      },
      checkInDuration: { value: 15, unit: 'minute' },
      waitingDutyStatus: 'ON_DUTY_NOT_DRIVING',
      checkInDutyStatus: 'ON_DUTY_NOT_DRIVING',
      serviceDutyStatus: 'ON_DUTY_NOT_DRIVING',
      instructions: 'Use the truck entrance.',
    });
  });
});
