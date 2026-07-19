# 24. Production Verification and Completion Gate

> Use this source as the active assignment for one dedicated implementation chat.  
> Read `00_SHARED_GUARDRAILS.md`, the repository implementation ledger, and every prerequisite source listed below before changing code.  
> Inspect the real repository first. Existing code is authoritative over guessed names, paths, schemas, packages, or architecture.

## Prerequisites

- Sources 01 through 23 completed or explicitly marked with unresolved blockers
- Documentation claims aligned with implementation

## Goal

Perform the final clean-room verification. Fix release-blocking defects, collect evidence, and report completion only when the master criteria have actually been satisfied.

## Required work

1. Start from a clean checkout or documented clean environment.
2. Install dependencies using the repository's supported method.
3. Run a clean database migration.
4. Run seeds only when they are legitimate production/setup data, not fake legal results.
5. Run formatting, lint, type-check, unit, integration, route-contract, API, accessibility, security, export, and end-to-end checks.
6. Run the production build.
7. Run the production-like deployment method and smoke test critical workflows.
8. Verify no secrets, fake provider responses, placeholder calculations, production TODOs, or consumer-route legal fallbacks remain.
9. Verify revision/audit records, rule versions, provider metadata, and export history.
10. Verify the acceptance scenario evidence and all blocking limitations.
11. Compare every master completion criterion against actual evidence.
12. Update known limitations honestly.
13. Produce the final architecture summary, file list, migrations, provider setup, regulatory setup, local/test/build commands, limitations, and proof.
14. Do not call the product complete when live commercial routing or required legal data remains unverified.

## Required final report

- Architecture summary
- Files created/changed
- Migration details
- Routing-provider setup
- Regulatory-data setup
- Local commands
- Test commands and results
- Production build commands and results
- Deployment smoke-test result
- Known limitations and unverified legal coverage
- Completion-criteria checklist with evidence links/paths

## Master completion gate

## 30. Completion Criteria

The project is not complete until:

* A user can enter a real driver’s remaining clocks.
* A user can enter tractor, trailer, and load information.
* A user can enter a start, shipper, unlimited intermediate stops, and a final.
* Stops can be dynamically added, removed, and reordered.
* Every stop has independent appointment and service-time settings.
* A commercial route can be requested.
* Route restrictions are evaluated.
* The driver’s HOS timeline is simulated.
* Required breaks and rest periods are inserted.
* Arrival, service-start, departure, and final-completion times are distinct.
* Results show local time zones.
* California KPRA-type restrictions can be represented correctly.
* Route-specific state and local rules can be updated without modifying the core HOS engine.
* Every calculation can be explained.
* Missing data lowers confidence or blocks the route appropriately.
* Unit, integration, and end-to-end tests pass.
* Production build succeeds.
* Database migrations succeed on a clean database.
* No fake backend or placeholder calculation remains.
* Documentation matches the implementation.

At the end of implementation, provide:

1. A concise architecture summary
2. A list of files created or changed
3. Database migration details
4. Routing-provider setup instructions
5. Regulatory-data setup instructions
6. Commands to run locally
7. Commands to run tests
8. Commands to build for production
9. Known limitations
10. Evidence that the production build and tests pass

Do not report the application as complete unless those checks have actually been run.

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
