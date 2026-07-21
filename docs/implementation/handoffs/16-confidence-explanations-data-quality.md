# Stage 16 Handoff: Confidence, Explanations, and Data Quality

- Source: `docs/specification/16_CONFIDENCE_EXPLANATIONS_DATA_QUALITY.md`
- Date: 2026-07-21
- Implementation branch: `agent/stage-16-confidence-data-quality`
- Implementation pull request: `#29 Implement Stage 16 confidence explanations and data quality`
- Verified implementation head: `53ecc0e160d73b9b418309d2de1a80a43f2ea75f`
- Clean implementation CI: run `1047` (`29844738381`)
- Completion status: COMPLETE, VERIFIED, AND READY TO MERGE

## Protected governance

Stage 16 was executed under `PRIME_DIRECTIVE.md` and `ERROR_RECOVERY_PROTOCOL.md`. Existing HOS, equipment, stop, route, regulatory, compliance, operational-event, ETA, tenant, immutable-revision, audit, API, and UI boundaries were preserved.

## What was inspected before implementation and recovery

- the protected governance and error-recovery documents;
- the Stage 16 source, shared guardrails, original master specification, implementation status, gap matrix, blockers, and Stage 15 handoff;
- Stage 02 domain, provenance, units, time, and public-contract boundaries;
- Stage 04 through Stage 08 HOS inputs, clocks, cycle, sleeper, carrier-policy, and acceptance contracts;
- Stage 09 equipment and load issue/provenance contracts;
- Stage 10 stop, appointment, service, parking, and HOS-overlap contracts;
- Stage 11 route provider confidence, unavailable fields, restrictions, and redaction boundaries;
- Stage 12 and Stage 13 regulatory findings, warnings, required actions, KPRA workflow, and evidence references;
- Stage 14 operational-event placement, buffer, source, and override contracts;
- Stage 15 projection status, confidence strings, speed decisions, complete timeline, local-time rendering, and deterministic revision replay;
- Prisma calculation-result confidence and JSON evidence storage; and
- permanent GitHub Actions, PostgreSQL migration, strict lint, TypeScript, Vitest, and build gates.

## Requirement traceability

| ID | Requirement | Implementation | Validation | Status |
|---|---|---|---|---|
| R16-01 | Return exactly HIGH, MODERATE, LOW, or UNVERIFIED for every projection | `ConfidenceLevel`, `assessConfidence`, ETA projection integration | classifier and ETA acceptance suites | satisfied |
| R16-02 | Use deterministic rules rather than unsupported percentages | `stage-16-rules-v1` factor table and escalation rules | high, moderate, low, accumulated-moderate, and unverified tests | satisfied |
| R16-03 | Return machine-readable reasons and plain-language explanations | `ConfidenceReason`, `ConfidenceAssessment`, `ResultExplanation` | structured reason and explanation assertions | satisfied |
| R16-04 | Distinguish legal failures, manual verification, operational uncertainty, missing live data, and estimates | explicit reason categories | complete category and factor-rule coverage | satisfied |
| R16-05 | Accumulate multiple moderate uncertainties into low confidence | deterministic assessment method | independent moderate-factor escalation test | satisfied |
| R16-06 | Produce UNVERIFIED for legal/manual-verification evidence and withhold a legal conclusion | `legalConclusionStatus` and unverified factor rules | axle, KPRA, dimensions, permits, restrictions, local access, and route-verification tests | satisfied |
| R16-07 | Implement the required data-quality factors | `DATA_QUALITY_FACTOR_RULES`, `dataQualityReasonsFromTrip` | complete factor-code parity and trip-input matrix | satisfied |
| R16-08 | Explain HOS constraints independently | timeline-derived `HOS_CONSTRAINT` explanations with event/rule evidence | ETA explanation acceptance test | satisfied |
| R16-09 | Explain stop clock effects, interruption, rest, appointment, compliance, fallback, and final local time | structured constraint explanation categories | ETA unit, acceptance, and Stage 16 explanation suites | satisfied |
| R16-10 | Reference inputs, events, rules, segments, stops, revisions, and provider evidence safely | `PublicEvidenceReference` and credential-like content rejection | reference-kind, evidence-required, revision-link, and secret-rejection tests | satisfied |
| R16-11 | Keep prose secondary to structured output | projections retain timeline, clocks, decisions, status, reasons, and typed explanations | deterministic snapshot and output-shape tests | satisfied |
| R16-12 | Persist and replay confidence evidence deterministically | existing immutable input/result snapshots and calculation-result JSON evidence | PostgreSQL Stage 16 replay integration test | satisfied |
| R16-13 | Align persisted confidence vocabulary | enum migration from medium/blocked to moderate/unverified | clean PostgreSQL migration deployment and integration suite | satisfied |

## Implemented scope

