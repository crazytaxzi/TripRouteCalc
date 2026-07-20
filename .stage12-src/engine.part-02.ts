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
