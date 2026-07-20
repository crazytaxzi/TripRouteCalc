# Stage 03 Handoff

## Stage

- Source file: `03_PERSISTENCE_REVISIONS_AUDITABILITY.md`
- Date: 2026-07-19
- Branch: `agent/stage-03-persistence-revisions`
- Pull request: `#3 Implement Stage 03 persistence and auditability`
- Completion status: COMPLETE

## Repository state inspected before coding

- Canonical private repository `crazytaxzi/TripRouteCalc`
- Default branch `main`
- Stage 01 and Stage 02 status, decisions, blockers, architecture, baselines, and handoffs
- Merged Stage 02 pull request and successful GitHub Actions evidence
- Shared guardrails, controlling master specification, and active Stage 03 source
- Stable `@trip-route-calc/foundation` domain, unit, time, scope, and terminology contracts
- Existing Node.js 22, pnpm 9, TypeScript, Zod, Vitest, ESLint, build, and CI configuration
- Deferred commercial-routing, regulatory-data, and deployment decisions

Stage 02 was verified from the canonical GitHub repository rather than from an uploaded archive. Its merge, source files, package boundary, tests, and successful CI gates were present on `main`. No active blocker prevented Stage 03.

## Work implemented

- Created `@trip-route-calc/persistence` as a separate package importing the Stage 02 foundation contracts.
- Added PostgreSQL 18 and Prisma 7 configuration, generated-client workflow, committed lockfile, and committed initial migration.
- Added durable relational models for the minimum Stage 03 domain, revision, provider-evidence, regulatory-history, export-history, and audit entities.
- Added carrier-scoped tenant ownership and acting-user membership authorization hooks.
- Added explicit scalar-plus-unit columns for distance, duration, weight, length, and speed.
- Added database check constraints for canonical units, non-negative ranges, explicit order, time windows, provider retention, and route verification evidence.
- Added transactional creation of complete trip revisions and latest-revision pointer advancement.
- Preserved input, result, warning, acknowledgement, override, actor, calculation timestamp, rule version, routing-provider version, and canonical SHA-256 content-hash evidence.
- Added append-only PostgreSQL triggers for trip revisions and revision-owned evidence.
- Added explicit ordered stops using positive sequence values rather than insertion order.
- Added route-provider evidence retention modes for licensed raw JSON, normalized snapshots, and provider references.
- Added versioned, effective-dated, source-attributed regulatory rule sets, jurisdiction rules, and administrative change history.
- Added export-generation history without storing generated document bodies.
- Split persistence repositories by responsibility so later stages can extend trip revisions, provider evidence, regulatory history, and exports without growing one monolithic source file.
- Added database-backed integration tests for tenant isolation, revision preservation, explicit stop order, immutability, rollback, provider-retention policy, and regulatory history.
- Added a local PostgreSQL 18 Docker Compose service and documented migration, backup, restoration, retention, and provider-license implications.
- Expanded GitHub Actions to install reproducibly, generate and validate Prisma, apply migrations to a clean PostgreSQL database, lint, type-check, test, and build.

## Files created

- `.env.example`
- `compose.yaml`
- `docs/persistence/README.md`
- `docs/implementation/handoffs/03-persistence-revisions-auditability.md`
- `packages/persistence/package.json`
- `packages/persistence/prisma.config.ts`
- `packages/persistence/prisma/schema.prisma`
- `packages/persistence/prisma/migrations/migration_lock.toml`
- `packages/persistence/prisma/migrations/20260720000000_stage03_persistence/migration.sql`
- `packages/persistence/src/client.ts`
- `packages/persistence/src/errors.ts`
- `packages/persistence/src/export-history-repository.ts`
- `packages/persistence/src/index.ts`
- `packages/persistence/src/json.ts`
- `packages/persistence/src/regulatory-rule-repository.ts`
- `packages/persistence/src/repositories.ts`
- `packages/persistence/src/repository-shared.ts`
- `packages/persistence/src/route-provider-response-repository.ts`
- `packages/persistence/src/tenant.ts`
- `packages/persistence/src/trip-revision-repository.ts`
- `packages/persistence/test/persistence.integration.test.ts`
- `packages/persistence/tsconfig.json`

