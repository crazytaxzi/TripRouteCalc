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

State and local rules must be versioned, effective-dated, source-attributed, and reviewable. Provider or licensed data decisions remain open.

## B-004: Deployment target not selected

**Severity:** Low during foundation work  
**Status:** Deferred

Docker Compose remains the greenfield direction, but hosting, secrets management, backups, and production database infrastructure remain undecided. This did not block Stage 02 foundation work.

## Stage 02 blocker review

**Status:** No active Stage 02 blocker

Stage 02 required no production provider credentials, regulatory data, database service, migration target, or deployment target. The shared foundation package, lockfile, tests, and CI are complete. B-002 through B-004 remain visible future-stage concerns and must not be disguised with placeholder production behavior.
