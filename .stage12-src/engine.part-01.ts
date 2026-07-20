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
    actionLocation,
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
    actionLocation: segment.lastReasonableActionLocation,
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
    actionLocation: segment.lastReasonableActionLocation,
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