import { z } from 'zod';

const nonEmptyText = z.string().trim().min(1);

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

export const CONFIDENCE_LEVELS = [
  'HIGH',
  'MODERATE',
  'LOW',
  'UNVERIFIED',
] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const CONFIDENCE_REASON_CATEGORIES = [
  'LEGAL_BLOCKING_FAILURE',
  'MANUAL_VERIFICATION_REQUIRED',
  'OPERATIONAL_UNCERTAINTY',
  'MISSING_LIVE_DATA',
  'USER_ESTIMATED_INPUT',
] as const;
export type ConfidenceReasonCategory =
  (typeof CONFIDENCE_REASON_CATEGORIES)[number];

export const CONFIDENCE_REASON_CODES = [
  'MISSING_AXLE_WEIGHTS',
  'UNKNOWN_KPRA',
  'UNKNOWN_TRAILER_DIMENSIONS',
  'MISSING_APPOINTMENT_WINDOW',
  'LIVE_TRAFFIC_UNAVAILABLE',
  'WEATHER_DATA_UNAVAILABLE',
  'AVERAGE_SPEED_FALLBACK',
  'UNKNOWN_FACILITY_SERVICE_TIME',
  'LOCAL_TRUCK_ACCESS_UNVERIFIED',
  'PERMIT_INFORMATION_MISSING',
  'PROVIDER_RESTRICTIONS_UNAVAILABLE',
  'ADDRESS_NOT_FULLY_RESOLVED',
  'ROUTE_SEGMENT_MANUAL_VERIFICATION',
  'USER_ESTIMATED_INPUT',
  'LEGAL_INPUT_BLOCKING',
  'OPTIONAL_OPERATIONAL_EVENT_UNPLACED',
  'PROVIDER_CONFIDENCE_REDUCED',
  'EXTERNAL_ADJUSTMENT_REDUCED_CONFIDENCE',
] as const;
export type ConfidenceReasonCode = (typeof CONFIDENCE_REASON_CODES)[number];

export const EVIDENCE_REFERENCE_KINDS = [
  'INPUT',
  'EVENT',
  'RULE',
  'ROUTE_SEGMENT',
  'STOP',
  'REVISION',
  'PROVIDER',
] as const;
export type EvidenceReferenceKind = (typeof EVIDENCE_REFERENCE_KINDS)[number];

export const RESULT_EXPLANATION_CATEGORIES = [
  'HOS_CONSTRAINT',
  'STOP_CLOCK_EFFECT',
  'QUALIFYING_INTERRUPTION',
  'REST',
  'APPOINTMENT_WAIT',
  'COMPLIANCE_ACTION',
  'SPEED_FALLBACK',
  'FINAL_LOCAL_TIME',
  'ROUTE_CONSTRAINT',
  'OPERATIONAL_EVENT',
] as const;
export type ResultExplanationCategory =
  (typeof RESULT_EXPLANATION_CATEGORIES)[number];

export interface PublicEvidenceReference {
  readonly kind: EvidenceReferenceKind;
  readonly reference: string;
  readonly label: string;
}

export interface ConfidenceReason {
  readonly code: ConfidenceReasonCode;
  readonly category: ConfidenceReasonCategory;
  readonly maximumLevel: Exclude<ConfidenceLevel, 'HIGH'>;
  readonly references: readonly PublicEvidenceReference[];
  readonly userExplanation: string;
  readonly technicalExplanation: string;
}

export interface ConfidenceAssessment {
  readonly method: 'stage-16-rules-v1';
  readonly level: ConfidenceLevel;
  readonly reasons: readonly ConfidenceReason[];
  readonly dominantReasonCodes: readonly ConfidenceReasonCode[];
  readonly legalConclusionStatus: 'AVAILABLE' | 'NOT_AVAILABLE';
  readonly userExplanation: string;
}

export interface ResultExplanation {
  readonly code: string;
  readonly category: ResultExplanationCategory;
  readonly references: readonly PublicEvidenceReference[];
  readonly userExplanation: string;
  readonly technicalExplanation: string;
}

export interface DataQualityStopInput {
  readonly sequence: number;
  readonly label: string;
  readonly appointmentWindowKnown: boolean;
  readonly facilityServiceTimeStatus: 'KNOWN' | 'ESTIMATED' | 'UNKNOWN';
  readonly addressResolution: 'FULLY_RESOLVED' | 'USER_CONFIRMED' | 'PARTIAL';
}

