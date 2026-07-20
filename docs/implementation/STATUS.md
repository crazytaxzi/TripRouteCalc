# Implementation Status

## Project state

- Canonical repository: `crazytaxzi/TripRouteCalc`
- Repository visibility: private
- Default branch: `main`
- Active implementation branch: none
- Active pull request: none
- Last completed pull request: `#10`
- Product status: explicit federal split-sleeper evaluation, adverse-driving-condition selection, stricter carrier planning limits, and unsupported-rule warnings complete, verified, and merged
- Completed sources: `01_REPOSITORY_AUDIT_AND_PLAN.md` through `07_HOS_SLEEPER_ADVERSE_AND_CARRIER_POLICY.md`
- Stage 01 status: COMPLETE
- Stage 02 status: COMPLETE
- Stage 03 status: COMPLETE
- Stage 04 status: COMPLETE
- Stage 05 status: COMPLETE
- Stage 06 status: COMPLETE
- Stage 07 status: COMPLETE
- Next source: `08_HOS_AUTOMATED_TEST_SUITE.md`
- Application code: `@trip-route-calc/foundation` and `@trip-route-calc/persistence`
- Database migrations: Stage 03 initial migration plus the verified Stage 04 append-only HOS evidence migration; Stages 05 through 07 added no migration
- Production integrations: none

## Stage 07 completed

- Added pure `calculateHosAdvancedRules` composition over validated Stage 04 evidence and the accepted Stage 05 core result.
- Validated explicit sleeper-pair identity, exact period evidence, distinct long and short roles, ordering, overlap, duration, combined rest, and clock feasibility.
- Supported current federal 7/3 and 8/2 pairings: at least seven consecutive hours in the sleeper berth plus at least two consecutive hours off duty inside or outside the berth, totaling at least ten hours.
- Allowed the short qualifying period to be `OFF_DUTY` or `SLEEPER_BERTH` while requiring the long qualifying period to be `SLEEPER_BERTH`.
- Recalculated the 11-hour driving allowance and 14-hour window from the end of the first selected period while excluding both qualifying periods and leaving cycle availability unchanged.
- Honored an explicitly selected valid pair even when a ten-consecutive-hour rest period could also reset the standard clocks, matching FMCSA guidance issued July 1, 2026.
- Applied adverse-driving-condition extensions only after explicit selection, supporting context, sufficient confidence, a normally completable run, and evidence that the condition was not reasonably knowable beforehand.
- Limited adverse extensions to 120 minutes and preserved cycle and 30-minute-interruption constraints.
- Applied carrier daily-driving and duty caps independently from federal maxima and reported exact carrier-policy violation timestamps.
- Reported nightly-rest preference conflicts as planning-policy results without rewriting federal clocks.
- Preserved unsupported personal-conveyance, exception, exemption, emergency, and pilot selections as blocking/manual warnings with no automatic clock effect.
- Exported the module through `@trip-route-calc/foundation` and `@trip-route-calc/foundation/hos-advanced`.
- Added 12 focused tests covering valid and invalid pairs, explicit pair selection, the ten-hour-reset choice, exact adverse boundaries, carrier caps, rest preferences, and unsupported special rules.

## Verification evidence

GitHub Actions CI run 254 passed on implementation head `e08be59579c593bddbb50ff8a2e8ba9442f365be` after the initial lint corrections.

GitHub Actions CI run 259 passed on current-guidance head `ca606daae073683eb51e1da64f325fb43138080d`.

Final GitHub Actions CI run 273 passed on documented pull-request head `ebe95890c1fa723b19065c987d27f38cc5e9765a`:

- `pnpm install --frozen-lockfile`
- `pnpm db:generate`
- `pnpm db:validate`
- `pnpm db:migrate:deploy`
- `pnpm lint:source`
- `pnpm typecheck:source`
- `pnpm test:source`
- `pnpm build:source`

The complete repository test suite passed against PostgreSQL 18. Stage 07 changed no Prisma schema and required no migration.

The verified Stage 07 pull request was squash-merged into `main` as commit `2cb7d412675e757eb2d3ee70de8f23fd1711530d`.

Current federal behavior was checked on 2026-07-20 against official FMCSA HOS guidance, the property-carrying HOS summary, and the revised split-sleeper FAQs issued July 1, 2026. Current 6/4, 5/5, and split-duty alternatives remain pilot-only and are not standard production rules.

The local execution container could not reach GitHub or the package registry through normal DNS. Canonical repository reads and writes used the connected GitHub application, strict isolated TypeScript checks used the local recovered source, and authoritative frozen-lockfile, PostgreSQL, lint, type, runtime, and build verification used GitHub Actions. No unavailable local check was reported as successful.

## Deferred decisions and limitations

- Stage 05 remains authoritative for standard daily clocks, the 30-minute interruption, and the 10-hour reset.
- Stage 06 remains authoritative for rolling cycle history, recaps, and explicitly selected 34-hour restart effects.
- Stage 07 composes the accepted evidence and Stage 05 result; it does not merge all HOS modules into routing or ETA.
- The adverse-driving-condition result remains an explicitly selected planning calculation. It is not an automatic claim that ordinary congestion, routine weather, delay, or poor planning qualifies.
- Personal conveyance, yard move, short haul, the 16-hour exception, agriculture, emergency declarations, emergency exceptions, team operation, and pilot programs remain unsupported/manual.
- Commercial-routing provider and credentials remain unselected.
- Production regulatory and licensed data sources remain unselected.
- No route may be called legal or provider-verified yet.
- No API, UI, map, export renderer, authentication system, or production deployment exists yet.

## Next source

Stage 07 is complete, verified, and merged. Reopen the Prime Directive and Error Recovery Protocol and begin `docs/specification/08_HOS_AUTOMATED_TEST_SUITE.md` from the accepted Stage 04 through Stage 07 contracts and engines.
