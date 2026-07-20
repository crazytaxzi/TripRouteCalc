# Persistence, Revisions, and Auditability

Stage 03 introduces the `@trip-route-calc/persistence` package, PostgreSQL 18, Prisma 7, a committed initial migration, tenant-scoped repositories, append-only calculation revisions, and database-backed integration tests.

## Safety boundary

Persistence records evidence. It does not decide whether a route is legal, calculate HOS, select regulations, or replace a driver, carrier safety department, permit office, or official authority.

Every repository operation that accepts a tenant context verifies that the acting user belongs to the requested carrier. Object queries include the carrier identifier, so an identifier from another account is treated as not found. Authentication and request-level authorization are introduced in later API and security stages; callers must not bypass these repositories with unscoped queries.

## Authoritative storage conventions

- Distance is stored as a numeric value with unit `meter`.
- Duration is stored as a non-negative integer value with unit `minute`.
- Weight is stored as a numeric value with unit `pound`.
- Length is stored as a numeric value with unit `inch`.
- Speed is stored as a numeric value with unit `meter-per-second`.
- Authoritative timestamps use PostgreSQL `TIMESTAMPTZ`.
- Location time zones remain IANA identifiers.
- Stop, route-leg, and route-segment order uses explicit positive sequence values. Row creation order is never authoritative.

Database check constraints enforce the critical unit, range, ordering, effective-window, provider-retention, and route-verification invariants that Prisma cannot express directly.

## Trip revisions

A trip points to its current revision, while every prior revision remains stored. Revision creation occurs in one transaction and records:

- the full input snapshot
- rule-set and routing-provider versions
- calculation timestamp
- ordered stops and appointment evidence
- assumptions
- warnings
- acknowledgements snapshot
- user overrides
- calculation result snapshot
- a canonical SHA-256 content hash
- the actor and audit event

The revision and its snapshot-owned child records are append-only. PostgreSQL triggers reject updates and deletions. A failed child insert rolls back the new revision and leaves the previous current revision untouched.

## Route-provider evidence

Provider credentials and secrets are never stored in trip records. Provider evidence supports three retention modes:

1. `raw-json`, only when the provider license explicitly allows raw-response retention.
2. `normalized-snapshot`, for a traceable provider-neutral record.
3. `provider-reference`, when only a provider request or archival reference may be retained.

The repository and database both reject an invalid retention combination.

## Regulatory records

Regulatory rule sets and jurisdiction rules are versioned, effective-dated, source-attributed, last-verified, activatable, and deactivatable. Administrative status changes create immutable change-history and audit records. Test fixtures are not production regulatory authority.

## Local database

Copy the example environment file, start PostgreSQL, then apply the committed migration:

```bash
cp .env.example .env
docker compose up -d postgres
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:validate
pnpm db:migrate:deploy
pnpm check
```

PostgreSQL 18 stores the named Docker volume at `/var/lib/postgresql`. Do not change the Compose mount to the pre-18 `/var/lib/postgresql/data` path.

## Migration policy

- Never edit a migration that has already been applied outside disposable development environments.
- Create a new migration for every schema or database-constraint change.
- Run migrations against a clean PostgreSQL database in CI.
- Review generated SQL before deployment, especially destructive operations, trigger changes, enum changes, and retention behavior.
- Back up before production migration and test restoration before considering the backup usable.
- Record the deployed application commit and migration set with operational release evidence.

## Backup and restoration implications

Production hosting and retention periods are not selected yet. Before production use, operations must define:

- encrypted automated PostgreSQL backups
- point-in-time recovery or an equivalent recovery objective
- off-host backup storage
- access controls and audit logs for backup retrieval
- restoration drills against an isolated environment
- retention rules for sensitive driver location, trip history, and HOS evidence
- provider-license limits on retained route payloads
- deletion procedures that do not destroy legally or operationally required audit evidence

A database backup is not verified until a restore has succeeded and revision counts, hashes, foreign keys, and append-only protections have been checked.
