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
