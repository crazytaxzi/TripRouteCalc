import {
  distanceInMiles,
  durationInMinutes,
  ianaTimeZone,
  lengthInFeet,
  lengthInInches,
  speedInMilesPerHour,
  utcInstant,
  volumeInUsGallons,
  weightInPounds,
} from '@trip-route-calc/foundation';
import { describe, expect, it, vi } from 'vitest';

import {
  CommercialRoutingProviderError,
  CommercialRoutingService,
  ServerOnlyProviderCredential,
  createCommercialRoutingRuntime,
} from '../src/index.js';
import type {
  CommercialRouteProvider,
  CommercialRoutingExecutionDependencies,
  ProviderLicenseCapabilities,
} from '../src/index.js';

const license: ProviderLicenseCapabilities = {
  rawResponseRetention: 'forbidden',
  normalizedSnapshotRetention: 'allowed',
  providerReferenceRetention: 'allowed',
  commercialVehicleRoutingLicensed: true,
  coverageDescription: 'Test-only contract fixture; no production coverage claim.',
};

function location(referenceId: string) {
  return {
    referenceId,
    description: referenceId,
    latitude: 46.4,
    longitude: -117,
    timeZone: ianaTimeZone('America/Los_Angeles'),
    resolutionSource: 'provider-resolved' as const,
    confidence: 'high' as const,
    unavailableFields: [],
  };
}

function routeRequest() {
  return {
    requestId: 'request-1',
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
        hazmatEquipped: false,
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
    origin: location('origin'),
    orderedStops: [
      {
        stopId: 'stop-1',
        sequence: 10,
        required: true,
        location: location('destination'),
      },
    ],
    avoidances: [],
    routePolicy: 'fastest-compliant' as const,
    permitIdentifiers: [],
    comparisonMode: 'commercial-route-only' as const,
  };
}

function routePayload(
  routeKind: 'commercial-vehicle' | 'consumer-comparison' = 'commercial-vehicle',
) {
  const geometry = {
    format: 'geojson-line-string' as const,
    coordinates: [
      [-117, 46.4],
      [-116.9, 46.4],
    ] as [number, number][],
  };
  return {
    routeId: `route-${routeKind}`,
    routeKind,
    provider: {
      providerName: 'test-only-provider',
      providerVersion: 'fixture-1',
      providerRequestId: 'provider-1',
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
            jurisdictionCodes: ['US-WA'],
            verificationStatus: 'verified' as const,
            restrictions: [],
            unavailableFields: [],
          },
        ],
        unavailableFields: [],
      },
    ],
    restrictions: [],
    unavailableFields: [],
  };
}

function provider(
  calculateCommercialRoute: CommercialRouteProvider['calculateCommercialRoute'],
  overrides: Partial<CommercialRouteProvider> = {},
): CommercialRouteProvider {
  return {
    metadata: {
      name: 'test-only-provider',
      version: 'fixture-1',
      credentialRequirement: 'none',
      capabilities: {
        geocoding: true,
        commercialRouting: true,
        routeRestrictions: true,
        trafficEstimate: false,
        roadClosures: false,
        consumerComparison: true,
      },
    },
    geocodeLocation: async () => location('geocoded'),
    calculateCommercialRoute,
    getRouteRestrictions: async () => [],
    calculateConsumerComparison: async () =>
      routePayload('consumer-comparison'),
    ...overrides,
  };
}

