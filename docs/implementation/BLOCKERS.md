# Blockers

## B-001: Canonical GitHub repository not yet created

**Severity:** High  
**Status:** Resolved  
**Resolved:** 2026-07-19

The private canonical repository now exists at `crazytaxzi/TripRouteCalc`, uses `main` as its default branch, and contains the complete specification pack and implementation ledger. The temporary import workflow and staging artifacts were removed after successful verification.

## B-002: Commercial routing provider not selected

**Severity:** Expected future blocker  
**Status:** Open for later routing stages

A legal CMV route cannot be verified until a commercial-routing provider and credentials are selected. No provider may be replaced by a consumer-route fallback.

## B-003: Regulatory data sources not selected

**Severity:** Expected future blocker  
**Status:** Open for later compliance stages

State and local rules must be versioned, effective-dated, source-attributed, and reviewable. Stage 03 provides the storage and change-history structure, but provider or licensed production-data decisions remain open.

## B-004: Deployment target not selected

**Severity:** Low during foundation and persistence work  
**Status:** Deferred

Docker Compose now provides a reproducible local PostgreSQL service, but hosting, secrets management, backup automation, recovery objectives, retention periods, and production database infrastructure remain undecided.

## Stage 02 blocker review

**Status:** No active Stage 02 blocker

Stage 02 required no production provider credentials, regulatory data, database service, migration target, or deployment target. The shared foundation package, lockfile, tests, and CI are complete.

## Stage 03 blocker review

**Status:** No active Stage 03 blocker

Stage 03 required a reproducible PostgreSQL migration target but did not require production hosting, routing credentials, or production regulatory data. PostgreSQL 18, Prisma 7, the committed migration, tenant-scoped repositories, append-only evidence, integration tests, and CI verification are complete. B-002 through B-004 remain visible later-stage concerns and must not be disguised with fake providers, placeholder legal rules, or unverified operational claims.

## Stage 04 blocker review

**Status:** No active Stage 04 blocker

Stage 04 required no commercial-routing provider, production regulatory source, authentication system, or deployment target. The complete driver departure state, timestamped duty-event history, provenance, tenant-scoped append-only persistence, PostgreSQL migration, unit and integration tests, lint, type-check, and build are verified. B-002 through B-004 remain visible later-stage concerns and must not be disguised with inferred clocks, fake providers, placeholder legal rules, or unverified operational claims.

## Stage 05 blocker review

**Status:** No active Stage 05 blocker

Stage 05 required current official federal property-carrying HOS verification but no commercial-routing provider, production regulatory feed, authentication system, new database migration, or deployment target. Current FMCSA guidance was checked on 2026-07-20, the pure engine and complete boundary suite passed repository CI, and no mandatory Stage 05 requirement remains blocked. B-002 through B-004 remain visible future concerns.

## Stage 06 blocker review

**Status:** No active Stage 06 blocker

Stage 06 required complete timestamped duty history, an explicit carrier-designated home-terminal regulatory boundary, and current federal cycle and restart verification. Those inputs and authorities were sufficient to implement and verify rolling 60-hour/7-day and 70-hour/8-day calculations, recap timing, discrepancy reporting, cycle blocking, and explicitly selected 34-hour restart behavior. No production routing provider, regulatory feed, authentication system, new database migration, or deployment target was required.

## Stage 07 blocker review

**Status:** No active Stage 07 blocker

Stage 07 required accepted Stage 04 sleeper metadata, the verified Stage 05 core result, explicit user selection, supporting adverse-condition context, carrier targets, and current federal guidance. Those inputs were sufficient to implement and verify split-sleeper qualification, explicit 7/3 and 8/2 selection, current July 1, 2026 rest-period choice guidance, adverse-driving-condition extensions, stricter carrier caps, rest-preference conflicts, and unsupported-rule warnings. No production routing provider, regulatory feed, authentication system, database migration, or deployment target was required.

B-002 through B-004 remain visible future concerns. Pilot-program participation, personal conveyance, yard move, short haul, the 16-hour exception, agriculture, emergency declarations, and other unsupported rules are deliberately blocked from automatic clock alteration rather than hidden behind approximations.

The local container's outbound DNS and package access remained unavailable, but connected GitHub and GitHub Actions supplied a complete recovery and verification path without weakening requirements or claiming unobserved local success.

## Stage 08 blocker review

**Status:** No active Stage 08 blocker

Stage 08 required accepted HOS contracts and engines, a clean PostgreSQL integration target, and the existing strict repository gates. Those inputs were sufficient to add and verify the complete master-scenario, boundary, replay, isolation, timezone, and persistence-mapping suite. No provider credential, regulatory feed, production deployment, schema migration, or new legal interpretation was required.

The expanded suite exposed no verified production HOS defect. Commercial routing, production regulatory data, and deployment remain visible future blockers and were not replaced with mocks or approximations.

