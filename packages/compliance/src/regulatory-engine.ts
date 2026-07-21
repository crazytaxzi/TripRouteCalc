import type {
  JurisdictionRule,
  RegulatoryActionLocation,
  RegulatoryComparisonOperator,
  RegulatoryComplianceFinding,
  RegulatoryComplianceResult,
  RegulatoryCondition,
  RegulatoryEvaluationInput,
  RegulatoryEvaluationStatus,
  RegulatoryIntegerFact,
  RegulatoryLengthFact,
  RegulatoryRequiredAction,
  RegulatoryRoadScope,
  RegulatoryRouteSegmentContext,
  RegulatoryRuleSeverity,
  RegulatorySource,
  RegulatoryStringFact,
  RegulatoryWeightFact,
} from '@trip-route-calc/foundation/regulatory';
import { validateRegulatoryEvaluationInput } from '@trip-route-calc/foundation/regulatory';
import type { Length, UtcInstant, Weight } from '@trip-route-calc/foundation';

interface EvaluationTrace {
  readonly status: 'matched' | 'unmatched' | 'unknown';
  readonly facts: Readonly<Record<string, unknown>>;
}

const severityRank: Readonly<Record<RegulatoryRuleSeverity, number>> = {
  information: 0,
  advisory: 1,
  'action-required': 2,
  'manual-verification-required': 3,
  'route-restricted': 4,
  'route-illegal': 5,
};

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function freezeArray<T>(value: readonly T[]): readonly T[] {
  return Object.freeze([...value]);
}

function compareNumbers(
  actual: number,
  expected: number,
  operator: RegulatoryComparisonOperator,
): boolean {
  switch (operator) {
    case 'greater-than':
      return actual > expected;
    case 'greater-than-or-equal':
      return actual >= expected;
    case 'less-than':
      return actual < expected;
    case 'less-than-or-equal':
      return actual <= expected;
    case 'equal':
      return actual === expected;
    case 'not-equal':
      return actual !== expected;
  }
}

function stringFact(
  fact: RegulatoryStringFact,
  input: RegulatoryEvaluationInput,
  segment: RegulatoryRouteSegmentContext,
): string | readonly string[] | undefined {
  switch (fact) {
    case 'segment.jurisdiction-code':
      return segment.segment.jurisdictionCodes;
    case 'segment.road-identity':
      return segment.roadIdentity;
    case 'segment.direction':
      return segment.direction;
    case 'load.hazmat-class':
      return input.equipment.load.hazmatClass;
  }
}

function lengthFact(
  fact: RegulatoryLengthFact,
  input: RegulatoryEvaluationInput,
): Length | undefined {
  switch (fact) {
    case 'vehicle.tractor.overall-length':
      return input.equipment.tractor.overallLength;
    case 'vehicle.tractor.height':
      return input.equipment.tractor.height;
    case 'vehicle.tractor.width':
      return input.equipment.tractor.width;
    case 'vehicle.trailer.length':
      return input.equipment.trailer.length;
    case 'vehicle.trailer.height':
      return input.equipment.trailer.height;
    case 'vehicle.trailer.width':
      return input.equipment.trailer.width;
    case 'vehicle.trailer.kpra':
      return input.equipment.trailer.currentKpra;
    case 'vehicle.combined.overall-length':
      return input.equipment.combinedDimensions.overallLength;
    case 'vehicle.combined.height':
      return input.equipment.combinedDimensions.height;
    case 'vehicle.combined.width':
      return input.equipment.combinedDimensions.width;
    case 'load.length':
      return input.equipment.load.length;
    case 'load.height':
      return input.equipment.load.height;
    case 'load.width':
      return input.equipment.load.width;
    case 'load.front-overhang':
      return input.equipment.load.frontOverhang;
    case 'load.rear-overhang':
      return input.equipment.load.rearOverhang;
  }
}

function weightFact(
  fact: RegulatoryWeightFact,
  input: RegulatoryEvaluationInput,
): Weight {
  switch (fact) {
    case 'load.steer-axle-weight':
      return input.equipment.load.steerAxleWeight;
    case 'load.drive-axle-weight':
      return input.equipment.load.driveAxleWeight;
    case 'load.trailer-axle-weight':
      return input.equipment.load.trailerAxleWeight;
    case 'load.total-gross-combination-weight':
      return input.equipment.load.totalGrossCombinationWeight;
  }
}

