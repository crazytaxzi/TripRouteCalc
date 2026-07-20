# Implementation Status

## Project state

- Canonical repository: `crazytaxzi/TripRouteCalc`
- Repository visibility: private
- Default branch: `main`
- Active implementation branch: `agent/stage-06-hos-cycle-recaps-restart`
- Active pull request: `#8`
- Last completed pull request: `#6`
- Product status: rolling federal property-carrying HOS cycle history, recap timing, and explicitly selected 34-hour restart behavior complete and verified, pending merge
- Completed sources: `01_REPOSITORY_AUDIT_AND_PLAN.md` through `06_HOS_CYCLE_RECAPS_AND_RESTART.md`
- Stage 01 status: COMPLETE
- Stage 02 status: COMPLETE
- Stage 03 status: COMPLETE
- Stage 04 status: COMPLETE
- Stage 05 status: COMPLETE
- Stage 06 status: COMPLETE, VERIFIED, PENDING MERGE
- Next source: `07_HOS_ADVANCED_RULES_AND_CARRIER_POLICY.md`
- Application code: `@trip-route-calc/foundation` and `@trip-route-calc/persistence`
- Database migrations: Stage 03 initial migration plus the verified Stage 04 append-only HOS evidence migration; Stages 05 and 06 added no migration
- Production integrations: none

## Stage 06 completed

- Added a pure `calculateHosCycle` service isolated from UI, persistence, routing, ETA, provider, and Stage 05 daily-clock concerns.
- Derived 60-hour/7-day and 70-hour/8-day cycle availability from complete timestamped driving and on-duty-not-driving history.
- Reconciled entered cycle time remaining and entered recap predictions against derived history without mutating or silently replacing the recorded evidence.
- Required an explicit carrier-designated home-terminal IANA time zone, local 24-hour boundary, repeated-time choice, and nonexistent-time resolution.
- Split on-duty evidence across regulatory days and returned timestamped recap availability at the configured boundary rather than arbitrary midnight.
- Blocked both driving and on-duty-not-driving planning when derived cycle availability reached zero and reported exact first-prohibited timestamps.
- Applied a historical 34-hour restart only when the caller explicitly selected a fully evidenced qualifying interval.
- Applied a future 34-hour restart only when restart intent was explicitly recorded and the supplied event timeline actually completed 2,040 consecutive off-duty or sleeper-berth minutes.
- Preserved qualifying rest already in progress across the departure boundary rather than artificially restarting the 34-hour count.
- Preferred an earlier sufficient recap over an unnecessary 34-hour restart and returned structured next-availability guidance when cycle time was exhausted.
- Returned immutable regulatory-day windows, reconciliation results, snapshots, per-event transitions, recap and restart availability events, violations, reasons, and next-cycle availability.
- Added focused tests for both cycle types, zero-cycle departure, exact recap timing, explicit versus unplanned restart behavior, 2,039/2,040/2,041-minute restart boundaries, selected historical restarts, home-terminal time-zone ownership, DST gaps, and repeated local times.
- Exported the engine through `@trip-route-calc/foundation` and `@trip-route-calc/foundation/hos-cycle`.

## Verification evidence

GitHub Actions CI run 210 passed against a clean PostgreSQL 18 service on implementation head `32f1ac6be7ecd33dc3a891819d648f977d8b3097`:

- `pnpm install --frozen-lockfile`
- `pnpm db:generate`
- `pnpm db:validate`
- `pnpm db:migrate:deploy`
- `pnpm lint:source`
- `pnpm typecheck:source`
- `pnpm test:source`
- `pnpm build:source`

The Stage 06 suite contributed 13 cycle, recap, restart, time-zone, and DST tests, and the complete repository test suite passed without modifying a database schema.

A strict isolated TypeScript 5.8.3 harness also passed on Node.js 22.16.0. The container could not clone GitHub or install packages because outbound DNS and registry access were unavailable, so canonical repository reads, writes, and CI verification used the connected GitHub environment. No success was inferred from the unavailable local network path.

Current federal cycle and restart behavior was checked on 2026-07-20 against official FMCSA guidance and the current text of 49 CFR 395.2, 395.3, and 395.8. The implementation uses the carrier-designated home-terminal 24-hour period and does not revive obsolete 1 a.m. to 5 a.m. or once-per-168-hour restart restrictions.

## Deferred decisions and limitations

- Stage 06 owns rolling cycle arithmetic only. Stage 05 remains authoritative for the 11-hour driving allowance, 14-hour window, 30-minute interruption, and 10-hour reset.
- Callers must compose Stage 05 and Stage 06 results and obey the most restrictive applicable constraint; this stage does not merge the two result objects into a route or ETA calculation.
- Sleeper evidence remains candidate data only. Stage 07 owns split-sleeper validation.
- Adverse conditions and carrier-policy limits remain Stage 07 concerns.
- Personal conveyance, exceptions, exemptions, pilot programs, and emergency declarations are never activated automatically.
- Commercial-routing provider and credentials remain unselected.
- Production regulatory and licensed data sources remain unselected.
- No route may be called legal or provider-verified yet.
- Production hosting, secrets management, backup schedules, recovery objectives, retention periods, and database operations remain undecided.
- No API, UI, map, export renderer, or production deployment exists yet.

## Next source

After pull request `#8` is merged and the implementation ledger is closed on `main`, begin `07_HOS_ADVANCED_RULES_AND_CARRIER_POLICY.md` by reopening the Prime Directive and Error Recovery Protocol and reinspecting the accepted Stage 04 evidence contracts plus the Stage 05 and Stage 06 pure calculation boundaries.
