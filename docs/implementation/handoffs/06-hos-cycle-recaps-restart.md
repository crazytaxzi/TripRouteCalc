# Stage 06 Handoff

## Stage

- Source file: `06_HOS_CYCLE_RECAPS_AND_RESTART.md`
- Date: 2026-07-20
- Branch: `agent/stage-06-hos-cycle-recaps-restart`
- Pull request: `#8 Implement Stage 06 HOS cycle recaps and restart`
- Completion status: COMPLETE, VERIFIED, AND MERGED
- Merge commit: `4e35a594bb483dca234f324ca877c3a1261cd767`

## Repository state inspected before coding

- Canonical private repository `crazytaxzi/TripRouteCalc`
- Default branch `main`
- Stage 05 implementation merge commit `3ee806dfedbf853647b05e44270009a5c6d2c0a7`
- Stage 05 ledger-close commit `b7a04b210b0ddf7b133a048c676feb8da157ec9f`
- Protected Prime Directive and required Error Recovery Protocol
- Shared guardrails, controlling master specification, active Stage 06 source, status, architecture, decisions, blockers, and prior handoffs
- Stage 04 `DriverHosDepartureState`, `DutyEvent`, timestamp, provenance, recap, and restart-intent contracts
- Stage 05 `calculateHosCore` implementation, tests, exports, and hard boundaries
- Existing Temporal-backed UTC and IANA time primitives
- Existing Node.js 22, pnpm 9.15.4, TypeScript 5.8.3, ESLint, Vitest, PostgreSQL 18, Prisma 7, migrations, build, and CI configuration
- Current official FMCSA cycle and restart guidance plus 49 CFR 395.2, 395.3, and 395.8 on 2026-07-20

Stage 06 began from the accepted Stage 05 checkpoint. No UI, API, persistence calculation, routing, ETA, provider-specific logic, or duplicate daily-clock implementation was introduced.

## Work implemented

- Added the pure `calculateHosCycle` service in the shared foundation package.
- Derived the standard 60-hour/7-day and 70-hour/8-day cycle limits from complete timestamped driving and on-duty-not-driving history.
- Required historical duty evidence to cover the complete cycle window, remain contiguous, and end exactly at departure.
- Required planned duty events, when supplied, to begin exactly at departure and remain contiguous.
- Split on-duty events across carrier-designated regulatory-day boundaries.
- Required a home-terminal IANA time zone, local `HH:mm` boundary, explicit repeated-time choice, and explicit nonexistent-time resolution.
- Preserved event-location time zones as event evidence without allowing them to redefine the carrier cycle boundary.
- Reconciled the entered cycle clock and entered recap predictions against timestamp-derived results without mutating the recorded evidence.
- Returned timestamped recap availability at the configured home-terminal boundary rather than arbitrary midnight.
- Blocked driving and on-duty-not-driving planning when derived cycle availability reached zero.
- Reported exact first-prohibited timestamps, legal and prohibited on-duty minutes, structured violations, snapshots, transitions, reasons, and next-cycle availability.
- Applied a historical 34-hour restart only when explicitly selected and fully evidenced.
- Applied a future 34-hour restart only when `restart34HourPlanned` was explicit and the supplied timeline completed at least 2,040 consecutive off-duty or sleeper-berth minutes.
- Preserved qualifying rest already in progress before departure.
- Preferred an earlier sufficient recap over an unnecessary 34-hour restart.
- Kept Stage 05 authoritative for the 11-hour allowance, 14-hour window, 30-minute interruption, and 10-hour reset.
- Exported the engine through the root foundation package and `@trip-route-calc/foundation/hos-cycle`.
- Updated architecture, HOS documentation, decisions, blockers, status, and the project README.

## Files created

- `docs/implementation/handoffs/06-hos-cycle-recaps-restart.md`
- `packages/foundation/src/hos-cycle.ts`
- `packages/foundation/test/hos-cycle.test.ts`

## Files changed

- `README.md`
- `docs/hos/README.md`
- `docs/implementation/ARCHITECTURE_MAP.md`
- `docs/implementation/BLOCKERS.md`
- `docs/implementation/DECISIONS.md`
- `docs/implementation/STATUS.md`
- `packages/foundation/package.json`
- `packages/foundation/src/index.ts`

## Files moved or deleted

None.

Temporary branch-only diagnostic workflows were created during Error Recovery Protocol execution to expose truncated GitHub Actions output. Each was deleted after the relevant failure was identified and corrected. No diagnostic workflow remained in the merged diff.

## Database and data changes

- Database migration: none
- Prisma schema change: none
- Seed data: none
- Backfill: none
- Production data change: none
- Destructive operation: none

Stage 06 calculates derived results in memory. The immutable Stage 04 departure state and event history remain the persisted input evidence. A later stage must define any persisted calculation-result revision boundary.

## Environment fingerprint and recovery evidence

Observed local environment:

- Linux x86_64 container
- Git 2.47.3
- Node.js 22.16.0
- npm 10.9.2
- TypeScript 5.8.3
- corepack 0.32.0
- pnpm unavailable locally
- GitHub CLI unavailable locally
- Docker unavailable locally

The local workspace initially contained only the protected governance documents. A local `git clone` failed with `Could not resolve host: github.com`, and a temporary package installation timed out because the container lacked reliable outbound DNS and registry access. These were classified as environment and network failures, not repository defects.

Recovery followed the protected protocol:

