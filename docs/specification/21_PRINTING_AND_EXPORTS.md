# 21. Printing, PDF, CSV, and JSON Exports

> Use this source as the active assignment for one dedicated implementation chat.  
> Read `00_SHARED_GUARDRAILS.md`, the repository implementation ledger, and every prerequisite source listed below before changing code.  
> Inspect the real repository first. Existing code is authoritative over guessed names, paths, schemas, packages, or architecture.

## Prerequisites

- Results, revisions, authorization, and explanations complete
- PDF/export libraries selected according to repository conventions

## Goal

Create safe, reproducible exports tied to a specific calculation revision.

## Required work

1. Implement printable trip plan, PDF, CSV stop schedule, and JSON calculation export.
2. Require an explicit trip revision so exported values cannot shift during generation.
3. Include the required driver, equipment, load, route, stop schedule, HOS timeline, compliance actions, warnings, assumptions, rule version, calculation time, and disclaimer.
4. Include earliest/expected/conservative projections where the format supports them.
5. Preserve time zones and units unambiguously.
6. Exclude secrets, provider credentials, internal database identifiers, unsafe HTML, and data from other accounts.
7. Record export history with user, revision, type, and timestamp.
8. Ensure large multi-stop trips paginate/read cleanly.
9. Add safe filenames, content types, escaping, formula-injection protection for CSV, and size/rate controls.
10. Add automated tests for authorization, revision stability, content completeness, escaping, and secret exclusion.
11. Verify generated PDF visually and through content assertions according to the available toolchain.
12. Document export limitations.

## Hard boundaries

- Do not regenerate a new route silently while exporting.
- Do not export mutable “current trip” state without a revision.
- Do not include provider raw payloads unless explicitly permitted and scrubbed.
- Do not treat a browser print screenshot as the only PDF implementation when the requirement calls for a durable export.

## Exit gate

Each supported export can be generated safely from an authorized immutable revision and contains enough information to audit the plan.

## Relevant master requirements

## 27. Exporting

Support:

* Printable trip plan
* PDF export
* CSV stop schedule
* JSON calculation export

The printable plan must include:

* Driver
* Equipment
* Load
* Route
* Stop schedule
* HOS timeline
* Compliance actions
* Warnings
* Assumptions
* Rule-set version
* Calculation time
* Disclaimer

Do not export secrets, internal database identifiers, or provider credentials.

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
