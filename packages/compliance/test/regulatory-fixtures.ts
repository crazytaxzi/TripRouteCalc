import {
  distanceInMiles,
  durationInMinutes,
  lengthInFeet,
  lengthInInches,
  speedInMilesPerHour,
  utcInstant,
  validateJurisdictionRule,
  validateRegulatoryRuleSet,
  volumeInUsGallons,
  weightInPounds,
} from '@trip-route-calc/foundation';
import type {
  JurisdictionRule,
  RegulatoryEvaluationInput,
  RegulatoryRouteSegmentContext,
  RegulatoryRuleSet,
} from '@trip-route-calc/foundation';


const source = {
  authorityType: 'state-dot' as const,
  authorityName: 'Test-only official authority',
  title: 'Test-only official regulatory fixture',
  reference: 'fixture://official/test-only',
  retrievedAt: utcInstant('2026-07-20T00:00:00Z'),
  version: 'fixture-1',
  lastVerifiedAt: utcInstant('2026-07-20T00:00:00Z'),
};

export function equipment(kpraFeet = 40): RegulatoryEvaluationInput['equipment'] {
  return {
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
      currentKpra: lengthInFeet(kpraFeet),
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
  };
}

export function segment(
  segmentId: string,
  jurisdictionCode: string,
  roadIdentity?: string,
): RegulatoryRouteSegmentContext {
  return {
    segment: {
      segmentId,
      sequence: segmentId === 'or-1' ? 1 : 2,
      distance: distanceInMiles(10),
      travelDuration: durationInMinutes(12),
      geometry: {
        format: 'geojson-line-string',
        coordinates: [
          [-122, 42],
          [-121.8, 41.9],
        ],
      },
      jurisdictionCodes: [jurisdictionCode],
      verificationStatus: 'verified',
      restrictions: [],
      unavailableFields: [],
    },
    roadIdentity,
    direction: 'southbound',
    localAccessSegment: false,
    localAccessVerified: true,
    lastReasonableActionLocation:
      segmentId === 'ca-1'
        ? {
            locationReferenceId: 'last-scale-before-ca',
            description: 'Test-only last adjustment location before the segment.',
          }
        : undefined,
  };
}

export function kpraRule(
  ruleId: string,
  maximumFeet: number,
  roadIdentity?: string,
): JurisdictionRule {
  return validateJurisdictionRule({
    ruleId,
    jurisdictionCode: 'US-CA',
    category: 'kpra',
    affectedVehicleTypes: ['tractor-semitrailer'],
    roadScope:
      roadIdentity === undefined
        ? { kind: 'jurisdiction-wide', jurisdictionCodes: ['US-CA'] }
        : {
            kind: 'road-identity',
            roadIdentities: [roadIdentity],
            directions: ['both'],
          },
    effectiveFrom: utcInstant('2026-07-01T00:00:00Z'),
    source,
    explanation: `Test-only KPRA maximum of ${String(maximumFeet)} feet.`,
    condition: {
      kind: 'length',
      fact: 'vehicle.trailer.kpra',
      operator: 'greater-than',
      value: lengthInFeet(maximumFeet),
    },
    requiredAction: {
      code: 'ADJUST-KPRA',
      instruction:
        'Adjust and verify KPRA and axle weights before entering the affected segment.',
      mustCompleteBeforeSegment: true,
      requiredUpdatedFacts: [
        'vehicle.trailer.kpra',
        'load.drive-axle-weight',
        'load.trailer-axle-weight',
        'load.total-gross-combination-weight',
      ],
    },
    severity: 'action-required',
    blocksRouteFinalization: true,
    requiresManualVerification: false,
    active: true,
    version: '1',
  });
}

export function ruleSet(
  rules: readonly JurisdictionRule[],
  status: 'draft' | 'active' | 'inactive' = 'active',
): RegulatoryRuleSet {
  return validateRegulatoryRuleSet({
    ruleSetId: 'ruleset-test-1',
    name: 'test-only-regulatory-rules',
    version: '2026-07-20-test',
    status,
    effectiveFrom: utcInstant('2026-07-01T00:00:00Z'),
    source,
    coverage: {
      jurisdictionCodes: ['US-OR', 'US-CA'],
      status: 'complete',
      limitations: [],
    },
    rules,
  });
}

export function input(
  rules: readonly JurisdictionRule[],
  options: Partial<RegulatoryEvaluationInput> = {},
): RegulatoryEvaluationInput {
  return {
    routeId: 'route-test-1',
    routeKind: 'commercial-vehicle',
    providerName: 'test-only-commercial-provider',
    providerVersion: 'fixture-1',
    providerRequestId: 'provider-request-1',
    providerRespondedAt: utcInstant('2026-07-20T00:00:01Z'),
    providerVerificationStatus: 'commercial-provider-verified',
    vehicleType: 'tractor-semitrailer',
    equipment: equipment(),
    permitIdentifiers: [],
    evaluationAt: utcInstant('2026-07-20T01:00:00Z'),
    segments: [segment('or-1', 'US-OR', 'I-5'), segment('ca-1', 'US-CA', 'I-5')],
    ruleSet: ruleSet(rules),
    ...options,
  };
}
