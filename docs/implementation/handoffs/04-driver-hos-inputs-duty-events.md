# Stage 04 Handoff

## Stage

- Source file: `04_DRIVER_HOS_INPUTS_AND_DUTY_EVENTS.md`
- Date: 2026-07-19
- Branch: `stage-04-clean-hos-inputs`
- Pull request: pending
- Completion status: VERIFICATION PENDING

## Repository state inspected before coding

- Canonical private repository `crazytaxzi/TripRouteCalc`
- Default branch `main`
- Verified Stage 03 merge commit `1f5235d8f32417c3467266d1278d0fa98a37de06`
- Merged Stage 03 pull request and successful PostgreSQL 18 GitHub Actions evidence
- Shared guardrails, controlling master specification, source manifest, and active Stage 04 source
- Existing implementation status, decision log, blockers, architecture map, and prior handoffs
- Stable `@trip-route-calc/foundation` unit, UTC, IANA time-zone, terminology, scope, and domain contracts
- Stable `@trip-route-calc/persistence` PostgreSQL, Prisma, tenant, revision, hash, and audit contracts
- Existing Node.js 22, pnpm 9, TypeScript, Vitest, ESLint, migration, build, and CI configuration
- Existing minimal Stage 03 HOS persistence evidence, which was preserved rather than repurposed as the richer Stage 04 immutable input revision
- GitHub branch and pull-request state, confirming no prior Stage 04 branch or pull request existed

Stage 04 was restarted from the accepted Stage 03 state. No earlier Stage 04 source, branch, pull request, migration, or remote commit was reused.

## Work implemented

- Added a pure `DriverHosDepartureState` contract with every required Stage 04 input.
- Kept driving, shift, and cycle clocks independent and represented them as integer-minute `Duration` values.
- Added current duty status and the UTC timestamp when that status began.
- Added 60-hour/7-day and 70-hour/8-day cycle selection, prior-day totals, recap returns, sleeper evidence, split-sleeper intent, restart intent, carrier targets, and optional nightly-rest preferences.
- Added provenance that distinguishes user-entered, provider-derived, and calculated values from their separate verified or unverified status.
- Added all four supported duty statuses.
- Added timestamped duty events with type, location, IANA time zone, source, explanation, explicit driving/shift/cycle effects, interruption qualification, and sleeper-pair candidate participation.
- Added validation for legal maxima, contradictory timestamps and break claims, incomplete or nonconsecutive prior-day history, recap ordering, sleeper evidence, invalid zones, non-minute event durations, caller-supplied event ordering, overlaps, gaps, and history boundaries.
- Added deterministic API-shaped mappers and JSON serialization without creating Stage 17 API behavior early.
- Added tenant-scoped persistence functions that write the complete departure state and ordered event history in one transaction.
- Added canonical SHA-256 payload hashes, reload-time hash verification, carrier and driver ownership enforcement, actor attribution, and append-only PostgreSQL triggers.
- Added focused pure-domain tests and PostgreSQL integration coverage.
- Documented authoritative inputs, provenance, persistence, and deliberate Stage 04 boundaries.

## Files created

- `docs/hos/README.md`
- `docs/implementation/handoffs/04-driver-hos-inputs-duty-events.md`
- `packages/foundation/src/hos.ts`
- `packages/foundation/test/hos.test.ts`
- `packages/persistence/prisma/migrations/20260720050000_stage04_driver_hos_inputs/migration.sql`
- `packages/persistence/src/driver-hos-repository.ts`
- `packages/persistence/test/driver-hos.integration.test.ts`

## Files changed

- `README.md`
- `docs/implementation/ARCHITECTURE_MAP.md`
- `docs/implementation/DECISIONS.md`
- `docs/implementation/STATUS.md`
- `packages/foundation/package.json`
- `packages/foundation/src/index.ts`
- `packages/persistence/src/repositories.ts`

## Files moved or deleted

None.

Local-only compiler stubs and Node test-harness files were used solely to validate the isolated source in an environment without dependency installation. They are not repository artifacts and are not included in the Stage 04 change.

## Database and data changes

- Migration added: `20260720050000_stage04_driver_hos_inputs`
- New table: `driver_hos_departure_state_revisions`
- New table: `driver_hos_duty_event_history_revisions`
- New append-only trigger function: `prevent_driver_hos_revision_mutation`
- New constraints: carrier and driver ownership, actor membership, supported status and cycle values, timestamp order, legal clock ranges, JSON shape, event count, and lowercase SHA-256 hashes
- New indexes: carrier, driver, and time lookups for departure-state and history revisions
- Seed data: none
- Backfill: none
- Production data changes: none
- Destructive migration: none

