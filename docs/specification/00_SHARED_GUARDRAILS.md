# Shared Guardrails for Every TripRouteCalc Chat

> Use this source as the active assignment for one dedicated implementation chat.  
> Read `00_SHARED_GUARDRAILS.md`, the repository implementation ledger, and every prerequisite source listed below before changing code.  
> Inspect the real repository first. Existing code is authoritative over guessed names, paths, schemas, packages, or architecture.

## Universal rules

- Treat TripRouteCalc as a safety-sensitive planning system.
- It is not an ELD and must never be described as a substitute for a driver, carrier safety department, permit office, official authority, or law enforcement.
- Never reduce a legal trip calculation to miles divided by one speed.
- Never use a consumer automobile route as the legal CMV plan.
- Never claim a route is legal when commercial-route or regulatory verification is missing.
- Never silently ignore missing dimensions, axle weights, KPRA, permit data, route restrictions, time zones, or provider failures.
- Missing information must either block the relevant decision or lower confidence with a visible reason.
- Keep HOS, routing, regulatory compliance, ETA simulation, persistence, API, and UI concerns separated.
- Regulations must be data-driven, versioned, effective-dated, source-attributed, reviewable, and replaceable without rewriting the HOS engine.
- Use explicit units and integer duration precision. Do not use floating-point decimal hours for authoritative HOS arithmetic.
- Store authoritative timestamps in UTC and location time zones as IANA identifiers.
- Do not invent component names, tables, routes, environment variables, provider responses, credentials, or integrations.
- Do not add a second framework, ORM, API stack, styling system, auth system, or deployment method when the repository already has a suitable one.
- Production code must not contain fake routing results, placeholder legal rules, demo-only calculations, or TODOs for core behavior.
- Test doubles and fixtures are allowed only inside tests and must not become production fallbacks.
- External provider or regulatory-data blockers must be reported clearly, with the implemented contract and exact missing setup.
- Do not delete or overwrite the only prior trip calculation. Preserve revisions and evidence.
- Route-legality failures block finalization. Uncertain operational assumptions may lower confidence without blocking.
- Every important result must be explainable from inputs, rules, route data, and timestamped events.

## Repository discipline

Before coding:

1. Inspect the relevant repository areas, tests, schemas, migrations, config, and documentation.
2. Read the current implementation ledger and prior handoffs.
3. Verify prerequisite stages are actually present.
4. Run the smallest useful baseline checks before making changes.
5. Record material architectural decisions rather than burying them in chat.

During coding:

1. Preserve established naming and module boundaries.
2. Keep calculations pure where practical.
3. Validate at trust boundaries.
4. Add tests alongside behavior.
5. Avoid unrelated visual redesigns and opportunistic refactors.
6. Update documentation when behavior or setup changes.

Before completion:

1. Run applicable unit, integration, type, lint, migration, build, and end-to-end checks.
2. Save evidence where the repository's workflow expects it.
3. Update status, decisions, blockers, and the stage handoff.
4. State precisely what remains unverified.

## Default architecture only when truly greenfield

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

## Master non-negotiables

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
