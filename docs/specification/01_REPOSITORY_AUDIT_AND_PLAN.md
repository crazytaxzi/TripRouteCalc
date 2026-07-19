# 01. Repository Audit and Implementation Plan

> Use this source as the active assignment for one dedicated implementation chat.  
> Read `00_SHARED_GUARDRAILS.md`, the repository implementation ledger, and every prerequisite source listed below before changing code.  
> Inspect the real repository first. Existing code is authoritative over guessed names, paths, schemas, packages, or architecture.

## Prerequisites

- `00_SHARED_GUARDRAILS.md`
- `99_ORIGINAL_MASTER_SPEC.md`

## Goal

Inspect the canonical repository completely enough to produce an evidence-backed implementation plan. This chat establishes what exists, what is missing, what must be preserved, and the exact order in which later source files should touch the codebase.

## Required work

1. Identify the frontend, backend, package manager, workspace structure, database, ORM, migration system, validation library, API framework, authentication, authorization, styling, mapping, tests, CI, deployment, logging, and environment-variable conventions.
2. Inventory applications, packages, services, shared libraries, migrations, scripts, containers, infrastructure, and generated artifacts.
3. Locate any existing trip, routing, HOS, equipment, stop, regulatory, time-zone, export, or audit code.
4. Detect duplicate implementations, abandoned scaffolding, unsafe placeholders, hardcoded legal logic, consumer-route fallbacks, fake provider data, and production TODOs.
5. Run baseline install, type-check, lint, tests, migrations, and build where supported. Record failures without hiding them.
6. Compare the repository against the master completion criteria and produce a gap matrix.
7. Create or update the implementation ledger, decision log, blockers log, and handoff directory.
8. Produce a dependency-aware stage plan matching the numbered source pack. Adjust paths and implementation details to the real repository, but do not reorder legal/time foundations behind UI polish.
9. Make no broad feature implementation in this chat. Small fixes are allowed only when required to complete the audit tooling or restore a broken baseline, and every such fix must be documented.

## Required artifacts

- Repository architecture map
- Stack and dependency inventory
- Existing capability inventory
- Gap matrix against the master specification
- Risk register
- Baseline command evidence
- Stage-by-stage implementation map with likely directories and test targets
- Initial implementation ledger and handoff

## Exit gate

This stage is complete only when later chats can identify the correct modules and commands without guessing.

## Relevant master requirements

## 1. Non-Negotiable Development Rules

Before modifying or creating code:

1. Inspect the entire repository.
2. Identify the existing framework, package manager, database, API structure, styling system, authentication system, test setup, and deployment method.
3. Preserve the existing architecture when it is reasonable.
4. Do not replace a functioning stack merely because another stack is preferred.
5. Do not invent existing component names, database tables, routes, environment variables, or integrations.
6. Do not create duplicate services or parallel implementations of existing functionality.
7. Do not use placeholders, mock APIs, fake routing responses, fake regulatory data, or hardcoded demo calculations in production code.
8. Do not leave TODO comments for core functionality.
9. Do not claim that a route is legal unless the route has been checked against the available commercial-routing and regulatory data.
10. Do not use a consumer automobile route as the sole source for CMV routing.
11. Do not silently ignore unavailable information.
12. When information is missing, show exactly what could not be verified and lower the confidence of the result.
13. Every important calculation must be explainable to the user.
14. Build this as a planning tool, not as an electronic logging device and not as a substitute for the driver, motor carrier, safety department, permit office, or law enforcement.
15. Regulations must be data-driven, versioned, source-attributed, and updateable without rewriting the calculation engine.

If the repository is empty or truly greenfield, use the following default architecture:

* TypeScript throughout
* React with Vite for the frontend
* Mobile-first Progressive Web App
* Fastify or an equally lightweight TypeScript backend
* PostgreSQL
* Prisma or the repository’s established ORM
* Zod or equivalent runtime validation
* OpenAPI-documented REST API
* Vitest for unit and integration tests
* Playwright for end-to-end tests
* Docker Compose for reproducible local and production-like deployment
* pnpm workspaces if a monorepo is appropriate

Do not change an existing stack solely to match these defaults.

## 29. Implementation Sequence

Complete the work in this order:

1. Repository audit
2. Domain model
3. Units and time-handling foundation
4. HOS engine
5. HOS unit tests
6. Equipment and load validation
7. Commercial-route provider interface
8. Compliance-rules engine
9. Stop and appointment engine
10. ETA simulator
11. Confidence calculation
12. Persistence
13. APIs
14. Mobile-first UI
15. Route timeline
16. Map integration
17. Exports
18. End-to-end tests
19. Security review
20. Documentation
21. Production build verification

Do not begin with visual polish while the time, HOS, and compliance foundations are incomplete.

## Required completion report

Before ending the chat, provide:

1. What you inspected before coding.
2. What you implemented.
3. Every file created, changed, moved, or deleted.
4. Database migrations or data changes, if any.
5. Commands actually run.
6. Test, lint, type-check, migration, and build results.
7. Remaining blockers, missing credentials, unverified legal data, or known limitations.
8. The exact next source file that should be used in the next dedicated chat.

Do not report success for checks that were not actually run. Update the repository's implementation ledger and create a concise handoff note for this stage.