The new tables supplement the Stage 03 persistence evidence without weakening or rewriting prior immutable records. Prisma continues to manage the generated client from the existing schema, while the Stage 04 repository accesses these append-only evidence tables through typed raw SQL.

## Commands actually run before publication

```bash
node --version
tsc --version
tsc -p packages/foundation/tsconfig.json --pretty false
tsc -p packages/persistence/tsconfig.json --pretty false
tsc -p tsconfig.local-typecheck.json --pretty false
node --test packages/foundation/test/hos.test.mjs packages/persistence/test/driver-hos-repository.test.mjs
```

Observed tool versions:

- Node.js: 22.16.0
- TypeScript: 5.8.3

The local environment could not download pnpm packages and did not provide Docker, Podman, or PostgreSQL. No claim is made that local pnpm, Prisma, migration-deployment, ESLint, Vitest, full repository type-check, or production-build checks ran.

## Verification results before pull-request CI

- Isolated HOS source strict TypeScript compile: PASS
- Isolated persistence repository strict TypeScript compile: PASS
- Vitest-shaped Stage 04 test TypeScript compile: PASS
- Focused Node test harness: PASS, 11 tests
- Independent primary clocks: PASS
- Carrier targets kept separate from legal clocks: PASS by typed Vitest case and source audit
- Contradictory state and maximum-clock rejection: PASS
- Prior-day continuity and IANA zone validation: PASS
- API and JSON round-trip: PASS
- Event duration, effects, and interruption metadata: PASS
- Event ordering, overlap, and gap rejection: PASS
- Sleeper candidate evidence without automatic split validation: PASS
- Tenant ownership, canonical hashing, and round-trip loading contract: PASS
- Migration static assertions: PASS
- Frozen-lockfile installation: PENDING CI
- Prisma client generation and schema validation: PENDING CI
- Clean PostgreSQL 18 migration deployment: PENDING CI
- ESLint: PENDING CI
- Full repository TypeScript check: PENDING CI
- Vitest unit and integration tests: PENDING CI
- Production TypeScript build: PENDING CI

Stage 04 must not be merged or marked complete until every pending CI gate passes.

## Requirement-by-requirement exit-gate audit

1. Every required driver and HOS input is represented: SATISFIED IN SOURCE.
2. Drive, shift, and cycle remaining are independent constraints: SATISFIED IN SOURCE AND TESTS.
3. Current duty status and start time are explicit: SATISFIED.
4. Prior days, recaps, sleeper periods, restart intent, carrier limits, and optional rest preference are explicit: SATISFIED.
5. All four required duty statuses are supported: SATISFIED.
6. Timestamped events include every required field and effect: SATISFIED.
7. Contradictory or impossible states are rejected without repair: SATISFIED IN SOURCE AND TESTS.
8. API-shaped and persistence mappers exist: SATISFIED; no API framework was added early.
9. Validation, serialization, ordering, overlap, gap, zone, and independent-clock tests exist: SATISFIED; authoritative repository execution remains pending CI.
10. User-entered, provider-derived, calculated, and verified states are documented: SATISFIED.

Hard-boundary audit:

- No clock is inferred from another.
- No floating-point hours are authoritative.
- No automatic route break insertion exists.
- Facility, fuel, and inspection time are not automatically off duty.
- Split sleeper, restart, adverse conditions, and personal conveyance are not automatically enabled.

## Remaining blockers and limitations

- Pull-request CI must validate the migration, lint, full type graph, Vitest suite, and production build before acceptance.
- Stage 04 records validated facts but does not implement the legal clock arithmetic reserved for Stages 05 through 08.
- Sleeper pair participation is candidate evidence only.
- Commercial-routing provider and credentials remain unselected.
- Production regulatory and licensed data sources remain unselected.
- No route may be called legal or provider-verified.
- Request authentication, API authorization, UI, map, export rendering, and production deployment are later-stage concerns.

## Next source

- Required next file after Stage 04 acceptance: `docs/specification/05_HOS_CORE_CLOCKS_AND_INTERRUPTION.md`
- Preconditions: all Stage 04 CI gates pass, the exit-gate audit is re-opened and confirmed, this handoff is updated with authoritative results, and the Stage 04 pull request is accepted into `main`
- Instruction: build a pure core clock and interruption engine that consumes these Stage 04 facts without replacing or inferring them