function integerFact(
  fact: RegulatoryIntegerFact,
  input: RegulatoryEvaluationInput,
): number {
  switch (fact) {
    case 'vehicle.total-axle-count':
      return input.equipment.totalAxleCount;
    case 'vehicle.trailer-count':
      return input.equipment.trailerCount;
    case 'vehicle.tractor-axle-count':
      return input.equipment.tractor.axleCount;
    case 'vehicle.trailer-axle-count':
      return input.equipment.trailer.axleCount;
  }
}

function mergeFacts(
  traces: readonly EvaluationTrace[],
): Readonly<Record<string, unknown>> {
  const facts: Record<string, unknown> = {};
  for (const trace of traces) Object.assign(facts, trace.facts);
  return freeze(facts);
}

function evaluateCondition(
  condition: RegulatoryCondition,
  input: RegulatoryEvaluationInput,
  segment: RegulatoryRouteSegmentContext,
): EvaluationTrace {
  switch (condition.kind) {
    case 'all': {
      const traces = condition.conditions.map((candidate) =>
        evaluateCondition(candidate, input, segment),
      );
      return freeze({
        status: traces.some((trace) => trace.status === 'unmatched')
          ? 'unmatched'
          : traces.some((trace) => trace.status === 'unknown')
            ? 'unknown'
            : 'matched',
        facts: mergeFacts(traces),
      });
    }
    case 'any': {
      const traces = condition.conditions.map((candidate) =>
        evaluateCondition(candidate, input, segment),
      );
      return freeze({
        status: traces.some((trace) => trace.status === 'matched')
          ? 'matched'
          : traces.some((trace) => trace.status === 'unknown')
            ? 'unknown'
            : 'unmatched',
        facts: mergeFacts(traces),
      });
    }
    case 'not': {
      const trace = evaluateCondition(condition.condition, input, segment);
      return freeze({
        status:
          trace.status === 'unknown'
            ? 'unknown'
            : trace.status === 'matched'
              ? 'unmatched'
              : 'matched',
        facts: trace.facts,
      });
    }
    case 'string': {
      const actual = stringFact(condition.fact, input, segment);
      const facts = freeze({
        [condition.fact]: actual ?? null,
        [`${condition.fact}.operator`]: condition.operator,
        [`${condition.fact}.expected`]: condition.value,
      });
      if (actual === undefined || (Array.isArray(actual) && actual.length === 0)) {
        return freeze({ status: 'unknown', facts });
      }
      const actualValues = typeof actual === 'string' ? [actual] : actual;
      const expectedValues =
        typeof condition.value === 'string' ? [condition.value] : condition.value;
      const overlaps = actualValues.some((value) => expectedValues.includes(value));
      const matched =
        condition.operator === 'not-equal'
          ? !overlaps
          : condition.operator === 'equal'
            ? overlaps
            : overlaps;
      return freeze({ status: matched ? 'matched' : 'unmatched', facts });
    }
    case 'boolean': {
      const actual =
        condition.fact === 'load.hazmat'
          ? input.equipment.load.hazmat
          : segment.localAccessVerified;
      return freeze({
        status: actual === condition.value ? 'matched' : 'unmatched',
        facts: freeze({
          [condition.fact]: actual,
          [`${condition.fact}.expected`]: condition.value,
        }),
      });
    }
    case 'length': {
      const actual = lengthFact(condition.fact, input);
      const facts = freeze({
        [condition.fact]: actual ?? null,
        [`${condition.fact}.operator`]: condition.operator,
        [`${condition.fact}.expected`]: condition.value,
      });
      if (actual === undefined) return freeze({ status: 'unknown', facts });
      return freeze({
        status: compareNumbers(actual.value, condition.value.value, condition.operator)
          ? 'matched'
          : 'unmatched',
        facts,
      });
    }
    case 'weight': {
      const actual = weightFact(condition.fact, input);
      return freeze({
        status: compareNumbers(actual.value, condition.value.value, condition.operator)
          ? 'matched'
          : 'unmatched',
        facts: freeze({
          [condition.fact]: actual,
          [`${condition.fact}.operator`]: condition.operator,
          [`${condition.fact}.expected`]: condition.value,
        }),
      });
    }
    case 'integer': {
      const actual = integerFact(condition.fact, input);
      return freeze({
        status: compareNumbers(actual, condition.value, condition.operator)
          ? 'matched'
          : 'unmatched',
        facts: freeze({
          [condition.fact]: actual,
          [`${condition.fact}.operator`]: condition.operator,
          [`${condition.fact}.expected`]: condition.value,
        }),
      });
    }
    case 'permit': {
      const present = input.permitIdentifiers.length > 0;
      const contains =
        condition.permitIdentifier !== undefined &&
        input.permitIdentifiers.includes(condition.permitIdentifier);
      const matched =
        condition.operator === 'present'
          ? present
          : condition.operator === 'missing'
            ? !present
            : contains;
      return freeze({
        status: matched ? 'matched' : 'unmatched',
        facts: freeze({
          permitIdentifiers: input.permitIdentifiers,
          permitOperator: condition.operator,
          permitIdentifier: condition.permitIdentifier ?? null,
        }),
      });
    }
    case 'time-window': {
      const evaluation = Date.parse(input.evaluationAt);
      const matched =
        evaluation >= Date.parse(condition.startsAt) &&
        evaluation < Date.parse(condition.endsAt);
      return freeze({
        status: matched ? 'matched' : 'unmatched',
        facts: freeze({
          evaluationAt: input.evaluationAt,
          windowStartsAt: condition.startsAt,
          windowEndsAt: condition.endsAt,
        }),
      });
    }
  }
}

