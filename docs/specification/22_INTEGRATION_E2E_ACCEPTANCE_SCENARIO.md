# 22. Integration, End-to-End, and Acceptance Scenario

> Use this source as the active assignment for one dedicated implementation chat.  
> Read `00_SHARED_GUARDRAILS.md`, the repository implementation ledger, and every prerequisite source listed below before changing code.  
> Inspect the real repository first. Existing code is authoritative over guessed names, paths, schemas, packages, or architecture.

## Prerequisites

- Sources 01 through 21 substantially complete
- Real commercial-routing integration available, or its absence explicitly blocks live route acceptance

## Goal

Prove that the engines and interfaces work together, repair integration defects, and execute the master Portland-to-Salem-to-Redding-to-Sacramento scenario without hardcoding it.

## Required work

1. Implement all multi-stop, route-compliance, and time test scenarios from the master specification.
2. Add full API integration tests from trip creation through revision retrieval, timeline, compliance, and export.
3. Add browser end-to-end tests for:
   - driver clocks
   - equipment/load entry
   - stop creation/reordering
   - appointment settings
   - calculation
   - warnings
   - KPRA action
   - recalculation
   - timeline/results
   - exports
4. Execute the acceptance scenario as user-entered data.
5. Verify:
   - commercial route request
   - California KPRA evaluation
   - 42-foot entered KPRA warning
   - required adjustment/reroute
   - axle-weight recheck
   - 45-minute shipper event
   - interruption qualification decision
   - required 10-hour rest insertion when a clock requires it
   - Redding arrival/departure
   - Sacramento arrival/service completion
   - local time zones
   - clocks at every arrival/departure
   - plain-language explanation
6. Test provider unavailable, unverified local access, prohibited segment, low clearance, weight restriction, stricter KPRA, and consumer/commercial route divergence.
7. Verify deterministic recalculation from the same revision inputs.
8. Do not fake production provider or regulatory responses to declare acceptance.
9. Record screenshots/logs/test reports according to repository practice.
10. Repair cross-module defects while preserving established boundaries.

## Exit gate

All applicable automated scenarios pass and the acceptance scenario is either verified with real data or explicitly blocked by named external data/credential limitations. It must never be reported as legally verified from fake data.

## Required master scenarios

### Multi-stop tests

1. Shipper, one intermediate stop, and final.
2. Five intermediate stops.
3. Stop reordered after initial calculation.
4. Stop added between two existing stops.
5. Different service duration at every stop.
6. Early appointment arrival with waiting time.
7. Late appointment.
8. Required break overlaps a qualifying stop.
9. Required 10-hour rest overlaps an overnight facility wait.
10. Stop in a different time zone.

### Route-compliance tests

1. Oregon origin to California destination with compliant KPRA.
2. Oregon origin to California destination with excessive KPRA.
3. KPRA adjustment resolves length issue but causes axle-weight warning.
4. Route segment with 38-foot KPRA restriction.
5. Low-clearance road rejected.
6. Weight-restricted bridge rejected.
7. Consumer route differs from commercial route.
8. Route provider unavailable.
9. Local terminal access cannot be confirmed.
10. Route crosses multiple jurisdictions with different rules.

### Time tests

1. Pacific to Mountain time.
2. Mountain to Central time.
3. Central to Eastern time.
4. Daylight-saving spring transition.
5. Daylight-saving fall transition.
6. Appointment entered in destination-local time.
7. Route crossing a time-zone boundary during a rest period.

## Acceptance scenario

## 23. Example Planning Scenario

Use the following scenario as an acceptance test, not as hardcoded application data.

Driver departure state:

* Start: Portland, Oregon
* Departure: user-selected date at 8:00 AM Pacific
* Drive remaining: 8 hours 30 minutes
* Shift remaining: 10 hours
* Cycle remaining: 18 hours
* Time driven since last qualifying interruption: 2 hours
* Solo property-carrying driver
* 70-hour/8-day cycle

Equipment:

* Sleeper tractor
* 53-foot tandem-axle dry van
* Sliding tandems
* Entered KPRA: 42 feet
* Minimum achievable KPRA: 37 feet
* Standard legal width and height
* User-entered axle weights

Stops:

1. Start terminal in Portland
2. Shipper in Salem, Oregon

   * 45-minute expected service
3. Intermediate delivery near Redding, California

   * 60-minute expected service
4. Final delivery near Sacramento, California

   * 60-minute expected service

The application must:

* Generate a commercial route.
* Detect that California KPRA compliance must be evaluated.
* Warn that the entered 42-foot KPRA is not acceptable for a route requiring 40 feet or less.
* Require tandem adjustment or rerouting before treating the route as legal.
* Recheck axle weights after the proposed adjustment.
* Apply 45 minutes at the shipper.
* Calculate whether that stop satisfies a required 30-minute interruption.
* Insert a 10-hour break when any applicable clock prevents further driving.
* Calculate arrival and departure at Redding.
* Calculate arrival and service completion at Sacramento.
* Display every timestamp in the stop’s local time zone.
* Show remaining driving, shift, and cycle clocks at every arrival and departure.
* Explain the calculations in plain language.

## Required completion report

Before ending the chat, provide:

1. What you inspected before coding.
2. What you implemented.
3. Every file created, changed, moved, or deleted.
4. Database migrations or data changes, if any.
5. Commands actually run.
6. Test, lint, type-check, migration, and build results.
7. Remaining blockers, missing credentials, unverified legal data, or known limitations.
8. The exact next source file that should be used in the next dedicated chat.

Do not report success for checks that were not actually run. Update the repository's implementation ledger and create a concise handoff note for this stage.
