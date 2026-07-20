# Stage 12 Handoff: Regulatory Rules and Update Workflow

- Source: `docs/specification/12_REGULATORY_RULES_AND_UPDATE_WORKFLOW.md`
- Date: 2026-07-20
- Implementation branch: `agent/stage-12-regulatory-rules`
- Completion status: IMPLEMENTATION IN PROGRESS, PRODUCTION REGULATORY DATA BLOCKED BY B-003

## Protected governance

Stage 12 is executed under `PRIME_DIRECTIVE.md` and `ERROR_RECOVERY_PROTOCOL.md`. No production legal rule, threshold, exemption, emergency declaration, permit entitlement, or unsupported jurisdiction claim is included. Test rules are explicitly fixture-only.

## Planned requirement traceability

| ID | Requirement | Implementation | Validation | Status |
|---|---|---|---|---|
| R12-01 | Full versioned jurisdiction-rule metadata | `foundation/regulatory.ts` | schema tests | implemented, verification pending |
| R12-02 | Information through illegality and manual severities | regulatory severity contract and result ranking | engine tests | implemented, verification pending |
| R12-03 | Machine condition separated from explanation and source | recursive condition DSL and source contracts | contract tests | implemented, verification pending |
| R12-04 | Exact segment, road, direction, vehicle, date, permit, and load evaluation | `compliance/regulatory-engine.ts` | route-scope tests | implemented, verification pending |
| R12-05 | No state-wide over-application | segment-scoped jurisdiction and road matching | OR/CA fixture | implemented, verification pending |
| R12-06 | Structured findings and required actions | finding/result contracts | engine and persistence tests | implemented, verification pending |
| R12-07 | Admin review, activation, supersession, history, and audit | regulatory repository extensions | PostgreSQL integration tests | implemented, verification pending |
| R12-08 | Last verified and official attribution | source contract and result attribution | contract and engine tests | implemented, verification pending |
| R12-09 | Authoritative-source categories only | source enum excludes blogs and informal summaries | schema test | implemented, verification pending |
| R12-10 | Multiple jurisdiction, expired, scoped, provider-gap, and manual tests | Stage 12 acceptance suite | Vitest | implemented, verification pending |
| R12-11 | Legal researcher and administrator documentation | `docs/regulatory/README.md` | documentation inspection | implemented, verification pending |

## Architecture

- Shared regulatory contracts live in `@trip-route-calc/foundation`.
- The pure evaluator lives in new package `@trip-route-calc/compliance`.
- Provider evidence remains in `@trip-route-calc/routing` and is an input, not a legal decision.
- Tenant-scoped lifecycle and evidence persistence remain in `@trip-route-calc/persistence`.
- Existing Stage 03 regulatory tables are sufficient; no schema migration is planned.
- Active typed rule-set versions are immutable. A replacement version explicitly supersedes the previous active version and records change and audit evidence.

## Production data blocker

B-003 remains open. Production legal evaluation requires selected authoritative federal, state, local, permit, restriction, and official route-map sources; licensing and retention review; legal-research ownership; verification cadence; loaded reviewed rules; and official acceptance examples. Until then, the engine can verify its contracts and deterministic behavior only with test fixtures.

## Verification pending

The complete repository gate must pass before completion:

- frozen-lockfile install;
- Prisma generation and validation;
- clean PostgreSQL 18 migration deployment;
- ESLint;
- strict TypeScript;
- complete unit and PostgreSQL integration tests;
- production build.

## Next source after completion

Resolve from the next numbered specification after Stage 12 once the stage ledger is closed.
