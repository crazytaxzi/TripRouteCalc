import { describe, expect, it } from 'vitest';

import {
  assessCommercialRoute,
  distanceInMiles,
  durationInMinutes,
  ianaTimeZone,
  lengthInFeet,
  lengthInInches,
  speedInMilesPerHour,
  utcInstant,
  validateCommercialRouteRequest,
  volumeInUsGallons,
  weightInPounds,
} from '../src/index.js';
import type {
  CommercialRoutePayload,
  CommercialRouteRequest,
  ResolvedCommercialLocation,
} from '../src/index.js';

function location(
  referenceId: string,
  longitude: number,
): ResolvedCommercialLocation {
  return {
    referenceId,
    description: referenceId,
    latitude: 46.4,
    longitude,
    timeZone: ianaTimeZone('America/Los_Angeles'),
    resolutionSource: 'provider-resolved' as const,
    confidence: 'high' as const,
    unavailableFields: [],
  };
}

function request(): CommercialRouteRequest {
  return {
    requestId: 'route-request-1',
    requestedAt: utcInstant('2026-07-20T19:00:00Z'),
    departureAt: utcInstant('2026-07-20T20:00:00Z'),
    equipment: {
      tractor: {
        axleCount: 3,
        overallLength: lengthInFeet(20),
        height: lengthInFeet(13),
        width: lengthInInches(96),
        emptyWeight: weightInPounds(19_000),
        registeredGrossWeight: weightInPounds(80_000),
        fuelCapacity: volumeInUsGallons(200),
        estimatedFuelRange: distanceInMiles(1_200),
        governedSpeed: speedInMilesPerHour(65),
        planningCruiseSpeed: speedInMilesPerHour(55),
        hazmatEquipped: true,
      },
      trailer: {
        axleCount: 2,
        length: lengthInFeet(53),
        height: lengthInFeet(13.5),
        width: lengthInInches(102),
        currentKpra: lengthInFeet(40),
        emptyWeight: weightInPounds(14_000),
        maximumPayload: weightInPounds(54_000),
        reefer: false,
      },
      load: {
        hazmat: false,
        grossCargoWeight: weightInPounds(40_000),
        steerAxleWeight: weightInPounds(12_000),
        driveAxleWeight: weightInPounds(33_000),
        trailerAxleWeight: weightInPounds(32_000),
        totalGrossCombinationWeight: weightInPounds(77_000),
        length: lengthInFeet(48),
        height: lengthInFeet(8),
        width: lengthInFeet(8),
        permitRequirement: 'not-required' as const,
        permitIdentifiers: [],
      },
      totalAxleCount: 5,
      trailerCount: 1,
      combinedDimensions: {
        overallLength: lengthInFeet(72),
        height: lengthInFeet(13.5),
        width: lengthInInches(102),
      },
      legalityStatus: 'not-evaluated' as const,
    },
    origin: location('origin', -117.0),
    orderedStops: [
      { stopId: 'stop-1', sequence: 10, required: true, location: location('destination', -116.9) },
    ],
    avoidances: ['ferries'] as const,
    routePolicy: 'fastest-compliant' as const,
    permitIdentifiers: [],
    comparisonMode: 'commercial-route-only' as const,
  };
}

function payload(
  overrides: Partial<CommercialRoutePayload> = {},
): CommercialRoutePayload {
  const geometry = {
    format: 'geojson-line-string' as const,
    coordinates: [[-117.0, 46.4], [-116.9, 46.4]] as [number, number][],
  };
  return {
    routeId: 'route-1',
    routeKind: 'commercial-vehicle' as const,
    provider: {
      providerName: 'test-only-commercial-provider',
      providerVersion: 'fixture-1',
      providerRequestId: 'provider-request-1',
      requestedAt: utcInstant('2026-07-20T19:00:00Z'),
      respondedAt: utcInstant('2026-07-20T19:00:01Z'),
      confidence: 'high' as const,
    },
    totalDistance: distanceInMiles(10),
    travelDuration: durationInMinutes(15),
    geometry,
    legs: [
      {
        legId: 'leg-1',
        sequence: 1,
        originReferenceId: 'origin',
        destinationStopId: 'stop-1',
        distance: distanceInMiles(10),
        travelDuration: durationInMinutes(15),
        geometry,
        segments: [
          {
            segmentId: 'segment-1',
            sequence: 1,
            distance: distanceInMiles(10),
            travelDuration: durationInMinutes(15),
            geometry,
            verificationStatus: 'verified' as const,
            jurisdictionCodes: ['US-WA'],
            restrictions: [],
            unavailableFields: [],
          },
        ],
        unavailableFields: [],
      },
    ],
    restrictions: [],
    unavailableFields: [],
    ...overrides,
  };
}

describe('commercial-routing contracts', () => {
  it('requires complete CMV input and strictly ordered unique stops', () => {
    expect(validateCommercialRouteRequest(request()).equipment.totalAxleCount).toBe(5);
    expect(() =>
      validateCommercialRouteRequest({
        ...request(),
        orderedStops: [
          { stopId: 'a', sequence: 10, required: true, location: location('a', -117) },
          { stopId: 'b', sequence: 10, required: true, location: location('b', -116) },
        ],
      }),
    ).toThrow(/sequence/iu);
  });

  it('blocks consumer comparisons from commercial planning and legal finalization', () => {
    const result = assessCommercialRoute(payload({ routeKind: 'consumer-comparison' }));
    expect(result.assessment.commercialPlanningStatus).toBe('blocked');
    expect(result.assessment.providerVerificationStatus).toBe('consumer-comparison-only');
    expect(result.assessment.legalFinalizationStatus).toBe(
      'blocked-pending-regulatory-evaluation',
    );
  });

  it('blocks prohibited and unverified segments without claiming legal status', () => {
    const base = payload();
    const leg = base.legs[0];
    const segment = leg?.segments[0];
    if (leg === undefined || segment === undefined) throw new Error('Fixture missing.');
    const result = assessCommercialRoute({
      ...base,
      legs: [
        {
          ...leg,
          segments: [
            {
              ...segment,
              verificationStatus: 'prohibited',
              restrictions: [
                {
                  restrictionId: 'restriction-1',
                  type: 'low-clearance',
                  severity: 'prohibited',
                  explanation: 'Entered vehicle height exceeds the provider-supported clearance.',
                  sourceTitle: 'Test-only provider fixture',
                  sourceReference: 'fixture://commercial-provider/restriction-1',
                },
              ],
            },
          ],
        },
      ],
    });
    expect(result.assessment.commercialPlanningStatus).toBe('blocked');
    expect(result.assessment.blockingReasons.join(' ')).toMatch(/prohibited/iu);
  });

  it('marks a fully verified commercial route usable but still pending regulatory evaluation', () => {
    const result = assessCommercialRoute(payload());
    expect(result.assessment.commercialPlanningStatus).toBe('usable');
    expect(result.assessment.providerVerificationStatus).toBe(
      'commercial-provider-verified',
    );
    expect(result.assessment.legalFinalizationStatus).toBe(
      'blocked-pending-regulatory-evaluation',
    );
  });
});
