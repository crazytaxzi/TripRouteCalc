# 03. Persistence, Revisions, and Auditability

> Use this source as the active assignment for one dedicated implementation chat.  
> Read `00_SHARED_GUARDRAILS.md`, the repository implementation ledger, and every prerequisite source listed below before changing code.  
> Inspect the real repository first. Existing code is authoritative over guessed names, paths, schemas, packages, or architecture.

## Prerequisites

- Sources 01 and 02 completed
- Domain and unit decisions stable enough for persistence

## Goal

Create the durable data model, migrations, revision strategy, and audit records needed to preserve inputs, calculations, regulatory versions, provider responses, warnings, overrides, and exports.

## Required work

1. Map the master domain entities onto the repository's established database and ORM conventions.
2. Model users/accounts or carriers with strict tenant ownership and object-level authorization hooks.
3. Persist drivers, HOS states and duty events, tractors, trailers, loads, facilities, service profiles, trips, ordered stops, appointments, routes, legs, segments, restrictions, rules, permits, assumptions, planned events, warnings, and results.
4. Implement trip revisions or immutable calculation snapshots containing all inputs, rule-set version, provider version, timestamp, results, warnings, acknowledgements, and overrides.
5. Preserve route-provider raw responses safely when licensing and privacy rules permit, or store a traceable normalized snapshot and provider reference.
6. Add regulatory rule versioning, activation/deactivation, effective dates, source metadata, and change history.
7. Add export-history records without storing secrets or unsafe generated content.
8. Create clean migrations and verify them against a new database.
9. Add indexes, uniqueness rules, ordering constraints, foreign keys, and deletion/retention behavior.
10. Add repository/service tests for tenant isolation, revisions, stop ordering, immutable snapshots, and rollback-sensitive data.
11. Document migration and backup implications.

## Hard boundaries

- Do not overwrite the only prior plan.
- Do not use database-generated ordering as the stop sequence.
- Do not persist provider credentials or secrets in trip records.
- Do not allow cross-account object access.
- Do not encode mutable regulations as scattered application constants.

## Exit gate

A clean database can be migrated, core records can be saved and retrieved with explicit units, and every recalculation can preserve an auditable prior snapshot.

## Relevant master requirements

## 18. Persistence and Auditability

Save:

* Drivers
* Tractor profiles
* Trailer profiles
* Facilities
* Historical stop times
* Trips
* Trip revisions
* Route responses
* Regulatory rules used
* Calculation assumptions
* Timeline events
* User overrides
* Warning acknowledgements
* Export history

Every recalculation must create a revision or calculation snapshot containing:

* Input values
* Rule-set version
* Routing-provider version
* Calculation timestamp
* Result
* Warnings
* User overrides

Do not overwrite the only copy of a prior trip plan.

## 19. Suggested Domain Model

At minimum, create domain entities equivalent to:

* User
* Carrier
* Driver
* DriverHosState
* DriverDutyEvent
* Tractor
* Trailer
* Load
* Trip
* TripRevision
* TripStop
* AppointmentWindow
* Route
* RouteLeg
* RouteSegment
* RouteRestriction
* JurisdictionRule
* Permit
* PlannedEvent
* ComplianceWarning
* Facility
* FacilityServiceProfile
* CalculationAssumption
* CalculationResult

Use explicit units.

Examples:

* Distance: meters internally
* Duration: integer seconds or minutes
* Weight: pounds internally, with unit metadata
* Length: inches internally, with unit metadata
* Speed: miles per hour or meters per second with clear conversion
* Time: UTC timestamp plus IANA time zone

Never store values such as `"40"` without the unit and measurement meaning.

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