export interface DataQualitySegmentInput {
  readonly legSequence: number;
  readonly segmentSequence: number;
  readonly label: string;
  readonly usesAverageSpeedFallback: boolean;
  readonly localTruckAccessVerified: boolean;
  readonly manualVerificationRequired: boolean;
}

export interface UserEstimatedInput {
  readonly fieldPath: string;
  readonly label: string;
  readonly legalCritical: boolean;
}

export interface TripDataQualityInput {
  readonly revisionReference?: string | undefined;
  readonly axleWeights: 'KNOWN' | 'MISSING';
  readonly kpra: 'KNOWN' | 'UNKNOWN';
  readonly trailerDimensions: 'KNOWN' | 'UNKNOWN';
  readonly permitInformation: 'COMPLETE' | 'MISSING' | 'UNKNOWN' | 'NOT_REQUIRED';
  readonly providerRestrictions: 'AVAILABLE' | 'UNAVAILABLE';
  readonly liveTraffic: 'AVAILABLE' | 'UNAVAILABLE' | 'NOT_APPLICABLE';
  readonly weather: 'AVAILABLE' | 'UNAVAILABLE' | 'NOT_APPLICABLE';
  readonly stops: readonly DataQualityStopInput[];
  readonly segments: readonly DataQualitySegmentInput[];
  readonly userEstimatedInputs: readonly UserEstimatedInput[];
}

interface FactorRule {
  readonly category: ConfidenceReasonCategory;
  readonly maximumLevel: Exclude<ConfidenceLevel, 'HIGH'>;
}

export const DATA_QUALITY_FACTOR_RULES: Readonly<
  Record<ConfidenceReasonCode, FactorRule>
> = freeze({
  MISSING_AXLE_WEIGHTS: freeze({
    category: 'LEGAL_BLOCKING_FAILURE',
    maximumLevel: 'UNVERIFIED',
  }),
  UNKNOWN_KPRA: freeze({
    category: 'MANUAL_VERIFICATION_REQUIRED',
    maximumLevel: 'UNVERIFIED',
  }),
  UNKNOWN_TRAILER_DIMENSIONS: freeze({
    category: 'LEGAL_BLOCKING_FAILURE',
    maximumLevel: 'UNVERIFIED',
  }),
  MISSING_APPOINTMENT_WINDOW: freeze({
    category: 'OPERATIONAL_UNCERTAINTY',
    maximumLevel: 'MODERATE',
  }),
  LIVE_TRAFFIC_UNAVAILABLE: freeze({
    category: 'MISSING_LIVE_DATA',
    maximumLevel: 'MODERATE',
  }),
  WEATHER_DATA_UNAVAILABLE: freeze({
    category: 'MISSING_LIVE_DATA',
    maximumLevel: 'MODERATE',
  }),
  AVERAGE_SPEED_FALLBACK: freeze({
    category: 'OPERATIONAL_UNCERTAINTY',
    maximumLevel: 'LOW',
  }),
  UNKNOWN_FACILITY_SERVICE_TIME: freeze({
    category: 'OPERATIONAL_UNCERTAINTY',
    maximumLevel: 'LOW',
  }),
  LOCAL_TRUCK_ACCESS_UNVERIFIED: freeze({
    category: 'MANUAL_VERIFICATION_REQUIRED',
    maximumLevel: 'UNVERIFIED',
  }),
  PERMIT_INFORMATION_MISSING: freeze({
    category: 'LEGAL_BLOCKING_FAILURE',
    maximumLevel: 'UNVERIFIED',
  }),
  PROVIDER_RESTRICTIONS_UNAVAILABLE: freeze({
    category: 'MANUAL_VERIFICATION_REQUIRED',
    maximumLevel: 'UNVERIFIED',
  }),
  ADDRESS_NOT_FULLY_RESOLVED: freeze({
    category: 'OPERATIONAL_UNCERTAINTY',
    maximumLevel: 'LOW',
  }),
  ROUTE_SEGMENT_MANUAL_VERIFICATION: freeze({
    category: 'MANUAL_VERIFICATION_REQUIRED',
    maximumLevel: 'UNVERIFIED',
  }),
  USER_ESTIMATED_INPUT: freeze({
    category: 'USER_ESTIMATED_INPUT',
    maximumLevel: 'MODERATE',
  }),
  LEGAL_INPUT_BLOCKING: freeze({
    category: 'LEGAL_BLOCKING_FAILURE',
    maximumLevel: 'UNVERIFIED',
  }),
  OPTIONAL_OPERATIONAL_EVENT_UNPLACED: freeze({
    category: 'OPERATIONAL_UNCERTAINTY',
    maximumLevel: 'MODERATE',
  }),
  PROVIDER_CONFIDENCE_REDUCED: freeze({
    category: 'OPERATIONAL_UNCERTAINTY',
    maximumLevel: 'MODERATE',
  }),
  EXTERNAL_ADJUSTMENT_REDUCED_CONFIDENCE: freeze({
    category: 'MISSING_LIVE_DATA',
    maximumLevel: 'LOW',
  }),
});

