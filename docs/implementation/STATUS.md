# Implementation Status

## Project state

- Canonical repository: `crazytaxzi/TripRouteCalc`
- Repository visibility: private
- Default branch: `main`
- Active implementation branch: `agent/stage-03-persistence-revisions`
- Active pull request: `#3 Implement Stage 03 persistence and auditability`
- Product status: shared foundation plus durable PostgreSQL persistence, immutable revisions, and audit evidence implemented and verified
- Completed sources: `01_REPOSITORY_AUDIT_AND_PLAN.md`, `02_PRODUCT_FOUNDATION_DOMAIN_UNITS_TIME.md`, `03_PERSISTENCE_REVISIONS_AUDITABILITY.md`
- Stage 01 status: COMPLETE
- Stage 02 status: COMPLETE
- Stage 03 status: COMPLETE
- Next source: `04_DRIVER_HOS_INPUTS_AND_DUTY_EVENTS.md`
- Stage 04 status: NOT STARTED
- Application code: `@trip-route-calc/foundation` and `@trip-route-calc/persistence`
- Database migrations: one committed PostgreSQL migration with constraints and append-only triggers
- Production integrations: none

## Stage 03 completed

- Added PostgreSQL 18 and Prisma 7 configuration with a committed, reproducible lockfile and initial migration.
- Added `@trip-route-calc/persistence` as a separate package that imports the Stage 02 foundation contracts.
- Persisted users, carrier memberships, drivers, HOS evidence, tractors, trailers, loads, facilities, service profiles, service observations, trips, revisions, ordered stops, appointment windows, routes, route evidence, restrictions, permits, planned events, warnings, acknowledgements, assumptions, overrides, results, provider responses, regulatory rule sets, jurisdiction rules, rule-change history, exports, and audit events.
- Added carrier-scoped tenant ownership and membership authorization hooks.
- Added explicit scalar-plus-unit columns for authoritative measurements and PostgreSQL check constraints for unit, range, ordering, effective-window, provider-retention, and verification invariants.
- Added full trip-revision snapshots with calculation timestamp, rule and provider versions, input, result, warnings, acknowledgements, overrides, actor, and canonical SHA-256 content hash.
- Preserved prior revisions while allowing the trip to point to the latest committed revision.
- Added append-only database triggers for revisions and revision-owned evidence.
- Added safe route-provider retention modes for licensed raw JSON, normalized evidence, or provider references.
- Added versioned, effective-dated, source-attributed regulatory records and administrative change history.
- Added export-generation history without storing generated documents in the database.
- Added local Docker Compose configuration, migration policy, backup implications, and restoration requirements.

## Verification evidence

GitHub Actions for Stage 03 successfully ran against a clean PostgreSQL 18 service:

- `pnpm install --frozen-lockfile`
- `pnpm db:generate`
- `pnpm db:validate`
- `pnpm db:migrate:deploy`
- `pnpm lint:source`
- `pnpm typecheck:source`
- `pnpm test:source`: 4 test files and 22 tests passed
- `pnpm build:source`

The database-backed Stage 03 tests cover tenant isolation, preservation of prior revisions, explicit stop ordering, append-only revision enforcement, transactional rollback, provider-retention policy, and regulatory change history.

## Deferred decisions and limitations

- Commercial-routing provider and credentials remain unselected.
- Production regulatory and licensed data sources remain unselected.
- No route may be called legal or provider-verified yet.
- HOS calculation behavior begins in Stage 04 and later HOS stages.
- Production hosting, secrets management, backup schedules, recovery objectives, retention periods, and database operations remain undecided.
- Request authentication and API-level authorization are later-stage concerns; current application access must use the tenant-scoped persistence repositories.
- No API, UI, map, export renderer, or production deployment exists yet.

## Next source

Begin Stage 04 using `docs/specification/04_DRIVER_HOS_INPUTS_AND_DUTY_EVENTS.md`. Import the established foundation and persistence packages, preserve immutable revisions, and do not implement HOS clock arithmetic that belongs to Stages 05 through 08.
