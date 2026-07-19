# 13. California KPRA, Tandem Adjustment, and Axle Revalidation

> Use this source as the active assignment for one dedicated implementation chat.  
> Read `00_SHARED_GUARDRAILS.md`, the repository implementation ledger, and every prerequisite source listed below before changing code.  
> Inspect the real repository first. Existing code is authoritative over guessed names, paths, schemas, packages, or architecture.

## Prerequisites

- Sources 09, 11, and 12 completed
- Route-segment compliance findings supported

## Goal

Implement the acceptance-quality California KPRA workflow as a first concrete route-specific regulatory module, while keeping it data-driven and reusable for stricter local or route-specific limits.

## Required work

1. Track actual kingpin-to-rearmost-axle measurement as a physical unit.
2. Evaluate the applicable maximum for the selected route and exact restricted segment.
3. Support limits stricter than a general statewide maximum.
4. Detect excessive entered KPRA and block legal-route finalization until resolved.
5. Identify and show the last reasonable adjustment point before the restricted segment when routing/facility data supports it.
6. Produce a clear action warning including entered KPRA, allowed KPRA, affected segment, and choices.
7. Require post-adjustment confirmation of:
   - new verified KPRA
   - trailer axle weight
   - drive axle weight
   - total gross weight
   - load distribution confirmation
8. Re-run weight and route compliance after adjustment.
9. Do not assume tandem movement preserves axle legality.
10. Support rerouting when adjustment cannot make the configuration legal.
11. Add the required Oregon-to-California compliant/noncompliant tests, a stricter 38-foot segment, and an axle-warning-after-adjustment case.
12. Store the rule source, version, date, action, acknowledgement, and recalculation revision.

## Hard boundaries

- Do not call it merely a “40-foot trailer mark.”
- Do not assume rail markings equal KPRA.
- Do not hardcode one California value as universally valid.
- Do not mark the route legal before axle weights are rechecked.

## Exit gate

The Portland/Oregon-to-California route can produce a sourced, segment-specific KPRA action and require a new revision after verified adjustment.

## Relevant master requirements

## 10. State and Local Regulatory Rules Engine

Create a separate compliance-rules engine.

Do not merge regulatory rules directly into the route provider adapter.

Each rule must contain:

* Unique rule identifier
* Jurisdiction
* Rule category
* Vehicle types affected
* Road or route scope
* Effective date
* Expiration date, when applicable
* Source authority
* Source title
* Source retrieval date
* Source version
* Human-readable explanation
* Machine-evaluable conditions
* Required action
* Severity
* Whether the rule blocks the route
* Whether manual verification is required

Supported rule severities:

* INFORMATION
* ADVISORY
* ACTION_REQUIRED
* ROUTE_RESTRICTED
* ROUTE_ILLEGAL
* MANUAL_VERIFICATION_REQUIRED

Rules must be selected according to the exact route geometry and road segments.

Do not apply every rule from every state merely because the route crosses that state.

### California tandem and KPRA example

Model the Oregon-to-California example correctly.

For a typical 53-foot semitrailer with two or more rear axles:

* Track the actual kingpin-to-rearmost-axle measurement.
* Evaluate the California maximum applicable to the selected route.
* Warn before the vehicle enters California when tandem adjustment is required.
* Show the last reasonable adjustment location before the border or restricted segment.
* Do not refer only to a vague “40-foot trailer mark.”
* Do not assume all trailer rail markings measure KPRA identically.
* Some routes or local jurisdictions may require a shorter KPRA than the general maximum.
* A route that cannot accommodate the entered KPRA must be rejected or rerouted.

Example warning:

“California route compliance action required before entering the restricted segment. Entered KPRA: 42 ft 6 in. Maximum supported by the selected route: 40 ft. Move the sliding tandem to achieve a verified KPRA of 40 ft or less, confirm axle weights remain legal, or select another legal route.”

After a tandem adjustment, require the user to confirm:

* New KPRA
* Trailer axle weight
* Drive axle weight
* Total gross weight
* Whether the load remains properly distributed

Moving the tandems for length compliance must not be assumed to preserve axle-weight compliance.

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
