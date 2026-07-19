# Blockers

## B-001: Canonical GitHub repository not yet created

**Severity:** High

The local repository is prepared, but there is no `crazytaxzi/TripRouteCalc` remote. The available GitHub connector can read and modify existing repositories but cannot create a new repository. The current execution environment also lacks an authenticated GitHub CLI session.

**Resolution:** Create the private repository through GitHub or provide an authenticated repository-creation path, then push this initial commit and record the remote URL.

## B-002: Commercial routing provider not selected

**Severity:** Expected future blocker

A legal CMV route cannot be verified until a commercial-routing provider and credentials are selected. No provider may be replaced by a consumer-route fallback.

## B-003: Regulatory data sources not selected

**Severity:** Expected future blocker

State and local rules must be versioned, effective-dated, source-attributed, and reviewable. Provider or licensed data decisions remain open.

## B-004: Deployment target not selected

**Severity:** Low during Stage 01

Docker Compose is the greenfield default, but hosting, secrets management, backups, and production database infrastructure remain undecided.