## Files changed

- `.github/workflows/ci.yml`
- `.gitignore`
- `README.md`
- `docs/implementation/ARCHITECTURE_MAP.md`
- `docs/implementation/BLOCKERS.md`
- `docs/implementation/DECISIONS.md`
- `docs/implementation/STATUS.md`
- `eslint.config.mjs`
- `package.json`
- `pnpm-lock.yaml`
- `tsconfig.json`
- `tsconfig.typecheck.json`
- `vitest.config.ts`

## Temporary files removed

Temporary branch-only workflows were used to generate reviewed artifacts or capture verification diagnostics and were deleted before completion:

- `.github/workflows/stage03-bootstrap.yml`
- `.github/workflows/stage03-apply-fixes.yml`

No specification, production source, migration, or evidence file was moved or discarded.

## Database and data changes

- Database engine: PostgreSQL 18
- ORM and migration tooling: Prisma 7
- Migration added: `20260720000000_stage03_persistence`
- Migration behavior: creates enums, tables, indexes, foreign keys, check constraints, append-only function, and append-only triggers
- Seed data: none
- Backfill: none
- Production data changes: none
- Destructive production migration: none; the migration was verified against a clean disposable CI database

Rollback before production data exists may drop the disposable database and reapply migrations. Once real audit evidence exists, schema rollback must use a reviewed forward migration and a verified backup rather than deleting or rewriting revisions.

## Commands actually run

GitHub Actions ran the following authoritative commands:

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:validate
pnpm db:migrate:deploy
pnpm lint:source
pnpm typecheck:source
pnpm test:source
pnpm build:source
```

The temporary generation workflow also ran:

```bash
pnpm install --no-frozen-lockfile
pnpm db:generate
pnpm db:validate
pnpm --filter @trip-route-calc/persistence exec prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
```

## Verification results

- Frozen-lockfile dependency installation: PASS
- Prisma client generation: PASS
- Prisma schema validation: PASS
- Migration deployment to clean PostgreSQL 18 database: PASS
- Lint: PASS
- Type-check: PASS
- Tests: PASS, 4 files and 22 tests
- Production TypeScript build: PASS
- Tenant isolation integration test: PASS
- Prior-revision preservation and current-revision advancement: PASS
- Explicit stop ordering: PASS
- Append-only update and deletion rejection: PASS
- Transaction rollback after child constraint failure: PASS
- Unlicensed raw provider-response rejection: PASS
- Regulatory version and change-history preservation: PASS
- Commercial-route provider verification: not applicable and not implemented
- Production regulatory-data verification: not applicable and not implemented
- API, authentication, UI, map, export-renderer, and production-deployment checks: not applicable and not implemented

## Stable interfaces for later stages

Later modules should import from:

- `@trip-route-calc/foundation`
- `@trip-route-calc/foundation/domain`
- `@trip-route-calc/foundation/scope`
- `@trip-route-calc/foundation/time`
- `@trip-route-calc/foundation/units`
- `@trip-route-calc/persistence`

They must not create parallel representations for authoritative measurements, UTC instants, IANA zones, tenant identity, trip revisions, evidence retention, or audit history. Application code must use tenant-scoped repositories rather than unscoped generated-client queries.

## Remaining blockers and limitations

- Commercial-routing provider and credentials remain unselected.
- Production regulatory and licensed data sources remain unselected.
- No route may be called legal or provider-verified yet.
- HOS calculation behavior is not implemented.
- Production hosting, secrets management, backup automation, recovery objectives, retention periods, and database operations remain undecided.
- Request authentication and API authorization are later-stage work.
- No API, UI, map, export renderer, or production deployment exists.
- The schema may be extended by later stages, but immutable revision and evidence guarantees must not be weakened.

## Next source

- Required next file: `docs/specification/04_DRIVER_HOS_INPUTS_AND_DUTY_EVENTS.md`
- Preconditions: satisfied after this Stage 03 pull request is accepted into the canonical branch
- Known blockers to beginning Stage 04: none
- Instruction: reinspect the canonical repository, import the foundation and persistence packages, model verified driver HOS inputs and duty events, preserve source and explanation evidence, and do not implement clock arithmetic reserved for Stages 05 through 08
