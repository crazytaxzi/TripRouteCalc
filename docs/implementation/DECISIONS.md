# Architectural Decision Log

## D-001: Treat the project as greenfield

**Status:** Accepted

No prior application repository or implementation was supplied. The source pack is a specification and staged execution plan, not an existing codebase. The repository therefore begins with documentation and coordination records only.

## D-002: Preserve the source pack verbatim

**Status:** Accepted

All Markdown source files are stored under `docs/specification/`. The original master specification remains controlling beneath current user instructions.

## D-003: Do not generate a cosmetic or placeholder application during Stage 01

**Status:** Accepted

Stage 01 is for audit and planning. Creating a UI shell, fake route provider, mock legal rules, or speculative data model would manufacture technical debt and violate the source guardrails.

## D-004: Use the documented greenfield architecture as the starting direction

**Status:** Accepted for staged implementation

The planned stack remains:

- TypeScript
- pnpm workspace monorepo
- React and Vite mobile-first PWA
- Fastify backend
- PostgreSQL
- Prisma
- Zod
- OpenAPI REST API
- Vitest
- Playwright
- Docker Compose

Stage 02 established the TypeScript, pnpm, Zod, and Vitest foundation. Later stages will introduce the remaining pieces only when their active source requires them.

## D-005: Keep safety-critical domains separate

**Status:** Accepted

HOS, commercial routing, regulatory compliance, ETA simulation, persistence, API, and UI must remain distinct modules with explicit contracts. UI convenience must not rewrite legal arithmetic.

## D-006: Default the initial GitHub repository to private

**Status:** Accepted

The repository remains private because it contains an unfinished safety-sensitive product specification and no verified production application.

## D-007: Use one shared foundation package

**Status:** Accepted

`@trip-route-calc/foundation` is the stable shared import boundary for product terminology, supported scope, units, time primitives, and provider-neutral domain contracts. Later packages must import these contracts rather than creating parallel measurement or time implementations.

## D-008: Use explicit canonical measurement objects

**Status:** Accepted

Authoritative measurements use unit-bearing objects:

- Distance: meters
- Duration: non-negative safe integer minutes
- Weight: pounds
- Length: inches
- Speed: meters per second

Display conversions may produce other units, but bare numeric measurements are rejected at runtime. Decimal hours are never authoritative HOS arithmetic.

## D-009: Use Temporal-backed UTC and IANA time handling

**Status:** Accepted

Authoritative instants are canonical UTC ISO 8601 strings. Location time zones are validated IANA identifiers. The Temporal polyfill resolves local appointment times, rejects spring-transition gaps, and requires an explicit earlier-or-later choice for repeated fall-transition times. Time-zone offsets are never inferred from longitude.

## D-010: Keep Stage 02 domain contracts provider-neutral and persistence-neutral

**Status:** Accepted

The foundation defines the minimum master-spec entities and their relationships without adopting external routing payloads or database schemas. Persistence mapping begins in Stage 03. Route contracts include an explicit `unverified` state and may not imply route legality without later commercial-routing and regulatory evidence.

## D-011: Pin reproducible foundation tooling

**Status:** Accepted

The repository uses Node.js 22, pnpm 9.15.4, a committed pnpm lockfile, strict TypeScript, typed ESLint rules, Vitest, and GitHub Actions. CI installs with `--frozen-lockfile` and runs lint, type-check, tests, and build as separate visible gates.
