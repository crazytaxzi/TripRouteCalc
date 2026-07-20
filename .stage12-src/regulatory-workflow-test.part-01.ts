  const trip = await client.trip.create({
    data: { carrierId: carrier.id, driverId: driver.id },
  });
  return {
    context: { carrierId: carrier.id, actorUserId: user.id },
    tripId: trip.id,
  };
}

function rule(ruleId: string, maximumFeet: number) {
  return validateJurisdictionRule({
    ruleId,
    jurisdictionCode: 'US-CA',
    category: 'kpra',
    affectedVehicleTypes: ['tractor-semitrailer'],
    roadScope: { kind: 'jurisdiction-wide', jurisdictionCodes: ['US-CA'] },
    effectiveFrom: utcInstant('2026-07-01T00:00:00Z'),
    source,
    explanation: 'Test-only KPRA rule for persistence workflow coverage.',
    condition: {
      kind: 'length',
      fact: 'vehicle.trailer.kpra',
      operator: 'greater-than',
      value: lengthInFeet(maximumFeet),
    },
    requiredAction: {
      code: 'ADJUST-KPRA',
      instruction: 'Adjust and verify KPRA and axle weights.',
      mustCompleteBeforeSegment: true,
      requiredUpdatedFacts: [
        'vehicle.trailer.kpra',
        'load.drive-axle-weight',
        'load.trailer-axle-weight',
      ],
    },
    severity: 'action-required',
    blocksRouteFinalization: true,
    requiresManualVerification: false,
    active: true,
    version: '1',
  });
}

function ruleSet(version: string, maximumFeet = 40) {
  return validateRegulatoryRuleSet({
    ruleSetId: `test-rule-set-${version}`,
    name: 'test-only-commercial-compliance',
    version,
    status: 'draft',
    effectiveFrom: utcInstant('2026-07-01T00:00:00Z'),
    source: { ...source, version },
    coverage: {
      jurisdictionCodes: ['US-CA'],
      status: 'complete',
      limitations: [],
    },
    rules: [rule(`CA-KPRA-${version}`, maximumFeet)],
  });
}

function revisionInput(tripId: string): CreateTripRevisionInput {
  return {
    tripId,
    calculationTimestamp: utcInstant('2026-07-20T01:00:00Z'),
    ruleSetVersion: 'stage-12-test',
    inputSnapshot: { fixture: true },
    stops: [
      {
        sequence: 10,
        type: 'final-consignee',
        required: true,
        timeZone: ianaTimeZone('America/Los_Angeles'),
        expectedServiceDuration: durationInMinutes(30),
      },
    ],
  };
}

beforeAll(() => {
  client = createPersistenceClient(databaseUrlFromEnvironment());
});

beforeEach(async () => {
  await resetDatabase();
});
