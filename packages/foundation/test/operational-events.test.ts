import {
  OPERATIONAL_EVENT_TYPES,
  distanceInMiles,
  durationInMinutes,
  ianaTimeZone,
  operationalPlanSnapshot,
  planFuelStops,
  scheduleOperationalEvent,
  selectOperationalLocation,
  utcInstant,
  validateOperationalEventPlan,
  volumeInUsGallons,
} from '../src/index.js';
import type {
  OperationalEventPlan,
  OperationalEventSource,
  OperationalLocation,
} from '../src/index.js';
import { describe, expect, it } from 'vitest';

import { departureState } from './hos-test-fixtures.js';

const providerSource: OperationalEventSource = Object.freeze({
  type: 'VERIFIED_LOCATION_PROVIDER',
  sourceName: 'Test-only truck location provider',
  reference: 'fixture://truck-locations',
  verifiedAt: utcInstant('2026-07-20T00:00:00Z'),
  explanation: 'Deterministic Stage 14 fixture source.',
});

const userSource: OperationalEventSource = Object.freeze({
  type: 'USER_OVERRIDE',
  sourceName: 'Test-only user override',
  explanation: 'Deterministic Stage 14 fixture override.',
});

function location(
  locationId: string,
  routeMiles: number,
  capabilities: OperationalLocation['capabilities'],
  options: Readonly<{
    truckCompatible?: boolean;
    source?: OperationalEventSource;
  }> = {},
): OperationalLocation {
  return {
    locationId,
    description: `Test-only location ${locationId}`,
    timeZone: ianaTimeZone('America/Los_Angeles'),
    routeDistance: distanceInMiles(routeMiles),
    truckCompatible: options.truckCompatible ?? true,
    capabilities,
    source: options.source ?? providerSource,
  };
}

function plan(
  type: OperationalEventPlan['type'],
  options: Partial<OperationalEventPlan> = {},
): OperationalEventPlan {
  const placementKind =
    type === 'PRE_TRIP_INSPECTION'
      ? 'BEFORE_FIRST_DRIVE'
      : type === 'POST_TRIP_INSPECTION'
        ? 'AFTER_FINAL_DRIVE'
        : 'FLEXIBLE';
  const normallyOnDuty = !['MEAL', 'SHOWER'].includes(type);
  return validateOperationalEventPlan({
    eventId: `event-${type}`,
    type,
    duration: { mode: 'EXACT', duration: durationInMinutes(30) },
    dutyStatus: normallyOnDuty ? 'ON_DUTY_NOT_DRIVING' : 'OFF_DUTY',
    source: userSource,
    location: location('explicit', 0, []),
    placement: { kind: placementKind },
    allowThirtyMinuteInterruptionOverlap: true,
    allowRestOverlap: !normallyOnDuty,
    required: true,
    userOverride: true,
    explanation: `Test-only ${type} event.`,
    ...options,
  });
}

describe('operational event contracts and HOS effects', () => {
  it('supports every required operational event as a distinct type', () => {
    const validated = OPERATIONAL_EVENT_TYPES.map((type) => plan(type));
    expect(validated.map((event) => event.type)).toEqual(
      OPERATIONAL_EVENT_TYPES,
    );
  });

  it('records pre-trip inspection as on duty before driving and consumes shift and cycle', () => {
    const state = departureState();
    const result = scheduleOperationalEvent(
      plan('PRE_TRIP_INSPECTION'),
      state.departureAt,
      state,
      [],
    );

    expect(result.status).toBe('SCHEDULED');
    expect(result.dutyEvent).toMatchObject({
      eventType: 'PRE_TRIP_INSPECTION',
      dutyStatus: 'ON_DUTY_NOT_DRIVING',
      duration: durationInMinutes(30),
    });
    expect(result.hosResult?.final.drivingTimeRemaining).toEqual(
      durationInMinutes(660),
    );
    expect(result.hosResult?.final.shiftTimeRemaining).toEqual(
      durationInMinutes(810),
    );
    expect(result.hosResult?.final.cycleTimeRemaining).toEqual(
      durationInMinutes(4_170),
    );
  });

  it('does not permit fuel to become off duty without authoritative support', () => {
    expect(() =>
      plan('FUEL', {
        dutyStatus: 'OFF_DUTY',
      }),
    ).toThrow(/normally requires on-duty-not-driving/iu);
  });

  it('allows a 30-minute on-duty event to overlap the configured interruption but not rest', () => {
    const fuel = plan('FUEL');
    const state = departureState({
      drivenSinceLastQualifyingInterruption: durationInMinutes(480),
    });
    const result = scheduleOperationalEvent(
      fuel,
      state.departureAt,
      state,
      [],
    );

    expect(result.dutyEvent?.qualifiesForThirtyMinuteInterruption).toBe(true);
    expect(result.hosResult?.final.drivenSinceLastQualifyingInterruption).toEqual(
      durationInMinutes(0),
    );
    expect(fuel.allowRestOverlap).toBe(false);
  });

  it('keeps a planning buffer separate from legal event duration and drive time', () => {
    const state = departureState();
    const result = scheduleOperationalEvent(
      plan('PRE_TRIP_INSPECTION', {
        planningBuffer: {
          duration: durationInMinutes(10),
          source: {
            type: 'CARRIER_POLICY',
            sourceName: 'Test-only carrier policy',
            explanation: 'Adds setup variability outside the legal minimum.',
          },
          explanation: 'Test-only planning buffer.',
          legalRequirement: false,
        },
      }),
      state.departureAt,
      state,
      [],
    );

    expect(result.dutyEvent?.duration).toEqual(durationInMinutes(30));
    expect(result.planningBufferEvent?.duration).toEqual(durationInMinutes(10));
    expect(result.planningBufferEvent?.explanation).toContain(
      'not represented as a legal minimum',
    );
    expect(result.hosResult?.final.shiftTimeRemaining).toEqual(
      durationInMinutes(800),
    );
    expect(result.hosResult?.final.drivingTimeRemaining).toEqual(
      durationInMinutes(660),
    );
  });

  it('selects only verified truck-compatible locations with the required capability', () => {
    const event = validateOperationalEventPlan({
      ...plan('SCALE'),
      location: undefined,
      placement: {
        kind: 'FLEXIBLE',
        requiredCapability: 'SCALE',
        earliestRouteDistance: distanceInMiles(100),
        latestRouteDistance: distanceInMiles(300),
      },
    });
    const result = selectOperationalLocation(event, [
      location('car-scale', 120, ['SCALE'], { truckCompatible: false }),
      location('unverified-scale', 150, ['SCALE'], { source: userSource }),
      location('verified-scale', 200, ['SCALE']),
    ]);

    expect(result.status).toBe('SELECTED');
    expect(result.location?.locationId).toBe('verified-scale');
  });

  it('preserves event sources and overrides in a JSON-safe operational snapshot', () => {
    expect(operationalPlanSnapshot([plan('FUEL')])).toMatchObject({
      operationalEvents: [
        {
          type: 'FUEL',
          userOverride: true,
          source: { type: 'USER_OVERRIDE' },
          dutyStatus: 'ON_DUTY_NOT_DRIVING',
        },
      ],
    });
  });
});