function geometryBoundsTrace(
  scope: Extract<RegulatoryRoadScope, { readonly kind: 'geometry-bounds' }>,
  segment: RegulatoryRouteSegmentContext,
): EvaluationTrace {
  if (segment.segment.geometry.format !== 'geojson-line-string') {
    return freeze({
      status: 'unknown',
      facts: freeze({
        geometryFormat: segment.segment.geometry.format,
        requiredBounds: scope,
      }),
    });
  }
  const longitudes = segment.segment.geometry.coordinates.map(([longitude]) => longitude);
  const latitudes = segment.segment.geometry.coordinates.map(([, latitude]) => latitude);
  const west = Math.min(...longitudes);
  const east = Math.max(...longitudes);
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);
  const intersects =
    west <= scope.east && east >= scope.west && south <= scope.north && north >= scope.south;
  return freeze({
    status: intersects ? 'matched' : 'unmatched',
    facts: freeze({ segmentBounds: { west, east, south, north }, requiredBounds: scope }),
  });
}

function scopeTrace(
  rule: JurisdictionRule,
  segment: RegulatoryRouteSegmentContext,
): EvaluationTrace {
  const jurisdictionCodes = segment.segment.jurisdictionCodes;
  if (jurisdictionCodes.length === 0) {
    return freeze({
      status: 'unknown',
      facts: freeze({ segmentJurisdictionCodes: jurisdictionCodes }),
    });
  }
  if (!jurisdictionCodes.includes(rule.jurisdictionCode)) {
    return freeze({
      status: 'unmatched',
      facts: freeze({ segmentJurisdictionCodes: jurisdictionCodes }),
    });
  }
  switch (rule.roadScope.kind) {
    case 'jurisdiction-wide': {
      const matched = rule.roadScope.jurisdictionCodes.some((code) =>
        jurisdictionCodes.includes(code),
      );
      return freeze({
        status: matched ? 'matched' : 'unmatched',
        facts: freeze({ segmentJurisdictionCodes: jurisdictionCodes }),
      });
    }
    case 'road-identity': {
      if (segment.roadIdentity === undefined) {
        return freeze({
          status: 'unknown',
          facts: freeze({ roadIdentity: null, direction: segment.direction ?? null }),
        });
      }
      if (!rule.roadScope.roadIdentities.includes(segment.roadIdentity)) {
        return freeze({
          status: 'unmatched',
          facts: freeze({ roadIdentity: segment.roadIdentity }),
        });
      }
      if (
        rule.roadScope.directions.length === 0 ||
        rule.roadScope.directions.includes('both')
      ) {
        return freeze({
          status: 'matched',
          facts: freeze({ roadIdentity: segment.roadIdentity, direction: segment.direction ?? null }),
        });
      }
      if (segment.direction === undefined || segment.direction === 'unknown') {
        return freeze({
          status: 'unknown',
          facts: freeze({ roadIdentity: segment.roadIdentity, direction: segment.direction ?? null }),
        });
      }
      return freeze({
        status: rule.roadScope.directions.includes(segment.direction)
          ? 'matched'
          : 'unmatched',
        facts: freeze({ roadIdentity: segment.roadIdentity, direction: segment.direction }),
      });
    }
    case 'segment':
      return freeze({
        status: rule.roadScope.segmentIds.includes(segment.segment.segmentId)
          ? 'matched'
          : 'unmatched',
        facts: freeze({ segmentId: segment.segment.segmentId }),
      });
    case 'geometry-bounds':
      return geometryBoundsTrace(rule.roadScope, segment);
  }
}

