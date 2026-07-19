# 12. Regulatory Rules Engine and Update Workflow

> Use this source as the active assignment for one dedicated implementation chat.  
> Read `00_SHARED_GUARDRAILS.md`, the repository implementation ledger, and every prerequisite source listed below before changing code.  
> Inspect the real repository first. Existing code is authoritative over guessed names, paths, schemas, packages, or architecture.

## Prerequisites

- Sources 03 and 11 completed
- Route segments and versioned persistence available

## Goal

Implement a separate, data-driven compliance engine that selects versioned federal, state, and local rules against exact route segments and vehicle/load facts.

## Required work

1. Implement the full jurisdiction-rule metadata model from the master specification.
2. Support every rule severity and distinguish advisory, action, restriction, illegality, and manual verification.
3. Represent machine-evaluable conditions separately from human explanations and source metadata.
4. Evaluate rules against exact route geometry, road identity, direction, vehicle configuration, date/time, permits, and load facts.
5. Do not apply every rule in a state merely because the route crosses the state.
6. Produce structured compliance findings with:
   - affected segment
   - source
   - effective version
   - input facts
   - required action
   - blocking status
   - manual verification
7. Create an administrative review/update workflow with audit logging, activation/deactivation, change history, and tests tied to rule versions.
8. Display last-verified date and official-source attribution.
9. Prefer authoritative federal, state, enforcement, legislative, municipal, permit, and contracted routing sources.
10. Do not make blogs the authoritative legal record.
11. Add tests for multiple jurisdictions, expired rules, route-scoped rules, provider gaps, and manual verification.
12. Document how legal researchers or administrators add and verify a rule without changing engine code.

## Hard boundaries

- Keep regulatory logic out of route-provider adapters and HOS arithmetic.
- Do not hardcode changing law in UI components.
- Do not claim an unverified local-access segment is legal.
- Do not automatically invoke exemptions.

## Exit gate

A versioned rule set can evaluate a route revision reproducibly and explain every finding with source and affected segment.

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

## 24. Regulatory Update Strategy

Do not treat regulatory data as timeless.

Create:

* Rule-set versioning
* Effective dates
* Source attribution
* Last-verified timestamps
* Administrative rule review
* Ability to deactivate obsolete rules
* Change history
* Tests tied to regulatory versions

The interface must show:

“Regulatory data last verified: [date]. Confirm current restrictions with official authorities when required.”

Do not scrape random trucking blogs as legal authority.

Prefer:

* Federal regulations
* FMCSA
* FHWA
* State departments of transportation
* State legislatures
* State police or commercial-vehicle enforcement agencies
* Municipal ordinances
* Official permit and route maps
* Contracted commercial-routing data

Secondary sources may assist discovery but must not become the authoritative compliance record.

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
