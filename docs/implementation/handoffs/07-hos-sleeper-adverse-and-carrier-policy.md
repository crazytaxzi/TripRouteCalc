# Stage 07 Handoff

## Stage

- Source file: `07_HOS_SLEEPER_ADVERSE_AND_CARRIER_POLICY.md`
- Date: 2026-07-20
- Branch: `agent/stage-07-hos-sleeper-adverse-policy`
- Pull request: `#10 Implement Stage 07 sleeper, adverse, and carrier policy`
- Completion status: COMPLETE, VERIFIED, PENDING MERGE

## Repository state inspected before coding

- Canonical private repository `crazytaxzi/TripRouteCalc`
- Default branch `main`
- Stage 06 ledger-close checkpoint `79bca437a486d4efe0e47cdbc50fcfd7abe65935`
- Protected Prime Directive and required Error Recovery Protocol
- Shared guardrails, controlling master specification, canonical manifest, implementation ledger, architecture map, decisions, blockers, and prior handoffs
- Canonical Stage 07 source `docs/specification/07_HOS_SLEEPER_ADVERSE_AND_CARRIER_POLICY.md`
- Stage 04 `DriverHosDepartureState`, sleeper evidence, `DutyEvent`, pair identity, provenance, carrier targets, and rest-preference contracts
- Stage 05 `calculateHosCore` snapshots, transitions, reset behavior, and public exports
- Stage 06 rolling cycle boundary and hard separation from daily-clock arithmetic
- Foundation package export structure, strict TypeScript and ESLint settings, Vitest configuration, PostgreSQL 18, Prisma 7, migrations, and GitHub Actions CI
- Current official FMCSA HOS page, property-carrying summary, adverse-driving guidance, and revised split-sleeper FAQs issued July 1, 2026

The repository ledger initially named a nonexistent Stage 07 file. Recovery used `docs/specification/MANIFEST.txt` to resolve the canonical source name before any implementation change.

## Work implemented

- Added pure `calculateHosAdvancedRules` composition in `packages/foundation/src/hos-advanced.ts`.
- Validated that the supplied Stage 05 result begins at the same departure instant and corresponds to the same ordered duty-event sequence.
- Collected pair candidates from both existing sleeper evidence and timestamped duty events while preserving source, role, identity, timestamps, duration, and duty status.
- Required explicit pair selection before any sleeper calculation altered clocks.
- Validated exactly one long and one short period, exact evidence, non-overlap, minimum period length, at least seven sleeper-berth hours in the long period, at least ten combined hours, and driving and shift feasibility around both periods.
- Updated the Stage 04 duty-event boundary so the short paired period may be `OFF_DUTY` or `SLEEPER_BERTH`, while the long period remains `SLEEPER_BERTH` only.
- Recalculated the 11-hour and 14-hour values from the end of the first selected period, excluded both qualifying periods, and preserved cycle availability as unchanged.
- Honored an explicitly selected valid pair even when a ten-consecutive-hour period could independently reset the Stage 05 clocks, matching revised FMCSA guidance issued July 1, 2026.
- Implemented explicit adverse-driving-condition evaluation with supporting context, evidence confidence, before-dispatch and before-duty knowability checks, normal-run feasibility, safe-completion impact, event-boundary validation, and a maximum 120-minute extension.
- Preserved cycle and 30-minute-interruption constraints under adverse mode.
- Applied stricter carrier daily-driving and duty targets independently from federal maxima and returned exact policy-violation timestamps.
- Evaluated optional nightly-rest preferences as carrier-planning conflicts without rewriting federal clocks.
- Returned blocking/manual warnings for unsupported personal conveyance, short haul, 16-hour, agricultural, emergency, pilot, and other exception or exemption selections.
- Exported the advanced module through the foundation root and `@trip-route-calc/foundation/hos-advanced`.
- Added 12 focused Stage 07 tests.

## Requirement traceability

| Requirement | Evidence |
| --- | --- |
| R07-01 qualifying 7/3 and 8/2 split-sleeper evaluation | Valid selected 7/3, 8/2, and ten-hour-rest choice tests plus `evaluatePair` |
| R07-02 validate both paired periods before recalculation | Role, duration, total, overlap, exact-evidence, history, and clock checks |
| R07-03 preserve pair identity and explain periods | Pair IDs, period IDs, sources, timestamps, recalculation anchor, and explanation in the result |
| R07-04 reject invalid, overlapping, insufficient, or ambiguous periods | Structured sleeper issue codes and invalid-pair tests |
| R07-05 adverse calculations require explicit selection and context | `HosAdverseDrivingConditionSelection` and `evaluateAdverseDrivingCondition` |
| R07-06 ordinary congestion, weather, or planning is not assumed adverse | Knowability, confidence, normal-run, safe-completion, source, and explanation checks |
| R07-07 stricter carrier daily-driving and duty targets | Effective policy limits and exact violation timestamps |
| R07-08 distinguish legal maxima and carrier targets | Separate federal, carrier, and effective limits in `HosCarrierPolicyResult` |
| R07-09 unsupported exceptions remain manual/blocking | `HosUnsupportedRuleWarning` and unsupported-rule tests |
| R07-10 focused tests | 12 Stage 07 tests covering sleeper, adverse, carrier, preference, and unsupported behavior |

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

None in the final Stage 07 diff.

Temporary branch-only payloads, trigger files, reconstruction workflows, and lint diagnostics were used during protected error recovery and deleted before final review. No temporary workflow or staging artifact remains in the intended pull-request diff.

