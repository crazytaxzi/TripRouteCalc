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

Stage 05 required current official federal property-carrying HOS verification but no commercial-routing provider, production regulatory feed, authentication system, new database migration, or deployment target. Current FMCSA guidance was checked on 2026-07-20, the pure engine and complete boundary suite passed repository CI, and no mandatory Stage 05 requirement remains blocked. B-002 through B-004 remain visible future concerns. Stage 06 can proceed with the existing historical duty data model and must calculate cycle history, recap timing, and explicitly selected restart behavior without inventing a provider or silently trusting entered cycle totals.