describe('fuel planning', () => {
  it('does not add fuel when entered range covers the route and reserve', () => {
    const result = planFuelStops({
      fuelCapacity: volumeInUsGallons(150),
      currentFuelLevel: volumeInUsGallons(100),
      estimatedMilesPerGallon: 7,
      routeDistance: distanceInMiles(500),
      requiredReserve: volumeInUsGallons(20),
      locations: [],
    });

    expect(result.status).toBe('NOT_REQUIRED');
    expect(result.stops).toEqual([]);
  });

  it('plans only verified truck-compatible fuel locations when range is insufficient', () => {
    const result = planFuelStops({
      fuelCapacity: volumeInUsGallons(150),
      currentFuelLevel: volumeInUsGallons(70),
      estimatedMilesPerGallon: 7,
      routeDistance: distanceInMiles(900),
      requiredReserve: volumeInUsGallons(20),
      locations: [
        location('car-fuel', 320, ['FUEL'], { truckCompatible: false }),
        location('verified-fuel', 300, ['FUEL']),
      ],
    });

    expect(result.status).toBe('PLANNED');
    expect(result.stops).toHaveLength(1);
    expect(result.stops[0]?.location.locationId).toBe('verified-fuel');
  });

  it('blocks without fabricating a stop when no truck-compatible fuel location exists', () => {
    const result = planFuelStops({
      fuelCapacity: volumeInUsGallons(150),
      currentFuelLevel: volumeInUsGallons(70),
      estimatedMilesPerGallon: 7,
      routeDistance: distanceInMiles(900),
      requiredReserve: volumeInUsGallons(20),
      locations: [location('car-only', 300, ['FUEL'], { truckCompatible: false })],
    });

    expect(result).toMatchObject({
      status: 'BLOCKED',
      blockingReason: 'NO_TRUCK_COMPATIBLE_LOCATION',
      stops: [],
    });
    expect(result.explanations.join(' ')).toContain('did not fabricate');
  });

  it('blocks an uncovered fuel gap even when another verified location exists later', () => {
    const result = planFuelStops({
      fuelCapacity: volumeInUsGallons(100),
      currentFuelLevel: volumeInUsGallons(50),
      estimatedMilesPerGallon: 5,
      routeDistance: distanceInMiles(1_000),
      requiredReserve: volumeInUsGallons(10),
      locations: [
        location('first', 150, ['FUEL']),
        location('too-far', 700, ['FUEL']),
      ],
    });

    expect(result.status).toBe('BLOCKED');
    expect(result.blockingReason).toBe('INSUFFICIENT_RANGE');
    expect(result.stops).toHaveLength(1);
  });

  it('returns a structured invalid-input block instead of throwing', () => {
    const result = planFuelStops({
      fuelCapacity: volumeInUsGallons(100),
      currentFuelLevel: volumeInUsGallons(110),
      estimatedMilesPerGallon: 0,
      routeDistance: distanceInMiles(100),
      requiredReserve: volumeInUsGallons(10),
      locations: [],
    });

    expect(result).toMatchObject({
      status: 'BLOCKED',
      blockingReason: 'INVALID_FUEL_INPUT',
    });
  });
});