## Database and data changes

- Database migration: none
- Prisma schema change: none
- Seed data: none
- Backfill: none
- Production data change: none
- Destructive operation: none

Stage 07 calculates derived results in memory. Stage 04 immutable evidence remains the persisted HOS input boundary.

## Environment and recovery evidence

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
- outbound GitHub and package-registry DNS unavailable

Recovery followed the protected protocol:

1. Preserve the Stage 06 `main` checkpoint and protected governance files.
2. Resolve the Stage 07 source mismatch through the canonical manifest.
3. Inspect the real repository contracts and accepted HOS boundaries through the connected GitHub application.
4. Recover the complete local Stage 07 source and test drafts and verify their hashes before reconstructing them on the isolated branch.
5. Use one-use branch workflows only where the connected contents API could not safely write large files.
6. Diagnose workflow failures caused by whitespace-sensitive patches and a GitHub expression collision without changing production requirements.
7. Remove every temporary payload, trigger, and workflow after reconstruction.
8. Use targeted lint diagnostics to expose six mechanical findings, correct them structurally, and remove the diagnostics.
9. Run the authoritative standard CI gate.
10. Recheck current FMCSA guidance after the first green implementation run, identify the July 1, 2026 explicit-choice correction, add its regression test, and rerun the complete gate.

No check is reported as passed unless it actually ran or was directly observed.

## Verification results

GitHub Actions CI run 254 passed against implementation head `e08be59579c593bddbb50ff8a2e8ba9442f365be`:

- frozen-lockfile installation: PASS
- Prisma client generation: PASS
- Prisma schema validation: PASS
- clean PostgreSQL 18 migration deployment: PASS
- ESLint: PASS
- full TypeScript type-check: PASS
- complete Vitest unit and integration suite: PASS
- production TypeScript build: PASS

After the current-guidance correction, GitHub Actions CI run 259 passed against head `ca606daae073683eb51e1da64f325fb43138080d` with the same full gate.

The final documentation commits remain behind the same required pull-request CI gate. Pull request `#10` must not be merged unless the final documented head is fully successful.

## Scenario and boundary audit

- Explicit selected 7/3 pair: COVERED.
- Explicit selected 8/2 pair: COVERED.
- Pair identity preserved: COVERED.
- Invalid nine-hour pair: REJECTED.
- Disabled split-sleeper selection: REJECTED.
- Long off-duty period outside the sleeper berth: REJECTED.
- Short off-duty period outside the sleeper berth: ACCEPTED.
- Explicit pair selected after a qualifying ten-hour sleeper period: ACCEPTED.
- Adverse extension exactly 120 minutes: ACCEPTED when fully qualified.
- Adverse extension at 121 minutes: REJECTED.
- Adverse mode not selected: NO CLOCK EFFECT.
- Cycle exhausted under adverse mode: REMAINS BLOCKING.
- 30-minute interruption required under adverse mode: REMAINS BLOCKING.
- Carrier driving cap stricter than federal maximum: REPORTED AT EXACT TIMESTAMP.
- Carrier duty cap stricter than federal window: REPORTED AT EXACT TIMESTAMP.
- Nightly-rest preference conflict: REPORTED AS POLICY CONFLICT.
- Personal conveyance or pilot selection: BLOCKED/MANUAL, NO CLOCK EFFECT.

## Assumptions and selected interpretations

- The selected pair ID is the explicit plan choice required by Stage 07.
- Stage 05 reset milestones remain visible even when Stage 07 applies a selected pair; Stage 07 does not rewrite the Stage 05 result.
- A selected sleeper pair changes the Stage 07 planning interpretation of the 11-hour and 14-hour clocks but never cycle availability.
- Adverse conditions are evaluated only at an exact Stage 05 event boundary because the available normal clocks must be auditable at the encounter instant.
- Carrier caps are planning constraints and may block a carrier plan before federal clocks are exhausted.
- Rest preferences are non-legal planning policy unless a later carrier-rule module gives them a different explicit meaning.

## Remaining blockers and limitations

- Stage 08 must build the broader automated HOS acceptance suite across Stages 04 through 07.
- Commercial-routing provider and credentials remain unselected.
- Production regulatory and licensed data sources remain unselected.
- No route may be called legal or provider-verified.
- Request authentication, API authorization, UI, map, export rendering, and production deployment remain later-stage concerns.
- Flexible 6/4 and 5/5 sleeper alternatives and split-duty alternatives remain pilot-only and are not standard rules.

No remaining item blocks the Stage 07 exit gate.

## Repository status and last known-good checkpoint

- Stage branch: `agent/stage-07-hos-sleeper-adverse-policy`
- Pull request: `#10`
- Last fully verified current-guidance checkpoint: `ca606daae073683eb51e1da64f325fb43138080d`
- Required merge condition: successful full CI on the final documented pull-request head
- Stage 07 remains isolated from `main` until merge

## Next source

- Required next file after Stage 07 acceptance: `docs/specification/08_HOS_AUTOMATED_TEST_SUITE.md`
- Preconditions: merge the fully verified Stage 07 pull request, close the Stage 07 ledger on `main`, reopen the Prime Directive and Error Recovery Protocol, and reinspect the accepted Stage 04 through Stage 07 contracts and engines
- Instruction: create the comprehensive automated HOS acceptance suite without changing verified legal behavior merely to satisfy a test