function isEffective(
  effectiveFrom: UtcInstant,
  effectiveTo: UtcInstant | undefined,
  evaluationAt: UtcInstant,
): boolean {
  const evaluation = Date.parse(evaluationAt);
  return (
    evaluation >= Date.parse(effectiveFrom) &&
    (effectiveTo === undefined || evaluation < Date.parse(effectiveTo))
  );
}

function sourceKey(source: RegulatorySource): string {
  return [source.authorityType, source.authorityName, source.reference, source.version].join('|');
}

function manualAction(instruction: string): RegulatoryRequiredAction {
  return freeze({
    code: 'MANUAL_VERIFICATION_REQUIRED',
    instruction,
    mustCompleteBeforeSegment: true,
    requiredUpdatedFacts: freezeArray([]),
  });
}

function providerFinding(
  input: RegulatoryEvaluationInput,
  segment: RegulatoryRouteSegmentContext,
  code: string,
  explanation: string,
  severity: RegulatoryRuleSeverity = 'manual-verification-required',
  actionLocation?: RegulatoryActionLocation,
): RegulatoryComplianceFinding {
  const jurisdictionCode = segment.segment.jurisdictionCodes[0] ?? 'UNKNOWN';
  return freeze({
    findingId: `provider:${code}:${segment.segment.segmentId}`,
    ruleSetVersion: input.ruleSet.version,
    affectedSegmentId: segment.segment.segmentId,
    jurisdictionCode,
    category: 'provider-evidence',
    severity,
    source: input.ruleSet.source,
    inputFacts: freeze({
      providerName: input.providerName,
      providerVersion: input.providerVersion ?? null,
      providerRequestId: input.providerRequestId ?? null,
      providerVerificationStatus: input.providerVerificationStatus,
      segmentVerificationStatus: segment.segment.verificationStatus,
      unavailableFields: segment.segment.unavailableFields,
      localAccessSegment: segment.localAccessSegment,
      localAccessVerified: segment.localAccessVerified,
    }),
    explanation,
    requiredAction: manualAction(
      'Verify the affected segment and current restrictions with an authoritative commercial-routing or official regulatory source before finalization.',
    ),
    ...(actionLocation === undefined ? {} : { actionLocation }),
    blocksRouteFinalization: true,
    requiresManualVerification: severity === 'manual-verification-required',
    lastVerifiedAt: input.ruleSet.source.lastVerifiedAt,
  });
}

function ruleFinding(
  input: RegulatoryEvaluationInput,
  segment: RegulatoryRouteSegmentContext,
  rule: JurisdictionRule,
  facts: Readonly<Record<string, unknown>>,
): RegulatoryComplianceFinding {
  return freeze({
    findingId: `rule:${rule.ruleId}:${segment.segment.segmentId}`,
    ruleId: rule.ruleId,
    ruleSetVersion: input.ruleSet.version,
    affectedSegmentId: segment.segment.segmentId,
    jurisdictionCode: rule.jurisdictionCode,
    category: rule.category,
    severity: rule.severity,
    source: rule.source,
    effectiveRuleVersion: rule.version,
    inputFacts: facts,
    explanation: rule.explanation,
    requiredAction: freeze({
      ...rule.requiredAction,
      requiredUpdatedFacts: freezeArray(rule.requiredAction.requiredUpdatedFacts),
    }),
    ...(segment.lastReasonableActionLocation === undefined
      ? {}
      : { actionLocation: segment.lastReasonableActionLocation }),
    blocksRouteFinalization: rule.blocksRouteFinalization,
    requiresManualVerification: rule.requiresManualVerification,
    lastVerifiedAt: rule.source.lastVerifiedAt,
  });
}

