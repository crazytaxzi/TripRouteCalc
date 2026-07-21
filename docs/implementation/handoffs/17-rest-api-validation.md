# Stage 17 Handoff: REST API, OpenAPI, and Boundary Validation

- Source: `docs/specification/17_REST_API_AND_VALIDATION.md`
- Date: 2026-07-21
- Implementation branch: `agent/stage-17-rest-api-validation`
- Implementation pull request: `#31 Implement Stage 17 REST API and validation`
- Ledger-closure pull request: `#32 Close Stage 17 implementation ledger`
- Verified implementation head: `eb3f5ef7debd614c4cfa96f6bd846911e24ccdf4`
- Clean implementation CI: run `1192` (`29856292338`)
- Verified final implementation documentation head: `61cd575e043e5a70bd3eac421353cb89046e1764`
- Clean final implementation documentation CI: run `1198` (`29867963558`)
- Implementation merge commit: `b845c37c886bc95ca97aa2043a6b95b2b68c7286`
- Ledger-closure CI: pending final PR `#32` gate
- Completion status: COMPLETE, VERIFIED, AND MERGED; LEDGER CLOSURE IN PROGRESS

## Protected governance

Stage 17 was executed under `PRIME_DIRECTIVE.md` and `ERROR_RECOVERY_PROTOCOL.md`. Existing HOS, equipment, stop, route, regulatory, compliance, operational-event, ETA, confidence, tenant, immutable-revision, audit, credential-redaction, and no-consumer-fallback boundaries were preserved.

## What was inspected before implementation and recovery

- the protected Prime Directive and Error Recovery Protocol;
- the Stage 17 source, shared guardrails, master specification, implementation status, gap matrix, blockers, architecture map, and Stage 16 handoff;
- the actual pnpm workspace, TypeScript references, Vitest configuration, CI workflow, PostgreSQL 18 service, Prisma client generation, schema, and migrations;
- tenant membership and object-ownership enforcement in persistence;
- immutable trip-revision, stop, equipment, HOS, route-provider, regulatory-rule, ETA, confidence, and explanation contracts;
- commercial-routing setup blockers, provider errors, credential redaction, licensing, and explicit no-consumer-fallback behavior; and
- the complete Stage 17 branch, changed-file inventory, reviews, and temporary diagnostic history.

## Requirement traceability

| ID | Requirement | Implementation | Validation | Status |
|---|---|---|---|---|
| R17-01 | Expose trip, stop, calculation, revision, timeline, compliance, equipment, driver, route-validation, and regulation-version endpoints | `packages/api/src/server.ts`, `application.ts`, and `contracts.ts` | OpenAPI inventory test and PostgreSQL-backed Fastify integration tests | satisfied |
| R17-02 | Validate every request boundary using the established validation system | strict Zod headers, params, query, body, authentication-claim, and public-ID contracts plus repeated domain validation | invalid request, unknown-field, malformed identifier, ambiguous measurement, and domain-validation tests | satisfied |
| R17-03 | Return structured route, stops, timeline, HOS clocks, warnings, actions, confidence, explanations, and metadata | application response mappers and persisted ETA snapshots | successful calculation, timeline, compliance, and OpenAPI tests | satisfied |
| R17-04 | Use stable public identifiers and enforce tenant ownership | typed deterministic authenticated encryption plus existing carrier-scoped repositories | opacity, tamper, cross-type, membership, and cross-carrier access tests | satisfied |
| R17-05 | Add idempotency and conflict handling for writes | `ApiIdempotencyRepository`, idempotency migration, expected revision checks, and compare-and-swap revision creation | replay, request mismatch, in-progress claim, stale write, and tenant-scope tests | satisfied |
| R17-06 | Prevent duplicate stop sequences and lost updates | accepted stop validation, immutable revision creation, complete reorder set validation, unique sequence persistence, and locked-position checks | stale revision, duplicate reorder identity, locked reorder, and immutable revision tests | satisfied |
| R17-07 | Differentiate validation, legal block, provider outage, manual verification, auth, conflict, and internal failures | structured `ApiError` hierarchy and centralized Fastify mapper | 400, 401, 404, 409, 422, 429, and 503 acceptance coverage | satisfied |
| R17-08 | Generate OpenAPI documentation without fake legal responses | deterministic OpenAPI 3.1 document at `/openapi.json` | endpoint inventory, credential-content rejection, and structured 422 example tests | satisfied |
| R17-09 | Keep credentials and raw internal identifiers out of public payloads | server-only bearer and public-ID secrets, redacted provider errors, encrypted typed IDs, public response mappers | secret-pattern, opacity, tamper, and cross-type tests | satisfied |
| R17-10 | Add success, invalid-data, cross-account, provider-failure, prohibited-route, revision, and concurrency tests | API and persistence unit and integration suites | clean PostgreSQL-backed full repository test gate | satisfied |
| R17-11 | Preserve existing package boundaries and backwards compatibility | one additive `@trip-route-calc/api` package, additive idempotency table, existing service delegation, unchanged domain arithmetic | all prior-stage regression tests and production build | satisfied |
| R17-12 | Keep controllers free of HOS and legal arithmetic and return structured blocks | handlers authenticate, parse, delegate, and serialize only; simulator, routing, compliance, and persistence remain authoritative | source inspection and successful/prohibited route acceptance scenarios | satisfied |

