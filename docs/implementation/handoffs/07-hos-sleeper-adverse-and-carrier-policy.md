# Stage 07 Handoff

## Stage

- Source file: `07_HOS_SLEEPER_ADVERSE_AND_CARRIER_POLICY.md`
- Date: 2026-07-20
- Implementation branch: `agent/stage-07-hos-sleeper-adverse-policy`
- Pull request: `#10 Implement Stage 07 sleeper, adverse, and carrier policy`
- Completion status: COMPLETE, VERIFIED, AND MERGED
- Final documented pull-request head: `ebe95890c1fa723b19065c987d27f38cc5e9765a`
- Merge commit: `2cb7d412675e757eb2d3ee70de8f23fd1711530d`

## Repository state inspected before coding

- Canonical private repository `crazytaxzi/TripRouteCalc`
- Stage 06 ledger-close checkpoint `79bca437a486d4efe0e47cdbc50fcfd7abe65935`
- Protected Prime Directive and Error Recovery Protocol
- Shared guardrails, master specification, canonical manifest, implementation ledger, architecture, decisions, blockers, and prior handoffs
- Canonical Stage 07 source `docs/specification/07_HOS_SLEEPER_ADVERSE_AND_CARRIER_POLICY.md`
- Stage 04 departure, sleeper evidence, duty-event, pair identity, carrier target, rest-preference, and provenance contracts
- Stage 05 core snapshots, transitions, reset behavior, and exports
- Stage 06 rolling cycle boundary
- Foundation exports, TypeScript, ESLint, Vitest, PostgreSQL 18, Prisma 7, migrations, and CI
- Current official FMCSA HOS guidance and revised split-sleeper FAQs issued July 1, 2026

The implementation ledger initially named a nonexistent Stage 07 path. The canonical source name was recovered from `docs/specification/MANIFEST.txt` before code changes.

## Work implemented

- Added pure `calculateHosAdvancedRules` composition.
- Verified the supplied Stage 05 result matches the same departure and ordered events.
- Preserved sleeper pair identity, roles, source, timestamps, duration, and exact event evidence.
- Required explicit pair selection before any advanced sleeper interpretation changed clocks.
- Validated exactly one long and one short period, non-overlap, minimum durations, at least seven sleeper-berth hours in the long period, at least ten combined hours, and clock feasibility around both periods.
- Allowed the short period to be `OFF_DUTY` or `SLEEPER_BERTH`; the long period remains `SLEEPER_BERTH` only.
- Recalculated the 11-hour and 14-hour values from the end of the first selected period, excluded both periods, and left cycle availability unchanged.
- Honored an explicitly selected valid pair even when a ten-consecutive-hour period could independently reset the Stage 05 clocks.
- Added explicit adverse-driving-condition evaluation with evidence confidence, knowability, normal-run feasibility, safe-completion impact, event-boundary validation, source, explanation, and a maximum 120-minute extension.
- Preserved cycle and 30-minute-interruption constraints under adverse mode.
- Applied stricter carrier driving and duty targets separately from federal maxima and returned exact violation timestamps.
- Reported nightly-rest preference conflicts without rewriting federal clocks.
- Kept unsupported personal conveyance, yard move, short haul, 16-hour, agricultural, emergency, team, pilot, and other special rules blocking/manual.
- Exported `@trip-route-calc/foundation/hos-advanced`.
- Added 12 focused Stage 07 tests.

## Requirement traceability

| Requirement | Evidence |
| --- | --- |
| Qualifying 7/3 and 8/2 evaluation | Selected 7/3, 8/2, and ten-hour-rest choice tests |
| Validate both periods | Role, duration, total, overlap, exact-evidence, history, and clock checks |
| Preserve pair identity | Pair and period identifiers, source, timestamps, recalculation anchor, and explanation |
| Reject invalid or ambiguous periods | Structured sleeper issues and invalid-pair tests |
| Explicit adverse mode | `HosAdverseDrivingConditionSelection` and evaluator |
| No automatic weather or congestion claim | Knowability, confidence, normal-run, source, explanation, and safe-completion checks |
| Stricter carrier caps | Effective carrier limits and exact violation timestamps |
| Federal and carrier distinction | Separate federal, carrier, and effective values |
| Unsupported rules stay manual | Blocking unsupported-rule warnings and tests |
| Focused tests | 12 Stage 07 scenarios |