function unknownRuleFinding(
  input: RegulatoryEvaluationInput,
  segment: RegulatoryRouteSegmentContext,
  rule: JurisdictionRule,
  facts: Readonly<Record<string, unknown>>,
  explanation: string,
): RegulatoryComplianceFinding {
  return freeze({
    findingId: `rule-unknown:${rule.ruleId}:${segment.segment.segmentId}`,
    ruleId: rule.ruleId,
    ruleSetVersion: input.ruleSet.version,
    affectedSegmentId: segment.segment.segmentId,
    jurisdictionCode: rule.jurisdictionCode,
    category: rule.category,
    severity: 'manual-verification-required',
    source: rule.source,
    effectiveRuleVersion: rule.version,
    inputFacts: facts,
    explanation,
    requiredAction: manualAction(
      `Obtain the missing route or vehicle facts needed to evaluate rule ${rule.ruleId}.`,
    ),
    ...(segment.lastReasonableActionLocation === undefined
      ? {}
      : { actionLocation: segment.lastReasonableActionLocation }),
    blocksRouteFinalization: true,
    requiresManualVerification: true,
    lastVerifiedAt: rule.source.lastVerifiedAt,
  });
}

function resultStatus(
  findings: readonly RegulatoryComplianceFinding[],
  systemicBlocked: boolean,
): RegulatoryEvaluationStatus {
  if (systemicBlocked) return 'blocked';
  const highest = findings.reduce<RegulatoryRuleSeverity | undefined>(
    (current, finding) =>
      current === undefined || severityRank[finding.severity] > severityRank[current]
        ? finding.severity
        : current,
    undefined,
  );
  switch (highest) {
    case undefined:
    case 'information':
      return 'compliant';
    case 'advisory':
      return 'advisory';
    case 'action-required':
      return 'action-required';
    case 'manual-verification-required':
      return 'manual-verification-required';
    case 'route-restricted':
      return 'route-restricted';
    case 'route-illegal':
      return 'route-illegal';
  }
}

function oldestVerification(sources: readonly RegulatorySource[]): UtcInstant {
  const first = sources[0];
  if (first === undefined) {
    throw new RangeError('At least one regulatory source is required.');
  }
  return sources.slice(1).reduce(
    (oldest, source) =>
      Date.parse(source.lastVerifiedAt) < Date.parse(oldest)
        ? source.lastVerifiedAt
        : oldest,
    first.lastVerifiedAt,
  );
}

