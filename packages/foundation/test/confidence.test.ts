import { describe, expect, it } from 'vitest';

import {
  CONFIDENCE_REASON_CODES,
  DATA_QUALITY_FACTOR_RULES,
  assessConfidence,
  dataQualityReason,
  dataQualityReasonsFromTrip,
  publicEvidenceReference,
  resultExplanation,
} from '../src/index.js';
import type {
  ConfidenceReason,
  ConfidenceReasonCode,
  PublicEvidenceReference,
  TripDataQualityInput,
} from '../src/index.js';

function inputReference(reference: string): PublicEvidenceReference {
  return publicEvidenceReference('INPUT', reference, reference);
}

function reason(
  code: ConfidenceReasonCode,
  reference = `input.${code.toLowerCase()}`,
): ConfidenceReason {
  return dataQualityReason(
    code,
    [inputReference(reference)],
    `User explanation for ${code}.`,
    `Technical explanation for ${code}.`,
  );
}

function completeTripDataQuality(
  overrides: Partial<TripDataQualityInput> = {},
): TripDataQualityInput {
  return {
    revisionReference: 'revision-stage-16-1',
    axleWeights: 'KNOWN',
    kpra: 'KNOWN',
    trailerDimensions: 'KNOWN',
    permitInformation: 'NOT_REQUIRED',
    providerRestrictions: 'AVAILABLE',
    liveTraffic: 'AVAILABLE',
    weather: 'AVAILABLE',
    stops: [],
    segments: [],
    userEstimatedInputs: [],
    ...overrides,
  };
}

describe('Stage 16 deterministic confidence classification', () => {
  it('returns HIGH when no documented factor lowers confidence', () => {
    const assessment = assessConfidence([]);

    expect(assessment.level).toBe('HIGH');
    expect(assessment.legalConclusionStatus).toBe('AVAILABLE');
    expect(assessment.reasons).toEqual([]);
    expect(assessment.dominantReasonCodes).toEqual([]);
  });

  it('returns MODERATE for one moderate factor', () => {
    const assessment = assessConfidence([reason('MISSING_APPOINTMENT_WINDOW')]);

    expect(assessment.level).toBe('MODERATE');
    expect(assessment.legalConclusionStatus).toBe('AVAILABLE');
    expect(assessment.dominantReasonCodes).toEqual([
      'MISSING_APPOINTMENT_WINDOW',
    ]);
  });

  it('escalates two independent moderate factors to LOW', () => {
    const assessment = assessConfidence([
      reason('MISSING_APPOINTMENT_WINDOW'),
      reason('LIVE_TRAFFIC_UNAVAILABLE'),
    ]);

    expect(assessment.level).toBe('LOW');
    expect(assessment.legalConclusionStatus).toBe('AVAILABLE');
    expect(assessment.dominantReasonCodes).toEqual([
      'LIVE_TRAFFIC_UNAVAILABLE',
      'MISSING_APPOINTMENT_WINDOW',
    ]);
  });

  it('returns LOW for one major operational uncertainty', () => {
    const assessment = assessConfidence([reason('AVERAGE_SPEED_FALLBACK')]);

    expect(assessment.level).toBe('LOW');
    expect(assessment.legalConclusionStatus).toBe('AVAILABLE');
    expect(assessment.dominantReasonCodes).toEqual([
      'AVERAGE_SPEED_FALLBACK',
    ]);
  });

  it('returns UNVERIFIED and withholds a legal conclusion for blocking evidence', () => {
    const assessment = assessConfidence([
      reason('MISSING_AXLE_WEIGHTS'),
      reason('LIVE_TRAFFIC_UNAVAILABLE'),
    ]);

    expect(assessment.level).toBe('UNVERIFIED');
    expect(assessment.legalConclusionStatus).toBe('NOT_AVAILABLE');
    expect(assessment.dominantReasonCodes).toEqual(['MISSING_AXLE_WEIGHTS']);
  });

  it('deduplicates and orders the same reasons deterministically', () => {
    const first = assessConfidence([
      reason('LIVE_TRAFFIC_UNAVAILABLE', 'conditions.traffic'),
      reason('MISSING_AXLE_WEIGHTS', 'load.axleWeights'),
      reason('LIVE_TRAFFIC_UNAVAILABLE', 'conditions.traffic'),
      reason('AVERAGE_SPEED_FALLBACK', 'route.segment.1'),
    ]);
    const second = assessConfidence([
      reason('AVERAGE_SPEED_FALLBACK', 'route.segment.1'),
      reason('LIVE_TRAFFIC_UNAVAILABLE', 'conditions.traffic'),
      reason('MISSING_AXLE_WEIGHTS', 'load.axleWeights'),
    ]);

    expect(first).toEqual(second);
    expect(first.reasons.map((item) => item.code)).toEqual([
      'MISSING_AXLE_WEIGHTS',
      'AVERAGE_SPEED_FALLBACK',
      'LIVE_TRAFFIC_UNAVAILABLE',
    ]);
  });
});

