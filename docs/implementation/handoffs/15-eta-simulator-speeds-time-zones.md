# Stage 15 Handoff: ETA Simulator, Speeds, and Time Zones

- Source: `docs/specification/15_ETA_SIMULATOR_SPEEDS_TIME_ZONES.md`
- Date: 2026-07-21
- Implementation branch: `agent/stage-15-eta-simulator`
- Implementation pull request: `#27 Implement Stage 15 ETA simulator speeds and time zones`
- Ledger-closure pull request: `#28 Close Stage 15 implementation ledger`
- Verified implementation head: `50684e7d7909ce190556cc910d69a08b0873d54e`
- Clean implementation CI: run `893` (`29828350875`)
- Verified completion-handoff head: `57317b95b9fc55d4d14d60acf8f624a0db18afb5`
- Clean completion-handoff CI: run `895` (`29828570575`)
- Implementation merge commit: `8e3fca9f747ba9e98cb607943cf91235a54a99ea`
- Completion status: COMPLETE, VERIFIED, MERGED, AND LEDGER-CLOSED

## Protected governance

Stage 15 was executed under `PRIME_DIRECTIVE.md` and `ERROR_RECOVERY_PROTOCOL.md`. Existing Stage 04 through Stage 14 contracts were preserved. HOS, cycle availability, sleeper selection, stop processing, route evidence, compliance, operational events, persistence, API, and UI boundaries were not collapsed into the ETA simulator.

## What was inspected before coding and recovery

- protected governance and recovery protocol;
- Stage 15 source, shared guardrails, master requirements, implementation status, blockers, decisions, gap matrix, and Stage 14 handoff;
- accepted HOS departure-state, duty-event, core-clock, cycle, restart, sleeper, and carrier-policy contracts;
- ordered stop, appointment, facility-hour, waiting, service, parking, and HOS-overlap behavior;
- commercial-route legs, segments, travel time, provider evidence, restrictions, confidence, and unavailable-field contracts;
- regulatory findings, compliance actions, KPRA revalidation, and operational-event placement contracts;
- UTC/IANA time-domain and DST resolution utilities;
- immutable trip-revision input/result snapshots and calculation-result persistence; and
- permanent GitHub Actions CI, TypeScript, ESLint, Vitest, Prisma, PostgreSQL, and build configuration.

## Requirement traceability

| ID | Requirement | Implementation | Validation | Status |
|---|---|---|---|---|
| R15-01 | Consume route, HOS, stops, appointments, compliance, fuel/inspection events, buffers, traffic, and weather | `EtaSimulationInput` and simulator composition | foundation unit and acceptance suites | satisfied |
| R15-02 | Chronological minute-precision simulation | integer-minute UTC event loop | chronology, HOS transition, and snapshot tests | satisfied |
| R15-03 | Stop at drive, shift, cycle, route, or compliance constraint | structured blocking and earliest-constraint processing | zero-clock, blocked-route, missing-action, and manual-verification tests | satisfied |
| R15-04 | Insert earliest sufficient interruption/rest or supplied recap/restart/sleeper action | HOS action composer plus explicit Stage 06/07 availability handoff | interruption, ten-hour rest, cycle, restart, sleeper, and overlap tests | satisfied |
| R15-05 | Earliest legal, expected, and conservative projections | shared event model with explicit projection factors | projection and deterministic snapshot tests | satisfied |
| R15-06 | Minimum, expected, and maximum stop durations | stop projection mapping | ranged service tests and per-stop duration acceptance case | satisfied |
| R15-07 | Documented constrained commercial speed model | governed, carrier, planning, road, provider, legal, grade, urban, traffic, and weather evidence stack | speed-cap and fallback tests plus architecture documentation | satisfied |
| R15-08 | Never plan the whole trip at governed maximum | minimum applicable cap and projection factor | speed-decision assertions | satisfied |
| R15-09 | Prefer verified provider time and label fallback | verified provider-duration cap and explicit fallback average | provider-time and unavailable-data tests | satisfied |
| R15-10 | Lower confidence for fallback speed assumptions | structured confidence reasons | fallback-confidence tests | satisfied |
| R15-11 | UTC storage and IANA local rendering | UTC authoritative chronology plus `DisplayLocalTime` at every transition | time-zone acceptance matrix | satisfied |
| R15-12 | DST gaps, repeated times, and crossings during driving/rest | shared Temporal/IANA resolution and endpoint-specific local rendering | spring-forward, fall-back, Pacific/Mountain, Mountain/Central, Central/Eastern, and rest-crossing tests | satisfied |
| R15-13 | Complete timeline and HOS state at every transition | `EtaTimelineEvent` with before/after clocks and identifiers | event timeline assertions and persisted snapshot replay | satisfied |
| R15-14 | Deterministic multi-stop, rest, overlap, appointment, and route tests | original and acceptance Stage 15 suites | all required explicit scenarios in permanent CI | satisfied |
| R15-15 | Same persisted revision reproduces the same projections and timeline | immutable input snapshot plus deterministic result snapshot | PostgreSQL replay integration test | satisfied |

## Implemented scope

- Added a pure event-based simulator that advances one immutable state in UTC whole minutes.
- Added earliest-legal, expected, and conservative projections over the same explainable event model.
- Added constrained segment speed decisions using governed, carrier, planning, road-class, provider, legal, grade, urban, traffic, and weather inputs.
- Preferred verified commercial-provider travel time and used a labeled conservative fallback with reduced confidence when detailed timing evidence is unavailable.
- Composed route, HOS, ordered stops, appointments, compliance actions, operational events, and explicit HOS-availability actions without duplicating their engines.
- Stopped continuation at zero clocks, unusable or unverified route evidence, manual-verification restrictions, unplaceable required actions, or unsupported HOS certainty.
- Preserved appointment lateness as an outcome rather than changing legal speed or clock assumptions.
- Added UTC start/end instants and explicit IANA local rendering to every timeline transition.
- Preserved the stop processor's explicit appointment-wait, check-in, service, and HOS-hold event identities.
- Allowed required interruption or rest time to overlap entered qualifying stop time without double-counting.
- Added deterministic snapshots and persisted revision replay for all three projections and the complete timeline.
- Reused the existing immutable revision model; no database schema change was required.

