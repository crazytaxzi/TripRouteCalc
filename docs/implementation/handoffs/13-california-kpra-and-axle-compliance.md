# Stage 13 Handoff: California KPRA and Axle Compliance

- Source: `docs/specification/13_CALIFORNIA_KPRA_AND_AXLE_COMPLIANCE.md`
- Date: 2026-07-20
- Implementation branch: `agent/stage-13-california-kpra-axle`
- Pull request: `#22 Implement Stage 13 California KPRA and axle compliance`
- Verified clean implementation head: `84d8a405e094e8b81cb8e07d58ddbdd57fbb410b`
- Verification run: `711` (`29794566014`)
- Completion status: IMPLEMENTATION COMPLETE AND VERIFIED; MERGE PENDING; PRODUCTION REGULATORY DATA BLOCKED BY B-003

## Protected governance

Stage 13 is being executed under `PRIME_DIRECTIVE.md` and `ERROR_RECOVERY_PROTOCOL.md`. Production code contains no California KPRA or axle threshold. The 40-foot and 38-foot examples exist only in clearly labeled acceptance fixtures. Legal evaluation remains blocked without reviewed active rule data and verified commercial-route evidence.

## Requirement traceability

| ID | Requirement | Implementation | Validation | Status |
|---|---|---|---|---|
| R13-01 | Treat KPRA as a physical measurement, not a rail marker | Stage 09 physical KPRA and verified rail mapping, Stage 13 action contract | foundation tests | satisfied |
| R13-02 | Determine maximum from exact selected-segment rule | Stage 12 exact scope plus `assessKpraAdjustment` strictest sourced finding | compliance acceptance tests | satisfied |
| R13-03 | Support stricter local or route-specific values | lowest matching sourced maximum wins | 40-foot general and 38-foot exact-road fixtures | satisfied |
| R13-04 | Block excessive KPRA and identify action point | sourced KPRA action with affected segment and last reasonable location | compliance acceptance tests | satisfied |
| R13-05 | Explain entered value, allowed value, segment, adjust or reroute | action warning and structured choices | warning-content tests | satisfied |
| R13-06 | Require new KPRA, axle, gross, and distribution confirmation | adjustment confirmation contract and validator | foundation and compliance tests | satisfied |
| R13-07 | Rerun route and weight compliance after movement | `revalidateKpraAdjustment` rebuilds facts and reruns complete evaluator | compliance acceptance tests | satisfied |
| R13-08 | Never assume tandem movement preserves axle legality | axle, gross, and bridge findings remain independently blocking | post-adjustment axle test | satisfied |
| R13-09 | Support reroute when adjustment is impossible or selected | physical reachability assessment and reroute confirmation | reroute tests | satisfied |
| R13-10 | Preserve source, versions, dates, action, acknowledgement, and revision | immutable action/evidence snapshot, warning acknowledgement, audit event | PostgreSQL integration tests | satisfied |
| R13-11 | Provide required acceptance scenarios | OR-to-CA, excessive, strict 38-foot, axle warning, invalid distribution | Stage 13 suite | satisfied |

## Implemented scope

- Added immutable KPRA action, confirmation, assessment, revalidation, and evidence contracts.
- Kept rule values data-driven and sourced from Stage 12 findings.
- Selected the strictest applicable limit for the exact chosen segment.
- Identified the affected segment and last reasonable adjustment location from route evidence.
- Offered adjustment only when recorded sliding-tandem capability and physical range can reach the sourced limit.
- Required a new physical KPRA, drive and trailer axle weights, total gross combination weight, load-distribution confirmation, and measurement source.
- Required a new immutable trip revision for recalculation.
- Reran the complete regulatory evaluator with the confirmed physical facts.
- Distinguished unresolved KPRA, axle/weight blocking, other compliance blocking, reroute, invalid confirmation, and resolved outcomes.
- Allowed legal finalization only after the complete rerun returns no blocking finding.
- Added tenant-scoped append-only acknowledgement and audit capture using existing persistence tables.

## Files created or changed

- `docs/implementation/handoffs/13-california-kpra-and-axle-compliance.md`
- `docs/regulatory/README.md`
- `docs/regulatory/california-kpra-workflow.md`
- `packages/foundation/src/index.ts`
- `packages/foundation/src/kpra.ts`
- `packages/foundation/test/kpra.test.ts`
- `packages/compliance/src/index.ts`
- `packages/compliance/src/kpra-workflow.ts`
- `packages/compliance/test/kpra-workflow.test.ts`
- `packages/persistence/src/kpra-adjustment-repository.ts`
- `packages/persistence/src/repositories.ts`
- `packages/persistence/test/kpra-adjustment.integration.test.ts`

No file was moved. All temporary diagnostic, annotation-repair, and test-evidence workflows were removed before clean-head verification.

## Database and data changes

No Prisma schema change or migration was required. Stage 13 reuses:

- immutable `trip_revisions`;
- original `compliance_warnings`;
- append-only `warning_acknowledgements`; and
- append-only `audit_events`.

The audit snapshot links the original and recalculation revisions and preserves the action, source, rule versions, entered and confirmed measurements, axle facts, acknowledgement, outcome, and original warning identifier.

No production legal data was inserted.

## Verification evidence

The complete permanent repository gate passed on clean implementation head `84d8a405e094e8b81cb8e07d58ddbdd57fbb410b` in CI run `711` (`29794566014`):

- `pnpm install --frozen-lockfile`;
- `pnpm db:generate`;
- `pnpm db:validate`;
- clean PostgreSQL 18 `pnpm db:migrate:deploy`;
- `pnpm lint:source`;
- `pnpm typecheck:source`;
- complete `pnpm test:source`; and
- `pnpm build:source`.

The separately captured full test evidence passed with 29 test files and 187 tests. A final documentation-only permanent gate is required after this evidence stamp and before merge.

## Recovery summary

- Initial lint diagnostics omitted `DATABASE_URL`, causing a Prisma type-resolution cascade unrelated to Stage 13 source.
- The corrected diagnostic isolated five missing explicit test return annotations.
- Added only those annotations, confirmed strict lint success, and removed the temporary repair workflow.
- Captured the clipped test summary through a one-use evidence workflow, confirmed 29 test files and 187 passing tests, then removed that workflow.
- Repeated the complete permanent gate on the clean product and documentation branch.

## Production data blocker

B-003 remains open. Stage 13 proves the workflow with test-only sourced rules but cannot establish production California legality until authoritative sources, licensing, review ownership, verification cadence, and reviewed versioned rule data exist.

B-002 also remains open, so live commercial-route verification and real adjustment-location evidence are unavailable.

## Remaining limitations

- No production California KPRA, axle, bridge, local-route, or permit rule data exists.
- No licensed live commercial-routing provider exists.
- Stage 13 exposes domain and persistence behavior, not API or UI screens.
- Complete ETA simulation, traffic, facilities, exports, authentication, and deployment remain pending.

## Next source

To be loaded from the numbered specification manifest after Stage 13 is verified and merged.
