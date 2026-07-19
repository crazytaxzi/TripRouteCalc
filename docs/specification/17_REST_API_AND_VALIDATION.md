# 17. REST API, OpenAPI Contracts, and Boundary Validation

> Use this source as the active assignment for one dedicated implementation chat.  
> Read `00_SHARED_GUARDRAILS.md`, the repository implementation ledger, and every prerequisite source listed below before changing code.  
> Inspect the real repository first. Existing code is authoritative over guessed names, paths, schemas, packages, or architecture.

## Prerequisites

- Domain, persistence, HOS, routing, compliance, stop, ETA, and confidence services available
- Existing API conventions from Source 01 followed

## Goal

Expose the product through documented, authenticated APIs that return structured calculations and preserve domain boundaries.

## Required work

1. Implement or align the trip, stop, calculation, revision, timeline, compliance, equipment, driver, route-validation, and regulation-version endpoints from the master specification.
2. Use the repository's established validation system at every request boundary.
3. Return structured route, legs, stops, timeline, HOS transitions, warnings, actions, confidence, explanations, and metadata.
4. Use stable public identifiers and enforce tenant ownership on every object.
5. Add idempotency or conflict handling where recalculation and stop reordering require it.
6. Prevent duplicate sequence numbers and lost updates.
7. Differentiate validation errors, legal blocking findings, provider outages, manual verification, auth failures, and internal failures.
8. Generate or update OpenAPI documentation and examples without fake legal responses.
9. Keep provider credentials and internal raw identifiers out of public payloads.
10. Add API integration tests for success, invalid data, cross-account access, provider failure, prohibited route, revision creation, and concurrency-sensitive stop ordering.
11. Preserve backwards compatibility according to repository conventions.

## Hard boundaries

- Controllers must not perform HOS arithmetic.
- Do not return only a formatted sentence.
- Do not accept bare ambiguous measurements.
- Do not expose another carrier's trip through predictable IDs.
- Do not hide route illegality behind HTTP 200 with an unlabeled note; return structured blocking status.

## Exit gate

The documented API can create, modify, calculate, retrieve, and audit a trip using real domain services and strict authorization.

## Relevant master requirements

## 20. API Requirements

Create documented APIs equivalent to:

* `POST /api/trips`
* `GET /api/trips/:tripId`
* `PATCH /api/trips/:tripId`
* `POST /api/trips/:tripId/stops`
* `PATCH /api/trips/:tripId/stops/:stopId`
* `DELETE /api/trips/:tripId/stops/:stopId`
* `POST /api/trips/:tripId/stops/reorder`
* `POST /api/trips/:tripId/calculate`
* `GET /api/trips/:tripId/revisions`
* `GET /api/trips/:tripId/timeline`
* `GET /api/trips/:tripId/compliance`
* `POST /api/equipment/tractors`
* `POST /api/equipment/trailers`
* `POST /api/drivers`
* `POST /api/routes/validate`
* `GET /api/regulations/version`

The calculation endpoint must return structured data, not only a formatted sentence.

Include:

* Route
* Legs
* Stops
* Timeline
* HOS state transitions
* Warnings
* Regulatory actions
* Confidence
* Explanation
* Calculation metadata

## 21. Validation Rules

Reject or explicitly flag:

* Negative remaining clocks
* Driving clock above the configured legal maximum
* Shift clock above the configured maximum
* Cycle clock above the selected cycle maximum
* Departure before the current duty-status start
* Stop service duration below zero
* Missing start or final
* Duplicate stop sequence numbers
* Invalid time zones
* Trailer KPRA greater than physically possible
* Trailer KPRA below physically possible minimum
* Gross weight below the sum of known axle weights
* Vehicle height, width, length, or weight missing when required for route validation
* Hazmat load with no hazmat class
* Permit-required configuration with no permit information
* Appointment end before appointment start
* Route response containing a prohibited segment

Warnings are not all equal.

A route-legality failure must block finalization.

An uncertain facility duration may lower confidence without blocking the calculation.

## 25. Security and Privacy

Implement:

* Authentication
* Authorization
* Input validation
* Rate limiting
* Secure secret handling
* No API keys in client bundles
* No secrets committed to source control
* Audit logging for administrative regulatory changes
* Protection against SQL injection
* Protection against cross-site scripting
* Protection against insecure direct-object access
* Safe export generation
* Account-level data isolation

Driver location, trip history, and HOS information are sensitive operational data.

Do not expose them publicly.

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