const prohibitedReferenceContent =
  /(?:authorization|bearer|password|passwd|secret|access[_-]?token|api[_-]?key|client[_-]?secret|private[_-]?key)/iu;

function cleanPublicText(value: string, field: string): string {
  const parsed = nonEmptyText.parse(value);
  if (prohibitedReferenceContent.test(parsed)) {
    throw new TypeError(`${field} contains credential-like or secret material.`);
  }
  if (parsed.length > 240) {
    throw new RangeError(`${field} must not exceed 240 characters.`);
  }
  return parsed;
}

export function publicEvidenceReference(
  kind: EvidenceReferenceKind,
  reference: string,
  label: string,
): PublicEvidenceReference {
  if (!EVIDENCE_REFERENCE_KINDS.includes(kind)) {
    throw new TypeError('Unsupported evidence reference kind.');
  }
  return freeze({
    kind,
    reference: cleanPublicText(reference, 'reference'),
    label: cleanPublicText(label, 'label'),
  });
}

export function dataQualityReason(
  code: ConfidenceReasonCode,
  references: readonly PublicEvidenceReference[],
  userExplanation: string,
  technicalExplanation: string,
  maximumLevelOverride?: Exclude<ConfidenceLevel, 'HIGH'>,
): ConfidenceReason {
  const rule = DATA_QUALITY_FACTOR_RULES[code];
  if (references.length === 0) {
    throw new RangeError(`Confidence reason ${code} requires evidence references.`);
  }
  const maximumLevel = maximumLevelOverride ?? rule.maximumLevel;
  if (
    maximumLevelOverride !== undefined &&
    levelRank(maximumLevelOverride) < levelRank(rule.maximumLevel)
  ) {
    throw new RangeError(
      `Confidence reason ${code} cannot be weakened below ${rule.maximumLevel}.`,
    );
  }
  return freeze({
    code,
    category: rule.category,
    maximumLevel,
    references: freezeArray(references),
    userExplanation: cleanPublicText(userExplanation, 'userExplanation'),
    technicalExplanation: cleanPublicText(
      technicalExplanation,
      'technicalExplanation',
    ),
  });
}

export function resultExplanation(
  code: string,
  category: ResultExplanationCategory,
  references: readonly PublicEvidenceReference[],
  userExplanation: string,
  technicalExplanation: string,
): ResultExplanation {
  if (!RESULT_EXPLANATION_CATEGORIES.includes(category)) {
    throw new TypeError('Unsupported result explanation category.');
  }
  if (references.length === 0) {
    throw new RangeError('Result explanations require evidence references.');
  }
  return freeze({
    code: cleanPublicText(code, 'code'),
    category,
    references: freezeArray(references),
    userExplanation: cleanPublicText(userExplanation, 'userExplanation'),
    technicalExplanation: cleanPublicText(
      technicalExplanation,
      'technicalExplanation',
    ),
  });
}

function levelRank(level: ConfidenceLevel): number {
  switch (level) {
    case 'HIGH':
      return 0;
    case 'MODERATE':
      return 1;
    case 'LOW':
      return 2;
    case 'UNVERIFIED':
      return 3;
  }
}

function reasonKey(reason: ConfidenceReason): string {
  return [
    reason.code,
    reason.references
      .map((reference) => `${reference.kind}:${reference.reference}`)
      .sort()
      .join('|'),
  ].join('::');
}

function orderedReasons(
  reasons: readonly ConfidenceReason[],
): readonly ConfidenceReason[] {
  const deduplicated = new Map<string, ConfidenceReason>();
  for (const reason of reasons) deduplicated.set(reasonKey(reason), reason);
  return freezeArray(
    [...deduplicated.values()].sort((left, right) => {
      const rankDifference =
        levelRank(right.maximumLevel) - levelRank(left.maximumLevel);
      if (rankDifference !== 0) return rankDifference;
      const codeDifference = left.code.localeCompare(right.code);
      if (codeDifference !== 0) return codeDifference;
      return reasonKey(left).localeCompare(reasonKey(right));
    }),
  );
}