- Added the exact Stage 16 confidence levels: `HIGH`, `MODERATE`, `LOW`, and `UNVERIFIED`.
- Separated projection completion/blocking status from evidence confidence.
- Added a deterministic factor table with stable codes, categories, maximum levels, evidence references, user explanations, and technical explanations.
- Added deterministic deduplication and ordering by severity, code, and evidence identity.
- Added accumulated uncertainty behavior where two independent moderate reasons produce low confidence.
- Prevented callers from weakening a documented factor below its accepted maximum level.
- Added legal-conclusion withholding for legal-blocking and manual-verification evidence.
- Added the required physical, appointment, traffic, weather, speed, service, local-access, permit, restriction, address, and estimate factors.
- Added credential-safe public references for inputs, timeline events, rules, route segments, stops, revisions, and provider evidence.
- Integrated structured confidence assessments and reasons into all three Stage 15 ETA projections.
- Added timeline-derived explanations for HOS constraints, stop clock effects, qualifying interruption, qualifying rest, appointment waiting, compliance actions, speed fallbacks, route constraints, operational events, and final local time.
- Preserved the complete Stage 15 calculation outputs and used prose only as supplemental rendering evidence.
- Persisted structured reasons in the existing calculation-result JSON fields and deterministic revision snapshots.
- Migrated the PostgreSQL confidence enum in place from `medium` to `moderate` and from `blocked` to `unverified` without deleting calculation evidence.

## Files created or changed

Foundation and tests:

- `packages/foundation/src/confidence.ts`
- `packages/foundation/src/eta-simulator.ts`
- `packages/foundation/src/index.ts`
- `packages/foundation/package.json`
- `packages/foundation/test/confidence.test.ts`
- `packages/foundation/test/eta-confidence-explanations.test.ts`
- `packages/foundation/test/eta-simulator.test.ts`

Persistence and tests:

- `packages/persistence/prisma/schema.prisma`
- `packages/persistence/prisma/migrations/20260721150000_stage_16_confidence_levels/migration.sql`
- `packages/persistence/src/repository-shared.ts`
- `packages/persistence/src/trip-revision-repository.ts`
- `packages/persistence/test/eta-simulator.integration.test.ts`
- `packages/persistence/test/persistence.integration.test.ts`

Documentation:

- `docs/confidence/README.md`
- `docs/implementation/decisions/16-confidence-explanations-data-quality.md`
- `docs/implementation/handoffs/16-confidence-explanations-data-quality.md`
- `README.md`

No consumer-route fallback, production legal threshold, fake provider, live-data claim, API controller, UI component, or unrelated schema redesign was introduced.

## Database and data changes

Stage 16 adds one migration:

`packages/persistence/prisma/migrations/20260721150000_stage_16_confidence_levels/migration.sql`

It renames existing PostgreSQL enum values in place:

- `medium` to `moderate`;
- `blocked` to `unverified`.

Calculation result confidence reasons remain JSON evidence and now contain structured reason objects. Projection status remains separate inside the deterministic result snapshot. No calculation result, revision, warning, audit record, or provider snapshot is deleted or rewritten by the migration.

## Verification evidence

Permanent CI run `1047` (`29844738381`) passed on implementation head `53ecc0e160d73b9b418309d2de1a80a43f2ea75f`:

- `pnpm install --frozen-lockfile`
- `pnpm db:generate`
- `pnpm db:validate`
- clean PostgreSQL 18 `pnpm db:migrate:deploy`
- `pnpm lint:source`
- `pnpm typecheck:source`
- complete `pnpm test:source`, 37 files and 245 tests
- `pnpm build:source`

Focused diagnostic runs also verified the classifier and ETA explanation suites independently. Temporary diagnostic workflows and trigger files were removed before the clean permanent gate.

## Recovery and adversarial review summary

- The local environment again lacked a usable private checkout, package-network access, pnpm, PostgreSQL, Docker, and GitHub CLI. Connected GitHub and GitHub Actions remained the authoritative execution path.
- Stage 16 exposed a legacy domain error: `BLOCKED` had been used as a confidence value. Blocking remains a projection status; `UNVERIFIED` is now the evidence classification.
- Strict lint exposed unsafe asymmetric test matchers and missing explicit helper return types; tests were made typed without weakening assertions.
- Strict TypeScript exposed leftover string confidence reasons, a required route-duration fixture field, and structured persistence boundaries.
- Runtime tests exposed stale expectations for internal speed units, expected moderate confidence from a missing required appointment, and explicit speed-cap explanation wording.
- GitHub sometimes hid bot-authored product commits while follow-up repair workflows retried stale edits. Recovery verified live branch files before every restoration of permanent CI.
- YAML and exact-whitespace failures were treated as tooling-layer failures. Diagnostics switched to artifact capture, semantic/token-bounded edits, and base64-encoded scripts rather than guessing at clipped logs.
- The permanent migration, lint, type-check, complete runtime suite, and build gates were never disabled or weakened.

## Remaining blockers and limitations

- B-002 remains open. No licensed commercial-routing provider, entitlement, coverage statement, retention agreement, server-only credential, or live adapter exists.
- B-003 remains open. No reviewed production regulatory corpus, licensed restriction feed, legal-research ownership, or official production acceptance corpus exists.
- No live traffic, weather, closure, fuel, parking, scale, maintenance, border, meal, shower, or facility provider is configured.
- Confidence classification explains supplied evidence. It does not manufacture missing evidence or convert fixture coverage into production legality.
- Public evidence references reject credential-like text, but broader authentication, authorization, privacy, rate limiting, and API redaction remain later stages.
- No REST API, mobile UI, results UI, map, export renderer, authentication system, or production deployment exists yet.
- The local environment could not run repository checks; authoritative checks ran in GitHub Actions and are reported as such.

## Next source

`docs/specification/17_REST_API_AND_VALIDATION.md`