## Required explicit scenarios

The permanent Stage 15 suites cover:

- Pacific to Mountain, Mountain to Central, and Central to Eastern crossings;
- spring-forward and fall-back DST transitions;
- destination-local appointment interpretation;
- a time-zone crossing adjacent to qualifying rest;
- shipper, intermediate stop, and final consignee;
- five intermediate stops;
- stop reorder after calculation;
- stop insertion between existing stops;
- different service duration at every stop;
- early appointment waiting and late appointment reporting;
- 30-minute interruption overlap with qualifying stop service;
- ten-hour rest overlap with overnight facility waiting; and
- deterministic replay from one persisted revision.

## Files created or changed

Product and tests:

- `packages/foundation/src/eta-simulator.ts`
- `packages/foundation/src/index.ts`
- `packages/foundation/test/eta-simulator.test.ts`
- `packages/foundation/test/eta-simulator-acceptance.test.ts`
- `packages/persistence/test/eta-simulator.integration.test.ts`

Documentation and handoff:

- `docs/eta-simulator/README.md`
- `docs/implementation/decisions/15-eta-simulator-speeds-time-zones.md`
- `docs/implementation/handoffs/15-eta-simulator-speeds-time-zones.md`
- `README.md`
- `docs/implementation/STATUS.md`
- `docs/implementation/GAP_MATRIX.md`
- `docs/implementation/BLOCKERS.md`

No product file was moved or deleted. Temporary diagnostics and trigger files were removed before the clean permanent gate. The implementation pull request changed-file inventory contained only the expected Stage 15 product, test, and documentation files. Ledger closure changes documentation only.

## Database and data changes

No Prisma schema change or migration was required. Stage 15 reuses:

- immutable `trip_revisions.input_snapshot` and `trip_revisions.result_snapshot`;
- the existing `calculation_results` relation;
- ordered persisted stop details; and
- existing tenant ownership, content hashing, and audit boundaries.

The PostgreSQL integration test stores the complete simulator input and result, reloads the revision, runs the simulator twice, and requires both replays to equal the persisted three-projection timeline snapshot.

## Commands and verification actually run

The authoritative permanent GitHub Actions gate passed on implementation head `50684e7d7909ce190556cc910d69a08b0873d54e`, run `893` (`29828350875`), and completion-handoff head `57317b95b9fc55d4d14d60acf8f624a0db18afb5`, run `895` (`29828570575`). They ran:

- `pnpm install --frozen-lockfile`
- `pnpm db:generate`
- `pnpm db:validate`
- clean PostgreSQL 18 `pnpm db:migrate:deploy`
- `pnpm lint:source`
- `pnpm typecheck:source`
- complete `pnpm test:source`
- `pnpm build:source`

Focused GitHub Actions diagnostics also ran the Stage 15 type-check, acceptance, and persistence-replay suites while recovering clipped log output. No temporary diagnostic workflow remains in the repository.

## Recovery and adversarial review summary

- The local environment had no usable private checkout, GitHub CLI, package network access, pnpm, PostgreSQL, or Docker. Connected GitHub inspection and GitHub Actions were used as the authoritative execution path without claiming local success.
- Strict lint exposed an omitted helper return type; the helper contract was made explicit.
- Strict TypeScript exposed a mutable nested speed-model type; the public contract was corrected to accept immutable road-class inputs.
- The original ten-hour-rest test expected an in-transit HOS label even though the rest occurred at a stop; the assertion was corrected to the explicit stop hold.
- The acceptance matrix exposed generic event-type inference that mislabeled off-duty appointment waiting as a legal HOS hold. ETA mapping now prefers the stop processor's explicit event identity.
- Persistence diagnostics exposed exact optional-property misuse, a wrong relation field name, and a fixture marked verified without `verifiedAt`. Only the test and evidence contracts were corrected.
- The completion audit found no unresolved PR review threads, no temporary files, no new migration, and no consumer-route or fabricated-provider fallback.
- Strict lint, type-check, tests, migration validation, and build gates were preserved throughout.
- Pull request `#27` was squash-merged only after the implementation and handoff heads both passed the permanent gate.
- Pull request `#28` updates only the repository status, gap, blocker, README, and handoff ledger surfaces and advances the exact next source to Stage 16.

## Remaining blockers and limitations

- B-002 remains open. No licensed commercial-routing provider, route coverage statement, retention agreement, server-only credentials, or live adapter exists.
- B-003 remains open. No reviewed production regulatory corpus or licensed restriction feed exists.
- No live traffic, weather, closure, fuel, parking, scale, maintenance, border, meal, shower, or facility provider is configured.
- Supplied route, condition, and location fixtures prove deterministic behavior only and must not be represented as live production coverage.
- Cycle recap, restart, and sleeper availability are never invented. Stage 15 consumes explicit Stage 06/07 evidence or remains blocked.
- API, UI, map, export, authentication, deployment, and production verification remain later stages.
- The local environment could not run repository checks; authoritative checks ran in GitHub Actions and are reported as such.

## Next source

`docs/specification/16_CONFIDENCE_EXPLANATIONS_DATA_QUALITY.md`