## Implemented scope

- Added `@trip-route-calc/api` using Fastify 5, Zod, Node.js 22, and the existing workspace packages.
- Added one central application service that delegates to accepted persistence, routing, compliance, ETA, confidence, and explanation services.
- Added signed bearer credentials carrying carrier, actor, token identifier, issue time, and expiration.
- Added stable typed public identifiers using deterministic authenticated encryption. Database UUIDs are not exposed, and identifier type substitution or tampering is rejected before repository access.
- Added strict request contracts for all required Stage 17 endpoints.
- Added immutable trip and stop writes with expected revision checks and stable logical stop identities retained inside revision snapshots.
- Added persistent idempotency scoped by carrier, actor, operation, and hashed key. Equivalent completed retries replay the original response; mismatched or active claims return structured conflicts.
- Added structured API errors for authentication, authorization, validation, revision conflict, idempotency conflict, rate limiting, provider unavailability, legal blocking, manual verification, and internal failure.
- Added a configurable fixed-window rate limiter and response headers.
- Added deterministic OpenAPI 3.1 documentation at `/openapi.json`.
- Added explicit structured `422` route and calculation blocking responses rather than hiding legal or verification failure behind a generic success payload.
- Added successful calculation persistence and retrieval through revision, timeline, and compliance endpoints.
- Added provider setup failure and licensed test-provider prohibited-segment acceptance scenarios without adding a production provider or consumer fallback.

## Files created or changed

API package and tests:

- `packages/api/package.json`
- `packages/api/tsconfig.json`
- `packages/api/src/application.ts`
- `packages/api/src/contracts.ts`
- `packages/api/src/errors.ts`
- `packages/api/src/index.ts`
- `packages/api/src/openapi.ts`
- `packages/api/src/rate-limit.ts`
- `packages/api/src/security.ts`
- `packages/api/src/server.ts`
- `packages/api/test/openapi.test.ts`
- `packages/api/test/rate-limit.test.ts`
- `packages/api/test/security.test.ts`
- `packages/api/test/server.integration.test.ts`
- `packages/api/test/stage17-exit-gate.integration.test.ts`

Persistence:

- `packages/persistence/prisma/migrations/20260721170000_stage_17_api_idempotency/migration.sql`
- `packages/persistence/src/api-idempotency-repository.ts`
- `packages/persistence/src/errors.ts`
- `packages/persistence/src/repositories.ts`
- `packages/persistence/test/api-idempotency.integration.test.ts`

Workspace and documentation:

- `pnpm-lock.yaml`
- `tsconfig.json`
- `tsconfig.typecheck.json`
- `vitest.config.ts`
- `docs/api/README.md`
- `docs/implementation/decisions/17-rest-api-validation.md`
- `docs/implementation/handoffs/17-rest-api-validation.md`
- `docs/implementation/ARCHITECTURE_MAP.md`
- `README.md`

No production provider, legal threshold, consumer-route fallback, UI component, export renderer, deployment target, or unrelated schema redesign was added.

## Database and data changes

Stage 17 adds one additive migration:

