import {
  distanceInMiles,
  durationInMinutes,
  ianaTimeZone,
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

import {
  departureState,
  dutyEvent,
} from './hos-test-fixtures.js';

const providerSource: OperationalEventSource = Object.freeze({
  type: 'VERIFIED_LOCATION_PROVIDER',
  sourceName: 'Test-only truck location provider',
  reference: 'fixture://stage-14-guard-locations',
  verifiedAt: utcInstant('2026-07-20T00:00:00Z'),
  explanation: 'Deterministic Stage 14 guard fixture source.',
});

const userSource: OperationalEventSource = Object.freeze({
  type: 'USER_OVERRIDE',
  sourceName: 'Test-only user override',
  explanation: 'Deterministic Stage 14 guard fixture override.',
});

function location(
  locationId: string,
  routeMiles: number,
  capabilities: OperationalLocation['capabilities'],
  truckCompatible = true,
): OperationalLocation {
  return Object.freeze({
    locationId,
    description: `Test-only location ${locationId}`,
    timeZone: ianaTimeZone('America/Los_Angeles'),
    routeDistance: distanceInMiles(routeMiles),
    truckCompatible,
    capabilities,
    source: providerSource,
  });
}

function plan(
  type: OperationalEventPlan['type'],
  overrides: Partial<OperationalEventPlan> = {},
): OperationalEventPlan {
  const placementKind =
    type === 'PRE_TRIP_INSPECTION'
      ? 'BEFORE_FIRST_DRIVE'
      : type === 'POST_TRIP_INSPECTION'
        ? 'AFTER_FINAL_DRIVE'
        : 'FLEXIBLE';
  return validateOperationalEventPlan({
    eventId: `guard-${type}`,
    type,
    duration: { mode: 'EXACT', duration: durationInMinutes(30) },
    dutyStatus: 'ON_DUTY_NOT_DRIVING',
    source: userSource,
    location: location('explicit', 0, []),
    placement: { kind: placementKind },
    allowThirtyMinuteInterruptionOverlap: true,
    allowRestOverlap: false,
    required: true,
    userOverride: true,
    explanation: `Test-only ${type} guard event.`,
    ...overrides,
  });
}

describe('Stage 14 operational safety composition', () => {
  it('rejects an explicitly selected location that is not truck-compatible', () => {
    const result = selectOperationalLocation(
      plan('FUEL', {
        location: location('car-only-fuel', 0, ['FUEL'], false),
      }),
      [],
    );

    expect(result.status).toBe('UNAVAILABLE');
    expect(result.explanations.join(' ')).toContain('truck-compatible');
  });

  it('rejects an explicitly selected location without the required capability', () => {
    const result = selectOperationalLocation(
      plan('SCALE', {
        location: location('fuel-only', 100, ['FUEL']),
        placement: {
          kind: 'AT_ROUTE_DISTANCE',
          routeDistance: distanceInMiles(100),
          requiredCapability: 'SCALE',
        },
      }),
      [],
    );

    expect(result.status).toBe('UNAVAILABLE');
    expect(result.explanations.join(' ')).toContain('SCALE capability');
  });

  it('does not place a pre-trip inspection after driving has started', () => {
    const state = departureState();
    const driving = dutyEvent({
      id: 'already-driving',
      startAt: state.departureAt,
      minutes: 30,
      dutyStatus: 'DRIVING',
    });
    const result = scheduleOperationalEvent(
      plan('PRE_TRIP_INSPECTION'),
      driving.endAt,
      state,
      [driving],
    );

    expect(result.status).toBe('PLACEMENT_UNAVAILABLE');
    expect(result.dutyEvent).toBeUndefined();
    expect(result.explanations.join(' ')).toContain(
      'before the first driving event',
    );
  });

  it('plans immediate origin fueling when current fuel is below reserve', () => {
    const result = planFuelStops({
      fuelCapacity: volumeInUsGallons(100),
      currentFuelLevel: volumeInUsGallons(5),
      estimatedMilesPerGallon: 5,
      routeDistance: distanceInMiles(300),
      requiredReserve: volumeInUsGallons(10),
      locations: [location('origin-fuel', 0, ['FUEL'])],
    });

    expect(result.status).toBe('PLANNED');
    expect(result.stops).toHaveLength(1);
    expect(result.stops[0]).toMatchObject({
      sequence: 1,
      location: { locationId: 'origin-fuel' },
      arrivalFuel: volumeInUsGallons(5),
      gallonsAdded: volumeInUsGallons(95),
      departureFuel: volumeInUsGallons(100),
    });
  });

  it('reports an uncovered post-stop gap as insufficient range', () => {
    const result = planFuelStops({
      fuelCapacity: volumeInUsGallons(100),
      currentFuelLevel: volumeInUsGallons(50),
      estimatedMilesPerGallon: 5,
      routeDistance: distanceInMiles(1_000),
      requiredReserve: volumeInUsGallons(10),
      locations: [location('first-fuel', 150, ['FUEL'])],
    });

    expect(result.status).toBe('BLOCKED');
    expect(result.blockingReason).toBe('INSUFFICIENT_RANGE');
    expect(result.stops).toHaveLength(1);
  });
});