describe('commercial-routing runtime and execution', () => {
  it('reports exact missing setup instead of installing a fake production provider', () => {
    const runtime = createCommercialRoutingRuntime({});
    expect(runtime.status).toBe('blocked');
    if (runtime.status !== 'blocked') throw new Error('Expected blocked runtime.');
    expect(runtime.blocker.code).toBe('PROVIDER_NOT_SELECTED');
    expect(runtime.blocker.explanation).toMatch(/no consumer fallback/iu);
  });

  it('keeps credentials redacted in strings and JSON', () => {
    const credential =
      ServerOnlyProviderCredential.fromServerConfiguration('super-secret-key');
    expect(String(credential)).toBe('[REDACTED]');
    expect(JSON.stringify({ credential })).not.toContain('super-secret-key');
    expect(credential.use((value) => value.length)).toBe(16);
  });

  it('retries retryable rate limits within the three-attempt ceiling', async () => {
    let attempts = 0;
    const sleep = vi.fn(async (): Promise<void> => undefined);
    const dependencies: CommercialRoutingExecutionDependencies = {
      sleep,
      createAbortController: () => new AbortController(),
    };
    const fixture = provider(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new CommercialRoutingProviderError(
          'RATE_LIMITED',
          'Provider rate limit reached.',
          true,
          'test-only-provider',
          1,
        );
      }
      return routePayload();
    });
    const service = new CommercialRoutingService(
      fixture,
      license,
      undefined,
      {
        timeoutMs: 1_000,
        maximumAttempts: 3,
        initialRetryDelayMs: 1,
        maximumRetryDelayMs: 2,
      },
      dependencies,
    );
    await expect(
      service.calculateCommercialRoute(routeRequest()),
    ).resolves.toMatchObject({ routeKind: 'commercial-vehicle' });
    expect(attempts).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('enforces timeout even when an adapter ignores the abort signal', async () => {
    const fixture = provider(async () => new Promise<never>(() => undefined));
    const service = new CommercialRoutingService(fixture, license, undefined, {
      timeoutMs: 5,
      maximumAttempts: 1,
      initialRetryDelayMs: 0,
      maximumRetryDelayMs: 0,
    });
    await expect(
      service.calculateCommercialRoute(routeRequest()),
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('rejects a consumer result from the commercial operation and keeps comparison separate', async () => {
    const fixture = provider(async () => routePayload('consumer-comparison'));
    const service = new CommercialRoutingService(fixture, license);
    await expect(
      service.calculateCommercialRoute(routeRequest()),
    ).rejects.toMatchObject({ code: 'INVALID_PROVIDER_RESPONSE' });
    await expect(
      service.calculateConsumerComparison(routeRequest()),
    ).resolves.toMatchObject({
      routeKind: 'consumer-comparison',
      assessment: { commercialPlanningStatus: 'blocked' },
    });
  });

  it('redacts credential-like text from mapped provider failures', async () => {
    const fixture = provider(async () => {
      throw new Error('apiKey=super-secret-key');
    });
    const service = new CommercialRoutingService(fixture, license, undefined, {
      timeoutMs: 1_000,
      maximumAttempts: 1,
      initialRetryDelayMs: 0,
      maximumRetryDelayMs: 0,
    });
    const error = await service
      .calculateCommercialRoute(routeRequest())
      .catch((value: unknown) => value);
    expect(error).toBeInstanceOf(CommercialRoutingProviderError);
    expect(String(error)).not.toContain('super-secret-key');
    expect(String(error)).toContain('[REDACTED]');
  });

  it('stops after three retryable provider-outage attempts', async () => {
    let attempts = 0;
    const dependencies: CommercialRoutingExecutionDependencies = {
      sleep: async (): Promise<void> => undefined,
      createAbortController: () => new AbortController(),
    };
    const fixture = provider(async () => {
      attempts += 1;
      throw new CommercialRoutingProviderError(
        'PROVIDER_OUTAGE',
        'Provider unavailable.',
        true,
        'test-only-provider',
      );
    });
    const service = new CommercialRoutingService(
      fixture,
      license,
      undefined,
      {
        timeoutMs: 1_000,
        maximumAttempts: 3,
        initialRetryDelayMs: 0,
        maximumRetryDelayMs: 0,
      },
      dependencies,
    );
    await expect(
      service.calculateCommercialRoute(routeRequest()),
    ).rejects.toMatchObject({ code: 'PROVIDER_OUTAGE' });
    expect(attempts).toBe(3);
  });

  it('blocks a configured provider when commercial routing licensing is absent', () => {
    const fixture = provider(async () => routePayload());
    const runtime = createCommercialRoutingRuntime({
      provider: fixture,
      license: { ...license, commercialVehicleRoutingLicensed: false },
    });
    expect(runtime.status).toBe('blocked');
    if (runtime.status !== 'blocked') throw new Error('Expected blocked runtime.');
    expect(runtime.blocker.code).toBe('LICENSE_CONFIGURATION_INVALID');
  });
});