export function evaluateRegulatoryCompliance(
  inputValue: unknown,
): RegulatoryComplianceResult {
  const input = validateRegulatoryEvaluationInput(inputValue);
  const findings = new Map<string, RegulatoryComplianceFinding>();
  const explanations: string[] = [];
  const systemicBlocked =
    input.routeKind !== 'commercial-vehicle' ||
    input.ruleSet.status !== 'active' ||
    !isEffective(input.ruleSet.effectiveFrom, input.ruleSet.effectiveTo, input.evaluationAt);

  if (input.routeKind !== 'commercial-vehicle') {
    explanations.push('Consumer-route comparisons cannot be finalized as legal CMV routes.');
  }
  if (input.ruleSet.status !== 'active') {
    explanations.push(`Regulatory rule set ${input.ruleSet.version} is not active.`);
  }
  if (!isEffective(input.ruleSet.effectiveFrom, input.ruleSet.effectiveTo, input.evaluationAt)) {
    explanations.push(`Regulatory rule set ${input.ruleSet.version} is not effective at the evaluation time.`);
  }

  for (const segment of input.segments) {
    if (
      input.routeKind !== 'commercial-vehicle' ||
      input.providerVerificationStatus === 'consumer-comparison-only'
    ) {
      const finding = providerFinding(
        input,
        segment,
        'CONSUMER_ROUTE_EXCLUDED',
        'The route is a consumer comparison and is excluded from CMV legal finalization.',
      );
      findings.set(finding.findingId, finding);
    } else if (input.providerVerificationStatus === 'unverified') {
      const finding = providerFinding(
        input,
        segment,
        'PROVIDER_ROUTE_UNVERIFIED',
        'Commercial-provider verification is unavailable for the route.',
      );
      findings.set(finding.findingId, finding);
    } else if (
      input.providerVerificationStatus === 'partially-verified' &&
      segment.segment.verificationStatus !== 'verified'
    ) {
      const finding = providerFinding(
        input,
        segment,
        'SEGMENT_PROVIDER_GAP',
        'The commercial provider did not verify this route segment.',
      );
      findings.set(finding.findingId, finding);
    }

    if (segment.segment.verificationStatus === 'prohibited') {
      const finding = providerFinding(
        input,
        segment,
        'SEGMENT_PROHIBITED',
        'The commercial-routing evidence marks this segment as prohibited.',
        'route-illegal',
      );
      findings.set(finding.findingId, finding);
    }

    if (
      segment.segment.unavailableFields.some(
        (field) => field.impact === 'blocks-commercial-planning',
      )
    ) {
      const finding = providerFinding(
        input,
        segment,
        'CRITICAL_PROVIDER_FIELD_UNAVAILABLE',
        'A safety-critical provider field is unavailable for this segment.',
      );
      findings.set(finding.findingId, finding);
    }

    if (segment.localAccessSegment && !segment.localAccessVerified) {
      const finding = providerFinding(
        input,
        segment,
        'LOCAL_ACCESS_UNVERIFIED',
        'Local terminal or facility access for this segment has not been verified.',
        'manual-verification-required',
        segment.lastReasonableActionLocation,
      );
      findings.set(finding.findingId, finding);
    }

    if (
      input.ruleSet.coverage.status !== 'complete' ||
      segment.segment.jurisdictionCodes.some(
        (code) => !input.ruleSet.coverage.jurisdictionCodes.includes(code),
      )
    ) {
      const finding = providerFinding(
        input,
        segment,
        'REGULATORY_COVERAGE_GAP',
        'The active rule set does not claim complete verified coverage for every jurisdiction on this segment.',
      );
      findings.set(finding.findingId, finding);
    }

    for (const rule of input.ruleSet.rules) {
      if (
        !rule.active ||
        !isEffective(rule.effectiveFrom, rule.effectiveTo, input.evaluationAt) ||
        !rule.affectedVehicleTypes.includes(input.vehicleType)
      ) {
        continue;
      }
      const scope = scopeTrace(rule, segment);
      if (scope.status === 'unmatched') continue;
      if (scope.status === 'unknown') {
        const finding = unknownRuleFinding(
          input,
          segment,
          rule,
          scope.facts,
          `The exact route scope for rule ${rule.ruleId} cannot be verified from the available segment evidence.`,
        );
        findings.set(finding.findingId, finding);
        continue;
      }
      const condition = evaluateCondition(rule.condition, input, segment);
      const facts = freeze({ ...scope.facts, ...condition.facts });
      if (condition.status === 'unknown') {
        const finding = unknownRuleFinding(
          input,
          segment,
          rule,
          facts,
          `Rule ${rule.ruleId} cannot be evaluated because a required fact is unavailable.`,
        );
        findings.set(finding.findingId, finding);
      } else if (condition.status === 'matched') {
        const finding = ruleFinding(input, segment, rule, facts);
        findings.set(finding.findingId, finding);
      }
    }
  }

  const orderedFindings = freezeArray(
    [...findings.values()].sort(
      (left, right) =>
        left.affectedSegmentId.localeCompare(right.affectedSegmentId) ||
        severityRank[right.severity] - severityRank[left.severity] ||
        left.findingId.localeCompare(right.findingId),
    ),
  );
  const sourceMap = new Map<string, RegulatorySource>();
  sourceMap.set(sourceKey(input.ruleSet.source), input.ruleSet.source);
  for (const rule of input.ruleSet.rules) {
    if (rule.active && isEffective(rule.effectiveFrom, rule.effectiveTo, input.evaluationAt)) {
      sourceMap.set(sourceKey(rule.source), rule.source);
    }
  }
  const sources = freezeArray([...sourceMap.values()]);
  const status = resultStatus(orderedFindings, systemicBlocked);
  const legalFinalizationStatus =
    systemicBlocked || orderedFindings.some((finding) => finding.blocksRouteFinalization)
      ? 'blocked'
      : 'allowed';
  explanations.push(
    legalFinalizationStatus === 'allowed'
      ? 'Every applicable active rule was evaluated against exact segment and vehicle facts without a blocking finding.'
      : 'Legal finalization remains blocked until every blocking finding is resolved or verified.',
  );
  for (const limitation of input.ruleSet.coverage.limitations) {
    explanations.push(`Rule-set coverage limitation: ${limitation}`);
  }

  return freeze({
    routeId: input.routeId,
    ruleSetId: input.ruleSet.ruleSetId,
    ruleSetVersion: input.ruleSet.version,
    evaluatedAt: input.evaluationAt,
    status,
    legalFinalizationStatus,
    findings: orderedFindings,
    evaluatedSegmentIds: freezeArray(
      input.segments.map((segment) => segment.segment.segmentId),
    ),
    manualVerificationSegmentIds: freezeArray(
      [...new Set(
        orderedFindings
          .filter((finding) => finding.requiresManualVerification)
          .map((finding) => finding.affectedSegmentId),
      )],
    ),
    lastVerifiedAt: oldestVerification(sources),
    sourceAttribution: sources,
    explanations: freezeArray(explanations),
  });
}
