
function segment(
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

function kpraRule(
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