1. Preserve governance and the verified `main` checkpoint.
2. Inspect the canonical repository through the connected GitHub application.
3. Create an isolated Stage 06 branch and draft pull request.
4. Run strict isolated TypeScript compilation with local stubs for the new source and test-shaped contracts.
5. Use GitHub Actions as the authoritative frozen-lockfile, Prisma, PostgreSQL, lint, type-check, runtime-test, and build environment.
6. Use temporary branch-only diagnostics only when the standard job-log connector truncated relevant output.
7. Remove every diagnostic workflow after recovery and rerun the complete standard pipeline.

No check is reported as passed unless it actually ran or was directly observed in trusted CI evidence.

## Verification results

GitHub Actions CI run 210 passed against implementation head `32f1ac6be7ecd33dc3a891819d648f977d8b3097`.

Final GitHub Actions CI run 224 passed against documented pull-request head `9367738b3061a8ca2626a61aa5d747946bb3b75b`:

- Frozen-lockfile installation: PASS
- Prisma client generation: PASS
- Prisma schema validation: PASS
- Clean PostgreSQL 18 migration deployment: PASS
- ESLint: PASS
- Full repository TypeScript check: PASS
- Complete Vitest unit and integration suite: PASS
- Production TypeScript build: PASS
- Stage 02 through Stage 05 regression coverage included by the full suite: PASS

Pull request `#8` was squash-merged into `main` as `4e35a594bb483dca234f324ca877c3a1261cd767`.

## Required scenario audit

1. Standard 70-hour/8-day cycle derived from timestamped history: SATISFIED.
2. Standard 60-hour/7-day cycle derived independently: SATISFIED.
3. Entered cycle discrepancy visible without mutating evidence: SATISFIED.
4. More shift availability than cycle availability: SATISFIED through independent Stage 05 and Stage 06 results; the caller must obey the lower constraint.
5. Zero cycle availability at departure: SATISFIED.
6. Cycle availability reaching zero within an event: SATISFIED.
7. Recap at a non-midnight home-terminal boundary: SATISFIED.
8. Explicitly planned qualifying future 34-hour restart: SATISFIED.
9. Unplanned future 34-hour rest not silently applied: SATISFIED.
10. Explicitly selected historical restart: SATISFIED without mutating earlier duty evidence.
11. Earlier recap preferred over unnecessary restart: SATISFIED.
12. Transparent snapshots, transitions, violations, availability events, and reasons: SATISFIED.

## Boundary and adversarial audit

- 34-hour restart at 2,039, 2,040, and 2,041 minutes: COVERED.
- Cycle zero at departure and the first prohibited minute: COVERED.
- Carrier boundary at 04:00 rather than midnight: COVERED.
- Spring-forward nonexistent local boundary with explicit resolution: COVERED.
- Fall-back repeated local boundary with explicit earlier and later choices: COVERED.
- Event location in another time zone while the home-terminal boundary remains authoritative: COVERED.
- Incomplete historical cycle window: REJECTED.
- Historical restart shorter than 2,040 minutes: REJECTED.
- Historical restart interrupted by on-duty work: REJECTED.
- Historical restart lacking complete timestamped coverage: REJECTED.
- Future restart intent absent: NOT APPLIED.
- Qualifying rest already underway before departure: CONTINUED rather than reset to zero.
- Entered recap or cycle mismatch: REPORTED rather than overwritten.
- Obsolete 1 a.m. to 5 a.m. and once-per-168-hour restart restrictions: NOT IMPLEMENTED.

## Assumptions and selected interpretations

- The cycle window is defined by consecutive carrier-designated home-terminal 24-hour periods, not event-location midnights.
- A clock reaching zero marks the end of the last available cycle minute. Additional on-duty work beginning at that boundary is prohibited.
- A complete historical sequence is required because recap and restart conclusions cannot be defended from unexplained duty-status gaps.
- Entered cycle and recap values remain recorded facts, while Stage 06 uses the timestamp-derived result for its planning timeline and exposes discrepancies.
- A 34-hour restart is optional and never assumed.
- Consecutive off-duty and sleeper-berth evidence may combine toward the 34-hour restart.
- Stage 05 and Stage 06 outputs remain separate so later stages can compose them without duplicating arithmetic.

## Remaining blockers and limitations

- Stage 07 must implement split sleeper, adverse conditions, and carrier policy without automatic exceptions.
- Stage 08 must provide the broader automated HOS acceptance suite.
- Commercial-routing provider and credentials remain unselected.
- Production regulatory and licensed data sources remain unselected.
- No route may be called legal or provider-verified.
- Request authentication, API authorization, UI, map, export rendering, and production deployment remain later-stage concerns.

No remaining item blocks the Stage 06 exit gate.

## Repository status and last known-good checkpoint

- Stage implementation branch: merged through pull request `#8`
- Final documented pull-request checkpoint: `9367738b3061a8ca2626a61aa5d747946bb3b75b`
- Stage 06 merge commit on `main`: `4e35a594bb483dca234f324ca877c3a1261cd767`
- Stage 06 implementation and documentation are present on `main`

## Next source

- Required next file: `docs/specification/07_HOS_ADVANCED_RULES_AND_CARRIER_POLICY.md`
- Preconditions: reopen the Prime Directive and Error Recovery Protocol, confirm the Stage 06 ledger-close checkpoint on `main`, and reinspect the Stage 04 evidence contracts plus the Stage 05 and Stage 06 pure engines
- Instruction: add split-sleeper, adverse-condition, and carrier-policy behavior without automatic exceptions, silent clock mutation, or duplicated Stage 05 or Stage 06 arithmetic