export function assessConfidence(
  reasonsInput: readonly ConfidenceReason[],
): ConfidenceAssessment {
  const reasons = orderedReasons(reasonsInput);
  const unverified = reasons.filter(
    (reason) => reason.maximumLevel === 'UNVERIFIED',
  );
  const low = reasons.filter((reason) => reason.maximumLevel === 'LOW');
  const moderate = reasons.filter(
    (reason) => reason.maximumLevel === 'MODERATE',
  );

  const level: ConfidenceLevel =
    unverified.length > 0
      ? 'UNVERIFIED'
      : low.length > 0 || moderate.length >= 2
        ? 'LOW'
        : moderate.length === 1
          ? 'MODERATE'
          : 'HIGH';
  const dominant =
    level === 'UNVERIFIED'
      ? unverified
      : level === 'LOW'
        ? low.length > 0
          ? low
          : moderate
        : level === 'MODERATE'
          ? moderate
          : [];
  const legalConclusionStatus =
    level === 'UNVERIFIED' ||
    reasons.some(
      (reason) =>
        reason.category === 'LEGAL_BLOCKING_FAILURE' ||
        reason.category === 'MANUAL_VERIFICATION_REQUIRED',
    )
      ? ('NOT_AVAILABLE' as const)
      : ('AVAILABLE' as const);
  const userExplanation =
    level === 'HIGH'
      ? 'Confidence is high because no documented data-quality factor lowered this projection.'
      : level === 'MODERATE'
        ? 'Confidence is moderate because one documented uncertainty affects this projection.'
        : level === 'LOW'
          ? 'Confidence is low because a major uncertainty or multiple independent uncertainties affect this projection.'
          : 'Confidence is unverified because legal or route evidence is missing, blocked, or requires manual verification.';

  return freeze({
    method: 'stage-16-rules-v1' as const,
    level,
    reasons,
    dominantReasonCodes: freezeArray(
      [...new Set(dominant.map((reason) => reason.code))],
    ),
    legalConclusionStatus,
    userExplanation,
  });
}

function inputReference(reference: string, label: string): PublicEvidenceReference {
  return publicEvidenceReference('INPUT', reference, label);
}

function stopReference(stop: DataQualityStopInput): PublicEvidenceReference {
  return publicEvidenceReference(
    'STOP',
    `stop-${String(stop.sequence)}`,
    `Stop ${String(stop.sequence)}: ${stop.label}`,
  );
}

function segmentReference(
  segment: DataQualitySegmentInput,
): PublicEvidenceReference {
  return publicEvidenceReference(
    'ROUTE_SEGMENT',
    `leg-${String(segment.legSequence)}-segment-${String(segment.segmentSequence)}`,
    `Leg ${String(segment.legSequence)}, segment ${String(segment.segmentSequence)}: ${segment.label}`,
  );
}