`packages/persistence/prisma/migrations/20260721170000_stage_17_api_idempotency/migration.sql`

It creates `api_idempotency_records` with:

- carrier and actor ownership;
- operation and hashed idempotency key;
- deterministic request hash;
- optional completed response status and JSON snapshot;
- expiration and cleanup support; and
- unique carrier, actor, operation, and key scope.

The raw idempotency key is never persisted. Existing trip, revision, calculation, warning, route, rule, HOS, equipment, and audit rows are not rewritten. The table is intentionally accessed through a narrow raw-SQL repository and does not expand Prisma's generated public model surface.

## Verification evidence

Permanent CI run `1192` (`29856292338`) passed on implementation head `eb3f5ef7debd614c4cfa96f6bd846911e24ccdf4`. Final implementation documentation CI run `1198` (`29867963558`) passed on head `61cd575e043e5a70bd3eac421353cb89046e1764`.

Both gates passed:

- `pnpm install --frozen-lockfile`
- `pnpm db:generate`
- `pnpm db:validate`
- clean PostgreSQL 18 `pnpm db:migrate:deploy`
- `pnpm lint:source`
- `pnpm typecheck:source`
- complete `pnpm test:source`
- `pnpm build:source`

The full suite included prior-stage regression coverage, API cryptography and rate limiting, OpenAPI, PostgreSQL idempotency, authenticated Fastify transport, cross-carrier isolation, immutable trip and stop revisions, stale conflicts, locked reorder behavior, invalid measurements, provider setup failure, successful calculation replay and retrieval, and prohibited commercial-route blocking.

## Recovery and adversarial review summary

- The local execution environment did not provide a usable private repository checkout, pnpm, PostgreSQL, Docker, or GitHub CLI. Connected GitHub and GitHub Actions remained the authoritative execution path.
- The first public-ID design used signed encoded payloads. Adversarial review proved encoding would reveal internal UUIDs, so the design was corrected to authenticated encryption before transport implementation.
- Strict lint and TypeScript exposed explicit return annotations, readonly snapshot boundaries, generated Prisma type availability, unsafe partial transforms, and JSON normalization defects. Each was corrected without disabling rules or broad-casting domain values.
- Focused artifacts were used when GitHub clipped lint, type-check, and runtime output. Temporary diagnostic and repair workflows removed themselves and do not remain in the pull request.
- Vitest could not initially resolve workspace package source entries before build. Source aliases were added to the accepted test configuration rather than changing runtime package architecture.
- Fastify's default path-parameter ceiling rejected encrypted identifiers with `414`. The documented `routerOptions.maxParamLength` boundary was raised to 512 while authenticated decryption, type checking, and tamper rejection remained the authoritative guard.
- The complete changed-file inventory was reopened after the clean gate. It contains only expected Stage 17 implementation, test, migration, lockfile, workspace, and documentation files.
- Pull request `#31` had no unresolved review threads or submitted review objections and was squash-merged as `b845c37c886bc95ca97aa2043a6b95b2b68c7286`.
- Pull request `#32` changes documentation only and closes the repository ledger.

## Remaining blockers and limitations

- B-002 remains open. No licensed production commercial-routing provider, entitlement, coverage agreement, retention terms, credential, or live adapter exists.
- B-003 remains open. No reviewed production regulatory corpus, licensed restriction feed, legal-research ownership, update cadence, or official production acceptance corpus exists.
- B-004 remains deferred. Hosting, distributed secrets, backup automation, recovery objectives, and production database infrastructure remain undecided.
- The HMAC bearer authenticator is a verified Stage 17 authentication boundary and testable factory, not a complete user-session, login, rotation, revocation, or identity-provider lifecycle. Broader security and privacy work remains Stage 20.
- The fixed-window rate limiter uses an in-memory store suitable for one process and tests. A distributed store remains deployment work.
- No live traffic, weather, closure, fuel, parking, scale, maintenance, border, meal, shower, or facility provider is configured.
- The route and regulatory acceptance providers are deterministic test fixtures only and must never be represented as production evidence.
- No mobile UI, results UI, map, export renderer, or production deployment exists yet.

## Next source

`docs/specification/18_MOBILE_TRIP_SETUP_UI.md`