## Files created

- `docs/implementation/handoffs/07-hos-sleeper-adverse-and-carrier-policy.md`
- `packages/foundation/src/hos-advanced.ts`
- `packages/foundation/test/hos-advanced.test.ts`

## Files changed

- `README.md`
- `docs/hos/README.md`
- `docs/implementation/ARCHITECTURE_MAP.md`
- `docs/implementation/BLOCKERS.md`
- `docs/implementation/DECISIONS.md`
- `docs/implementation/STATUS.md`
- `packages/foundation/package.json`
- `packages/foundation/src/hos.ts`
- `packages/foundation/src/index.ts`

## Files moved or deleted

None in the merged Stage 07 diff.

Temporary branch-only payloads, triggers, reconstruction workflows, and diagnostics used during protected recovery were removed before final review.

## Database and data changes

- Database migration: none
- Prisma schema change: none
- Seed data: none
- Backfill: none
- Production data change: none
- Destructive operation: none

Stage 07 outputs remain pure derived results. Stage 04 immutable evidence remains the persisted input boundary.

## Recovery evidence

The local container lacked GitHub and package-registry DNS, pnpm, GitHub CLI, and Docker. Recovery preserved the Stage 06 checkpoint, resolved the source-path mismatch through the manifest, inspected canonical files through the GitHub connector, reconstructed hash-verified local source and tests on an isolated branch, diagnosed workflow and lint failures without weakening requirements, removed all temporary artifacts, and used GitHub Actions for authoritative frozen-lockfile, PostgreSQL, lint, type, runtime, and build verification.

After the first green implementation run, current FMCSA guidance was checked again. The July 1, 2026 guidance required preserving an explicitly selected valid pair even when a qualifying ten-hour period could independently reset the standard clocks. The obsolete rejection was removed and a regression test was added before the final gate.

## Verification results

- CI run 254 on `e08be59579c593bddbb50ff8a2e8ba9442f365be`: PASS
- CI run 259 on `ca606daae073683eb51e1da64f325fb43138080d`: PASS
- Final documented CI run 273 on `ebe95890c1fa723b19065c987d27f38cc5e9765a`: PASS

Each successful run included:

- frozen-lockfile installation
- Prisma client generation
- Prisma schema validation
- clean PostgreSQL 18 migration deployment
- ESLint
- full TypeScript type-check
- complete Vitest unit and integration suite
- production TypeScript build

Pull request `#10` was squash-merged into `main` as `2cb7d412675e757eb2d3ee70de8f23fd1711530d`.

## Boundary audit

- Selected 7/3 and 8/2 pairs: COVERED.
- Pair identity: PRESERVED.
- Invalid nine-hour pair: REJECTED.
- Disabled selection: REJECTED.
- Long off-duty period outside berth: REJECTED.
- Short off-duty period outside berth: ACCEPTED.
- Selected pair after qualifying ten-hour sleeper period: ACCEPTED.
- Adverse extension at 120 minutes: ACCEPTED when fully qualified.
- Adverse extension at 121 minutes: REJECTED.
- Adverse not selected: NO CLOCK EFFECT.
- Cycle and interruption limits under adverse mode: PRESERVED.
- Stricter carrier limits: REPORTED AT EXACT TIMESTAMPS.
- Nightly-rest conflict: POLICY RESULT ONLY.
- Unsupported personal conveyance or pilot selection: BLOCKING/MANUAL.

## Remaining limitations

- Stage 08 must build the comprehensive automated HOS acceptance suite.
- Commercial-routing provider and production regulatory data remain unselected.
- No route may yet be called legal or provider-verified.
- API, UI, authentication, map, export, and deployment remain later-stage work.
- Flexible 6/4, 5/5, and split-duty alternatives remain pilot-only.

No remaining item blocks the Stage 07 exit gate.

## Next source

- `docs/specification/08_HOS_AUTOMATED_TEST_SUITE.md`
- Reopen the Prime Directive and Error Recovery Protocol before initialization.
- Use the accepted Stage 04 through Stage 07 contracts and engines as the behavioral authority.
- Do not change verified legal behavior merely to make a test pass.