describe('Stage 16 data-quality factor coverage', () => {
  it('defines a deterministic rule for every machine-readable reason code', () => {
    expect(Object.keys(DATA_QUALITY_FACTOR_RULES).sort()).toEqual(
      [...CONFIDENCE_REASON_CODES].sort(),
    );
  });

  it('emits the required trip-input factors with stable evidence references', () => {
    const reasons = dataQualityReasonsFromTrip(
      completeTripDataQuality({
        axleWeights: 'MISSING',
        kpra: 'UNKNOWN',
        trailerDimensions: 'UNKNOWN',
        permitInformation: 'MISSING',
        providerRestrictions: 'UNAVAILABLE',
        liveTraffic: 'UNAVAILABLE',
        weather: 'UNAVAILABLE',
        stops: [
          {
            sequence: 2,
            label: 'Final consignee',
            appointmentWindowKnown: false,
            facilityServiceTimeStatus: 'UNKNOWN',
            addressResolution: 'PARTIAL',
          },
          {
            sequence: 3,
            label: 'Intermediate delivery',
            appointmentWindowKnown: true,
            facilityServiceTimeStatus: 'ESTIMATED',
            addressResolution: 'USER_CONFIRMED',
          },
        ],
        segments: [
          {
            legSequence: 1,
            segmentSequence: 1,
            label: 'Final-mile access',
            usesAverageSpeedFallback: true,
            localTruckAccessVerified: false,
            manualVerificationRequired: true,
          },
        ],
        userEstimatedInputs: [
          {
            fieldPath: 'tractor.governedSpeed',
            label: 'Governed speed',
            legalCritical: false,
          },
          {
            fieldPath: 'load.grossWeight',
            label: 'Gross weight',
            legalCritical: true,
          },
        ],
      }),
    );

    expect(new Set(reasons.map((item) => item.code))).toEqual(
      new Set([
        'MISSING_AXLE_WEIGHTS',
        'UNKNOWN_KPRA',
        'UNKNOWN_TRAILER_DIMENSIONS',
        'PERMIT_INFORMATION_MISSING',
        'PROVIDER_RESTRICTIONS_UNAVAILABLE',
        'LIVE_TRAFFIC_UNAVAILABLE',
        'WEATHER_DATA_UNAVAILABLE',
        'MISSING_APPOINTMENT_WINDOW',
        'UNKNOWN_FACILITY_SERVICE_TIME',
        'ADDRESS_NOT_FULLY_RESOLVED',
        'USER_ESTIMATED_INPUT',
        'AVERAGE_SPEED_FALLBACK',
        'LOCAL_TRUCK_ACCESS_UNVERIFIED',
        'ROUTE_SEGMENT_MANUAL_VERIFICATION',
      ]),
    );
    expect(reasons.every((item) => item.references.length >= 2)).toBe(true);
    expect(
      reasons.every((item) =>
        item.references.some(
          (reference) =>
            reference.kind === 'REVISION' &&
            reference.reference === 'revision-stage-16-1',
        ),
      ),
    ).toBe(true);
    expect(assessConfidence(reasons).level).toBe('UNVERIFIED');
  });

  it('does not emit reasons for complete and available trip evidence', () => {
    expect(dataQualityReasonsFromTrip(completeTripDataQuality())).toEqual([]);
  });
});

describe('Stage 16 evidence and explanation safety', () => {
  it('rejects credential-like material from public references and labels', () => {
    expect(() =>
      publicEvidenceReference('PROVIDER', 'api_key=top-secret', 'Provider'),
    ).toThrow('credential-like or secret material');
    expect(() =>
      publicEvidenceReference('PROVIDER', 'provider-1', 'Bearer token'),
    ).toThrow('credential-like or secret material');
  });

  it('requires evidence for reasons and result explanations', () => {
    expect(() =>
      dataQualityReason(
        'LIVE_TRAFFIC_UNAVAILABLE',
        [],
        'Traffic unavailable.',
        'No provider response.',
      ),
    ).toThrow('requires evidence references');
    expect(() =>
      resultExplanation(
        'NO-EVIDENCE',
        'ROUTE_CONSTRAINT',
        [],
        'Route is blocked.',
        'No route evidence.',
      ),
    ).toThrow('require evidence references');
  });

  it('prevents an override from weakening a documented factor rule', () => {
    expect(() =>
      dataQualityReason(
        'MISSING_AXLE_WEIGHTS',
        [inputReference('load.axleWeights')],
        'Axle weights are missing.',
        'Legal-critical input absent.',
        'LOW',
      ),
    ).toThrow('cannot be weakened below UNVERIFIED');
  });

  it('creates audit-stable result explanations with structured references', () => {
    const explanation = resultExplanation(
      'HOS-CONSTRAINT-1',
      'HOS_CONSTRAINT',
      [
        publicEvidenceReference('EVENT', 'event-1', 'Driving event 1'),
        publicEvidenceReference(
          'RULE',
          'federal-property-hos',
          'Federal property-carrying HOS',
        ),
      ],
      'The driving allowance is the nearest legal limit.',
      'Driving time remaining is lower than shift and cycle availability.',
    );

    expect(explanation).toEqual({
      code: 'HOS-CONSTRAINT-1',
      category: 'HOS_CONSTRAINT',
      references: [
        {
          kind: 'EVENT',
          reference: 'event-1',
          label: 'Driving event 1',
        },
        {
          kind: 'RULE',
          reference: 'federal-property-hos',
          label: 'Federal property-carrying HOS',
        },
      ],
      userExplanation: 'The driving allowance is the nearest legal limit.',
      technicalExplanation:
        'Driving time remaining is lower than shift and cycle availability.',
    });
  });
});
