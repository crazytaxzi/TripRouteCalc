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

**Status:** Proposed for implementation

Unless later repository evidence justifies a change, the planned stack is:

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

Exact package versions and directory names are not locked until the implementation stage creates and verifies them.

## D-005: Keep safety-critical domains separate

**Status:** Accepted

HOS, commercial routing, regulatory compliance, ETA simulation, persistence, API, and UI must remain distinct modules with explicit contracts. UI convenience must not rewrite legal arithmetic.

## D-006: Default the initial GitHub repository to private

**Status:** Proposed

The repository should begin private because it contains an unfinished safety-sensitive product specification and no verified production implementation. Visibility can be changed intentionally later.