export function dataQualityReasonsFromTrip(
  input: TripDataQualityInput,
): readonly ConfidenceReason[] {
  const reasons: ConfidenceReason[] = [];
  const revisionReferences =
    input.revisionReference === undefined
      ? []
      : [
          publicEvidenceReference(
            'REVISION',
            input.revisionReference,
            `Trip revision ${input.revisionReference}`,
          ),
        ];

  function add(
    code: ConfidenceReasonCode,
    references: readonly PublicEvidenceReference[],
    userExplanation: string,
    technicalExplanation: string,
    override?: Exclude<ConfidenceLevel, 'HIGH'>,
  ): void {
    reasons.push(
      dataQualityReason(
        code,
        [...revisionReferences, ...references],
        userExplanation,
        technicalExplanation,
        override,
      ),
    );
  }

  if (input.axleWeights === 'MISSING') {
    add(
      'MISSING_AXLE_WEIGHTS',
      [inputReference('load.axleWeights', 'Load axle weights')],
      'Axle weights are missing, so axle and route compliance cannot be concluded.',
      'Steer, drive, and trailer axle weights are legal-critical physical inputs.',
    );
  }
  if (input.kpra === 'UNKNOWN') {
    add(
      'UNKNOWN_KPRA',
      [inputReference('trailer.currentKpra', 'Current trailer KPRA')],
      'The current trailer KPRA is unknown and requires manual verification.',
      'KPRA-dependent route restrictions cannot be evaluated without current kingpin-to-rear-axle distance.',
    );
  }
  if (input.trailerDimensions === 'UNKNOWN') {
    add(
      'UNKNOWN_TRAILER_DIMENSIONS',
      [inputReference('trailer.dimensions', 'Trailer dimensions')],
      'Trailer dimensions are incomplete, so dimensional route compliance cannot be concluded.',
      'Trailer length, height, and width are legal-critical route inputs.',
    );
  }
  if (
    input.permitInformation === 'MISSING' ||
    input.permitInformation === 'UNKNOWN'
  ) {
    add(
      'PERMIT_INFORMATION_MISSING',
      [inputReference('load.permits', 'Load permit information')],
      'Permit information is missing or unresolved, so a legal route conclusion is unavailable.',
      `Permit information status is ${input.permitInformation}.`,
    );
  }
  if (input.providerRestrictions === 'UNAVAILABLE') {
    add(
      'PROVIDER_RESTRICTIONS_UNAVAILABLE',
      [inputReference('route.providerRestrictions', 'Provider route restrictions')],
      'Commercial-route restriction evidence is unavailable and requires verification.',
      'The provider did not supply the restriction fields required for a verified commercial route.',
    );
  }
  if (input.liveTraffic === 'UNAVAILABLE') {
    add(
      'LIVE_TRAFFIC_UNAVAILABLE',
      [inputReference('conditions.traffic', 'Live traffic data')],
      'Live traffic data is unavailable; the ETA excludes current congestion changes.',
      'No live traffic adjustment was supplied for this revision.',
    );
  }
  if (input.weather === 'UNAVAILABLE') {
    add(
      'WEATHER_DATA_UNAVAILABLE',
      [inputReference('conditions.weather', 'Weather data')],
      'Weather data is unavailable; the ETA excludes current weather delays.',
      'No weather adjustment was supplied for this revision.',
    );
  }

  for (const stop of input.stops) {
    if (!stop.appointmentWindowKnown) {
      add(
        'MISSING_APPOINTMENT_WINDOW',
        [stopReference(stop)],
        `${stop.label} has no appointment window, so appointment feasibility cannot be measured.`,
        `Stop ${String(stop.sequence)} appointment mode is missing or none.`,
      );
    }
    if (stop.facilityServiceTimeStatus === 'UNKNOWN') {
      add(
        'UNKNOWN_FACILITY_SERVICE_TIME',
        [stopReference(stop)],
        `${stop.label} has no known service-time estimate, which materially reduces ETA confidence.`,
        `Stop ${String(stop.sequence)} facility service duration is unknown.`,
      );
    } else if (stop.facilityServiceTimeStatus === 'ESTIMATED') {
      add(
        'USER_ESTIMATED_INPUT',
        [stopReference(stop)],
        `${stop.label} uses an estimated service duration.`,
        `Stop ${String(stop.sequence)} service duration is estimated rather than verified.`,
      );
    }
    if (stop.addressResolution === 'PARTIAL') {
      add(
        'ADDRESS_NOT_FULLY_RESOLVED',
        [stopReference(stop)],
        `${stop.label} is not fully resolved to a confirmed route location.`,
        `Stop ${String(stop.sequence)} address resolution is partial.`,
      );
    }
  }

  for (const segment of input.segments) {
    const reference = segmentReference(segment);
    if (segment.usesAverageSpeedFallback) {
      add(
        'AVERAGE_SPEED_FALLBACK',
        [reference],
        `${reference.label} uses an average-speed fallback instead of verified provider travel time.`,
        'The speed model selected its labeled fallback average for this route segment.',
      );
    }
    if (!segment.localTruckAccessVerified) {
      add(
        'LOCAL_TRUCK_ACCESS_UNVERIFIED',
        [reference],
        `${reference.label} does not have verified local truck access.`,
        'Local terminal or final-mile truck access evidence is absent or unverified.',
      );
    }
    if (segment.manualVerificationRequired) {
      add(
        'ROUTE_SEGMENT_MANUAL_VERIFICATION',
        [reference],
        `${reference.label} requires manual route verification before a legal conclusion is available.`,
        'A provider or regulatory restriction marked this segment for manual verification.',
      );
    }
  }

  for (const estimated of input.userEstimatedInputs) {
    add(
      'USER_ESTIMATED_INPUT',
      [inputReference(estimated.fieldPath, estimated.label)],
      `${estimated.label} is user-estimated rather than independently verified.`,
      `${estimated.fieldPath} is classified as user-estimated.`,
      estimated.legalCritical ? 'LOW' : undefined,
    );
  }

  return orderedReasons(reasons);
}
