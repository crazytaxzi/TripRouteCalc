# Repository Architecture Map

## Verified current tree

```text
TripRouteCalc/
├── .github/workflows/ci.yml
├── README.md
├── compose.yaml
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
├── tsconfig.typecheck.json
├── vitest.config.ts
├── docs/
│   ├── api/README.md
│   ├── confidence/README.md
│   ├── domain/product-foundation.md
│   ├── equipment/README.md
│   ├── eta-simulator/README.md
│   ├── hos/
│   ├── implementation/
│   │   ├── ARCHITECTURE_MAP.md
│   │   ├── BLOCKERS.md
│   │   ├── DECISIONS.md
│   │   ├── GAP_MATRIX.md
│   │   ├── RISK_REGISTER.md
│   │   ├── STAGE_PLAN.md
│   │   ├── STATUS.md
│   │   ├── decisions/
│   │   ├── evidence/
│   │   └── handoffs/
│   ├── operations/README.md
│   ├── persistence/README.md
│   ├── regulatory/
│   ├── routing/README.md
│   ├── specification/
│   └── stops/README.md
└── packages/
    ├── api/
    │   ├── src/
    │   └── test/
    ├── compliance/
    │   ├── src/
    │   └── test/
    ├── foundation/
    │   ├── src/
    │   └── test/
    ├── persistence/
    │   ├── prisma/
    │   ├── src/
    │   └── test/
    └── routing/
        ├── src/
        └── test/
```

The Prisma-generated client is created under `packages/persistence/src/generated/` during checks and builds and is intentionally ignored by Git.

## Package responsibilities

### `@trip-route-calc/foundation`

Owns provider-neutral product and calculation contracts:

- terminology, release scope, explicit units, UTC instants, IANA time zones, and DST-safe local-time resolution;
- driver HOS inputs, duty events, standard clocks, rolling cycles, sleeper and adverse-condition evaluation, and carrier policy;
- equipment, load, dimension, axle, KPRA, and physical-consistency validation;
- ordered stops, appointments, facility hours, service behavior, and stop processing;
- commercial-route request and normalized route evidence contracts;
- regulatory sources, rules, findings, required actions, and compliance results;
- operational events and deterministic fuel planning;
- deterministic ETA projections, confidence, evidence references, and explanations.

Foundation calculations are pure and do not depend on HTTP, provider adapters, or persistence.

### `@trip-route-calc/routing`

Owns the external commercial-routing boundary:

- provider capability and licensing contracts;
- server-only credential wrappers and redaction;
- commercial-route execution, timeout, bounded retry, and provider error mapping;
- explicit blocked runtime when no licensed provider is selected;
- strict separation between commercial routes and consumer comparisons.

B-002 remains open. Test providers are acceptance fixtures only and are not production evidence.

### `@trip-route-calc/compliance`

Owns pure regulatory and KPRA evaluation:

- versioned rule evaluation against normalized route and equipment evidence;
- structured findings, blockers, required actions, and references;
- California KPRA adjustment and complete post-adjustment revalidation;
- no embedded unsourced production threshold fallback.

B-003 remains open. Production legal conclusions require reviewed authoritative data.

### `@trip-route-calc/persistence`

Owns PostgreSQL and Prisma persistence:

- tenant membership and carrier-scoped object access;
- immutable trips, revisions, stops, HOS inputs, equipment, route evidence, compliance evidence, operational plans, ETA inputs, ETA results, confidence, explanations, audit, and export history;
- regulatory source and rule lifecycle, review, supersession, and change history;
- additive Stage 17 idempotency records storing hashed keys, request hashes, response snapshots, and expiry;
- compare-and-swap revision creation and tenant-safe not-found behavior.

Persistence validates ownership and data integrity independently of API authentication.

### `@trip-route-calc/api`

Owns the Stage 17 HTTP boundary:

- Fastify 5 server construction;
- strict Zod validation for headers, parameters, queries, bodies, authentication claims, and public identifiers;
- signed bearer authentication carrying carrier and actor context;
- typed deterministic authenticated encryption for public resource identifiers;
- fixed-window per-principal rate limiting;
- persistent write idempotency and expected-revision conflicts;
- trip, stop, revision, calculation, timeline, compliance, driver, equipment, load, route-validation, and regulatory-version endpoints;
- deterministic OpenAPI 3.1 output at `/openapi.json`;
- structured authentication, validation, conflict, legal-blocking, manual-verification, provider, rate-limit, and internal errors.

API handlers authenticate, parse, delegate, and serialize. They do not recalculate HOS, routing, compliance, stops, ETA, confidence, or explanations.

## Verified cross-package flow

```text
HTTP request
  -> API authentication and Zod validation
  -> typed public-ID decoding
  -> application service
  -> tenant-scoped persistence and accepted domain services
  -> routing/compliance/ETA evaluation where requested
  -> immutable persistence snapshot
  -> public-ID encoding and structured HTTP response
```

Write retries pass through persistent idempotency. Trip and stop mutations require an expected revision and create a new immutable revision. Cross-carrier object access is rejected by persistence even when authentication succeeds.

## Validation and build boundary

The permanent repository gate uses Node.js 22, pnpm 9.15.4, PostgreSQL 18, Prisma generation and validation, ESLint, strict TypeScript, Vitest unit and integration suites, and the production TypeScript build.

Stage 17 acceptance coverage includes:

- public OpenAPI and authenticated API enforcement;
- public-ID opacity, tamper rejection, and entity-type isolation;
- tenant isolation and membership checks;
- persistent idempotent replay and mismatch conflicts;
- immutable trip and stop revisions, stale writes, and locked reorder protection;
- invalid and ambiguous measurement rejection;
- provider setup failure without consumer fallback;
- successful calculation persistence and retrieval;
- structured prohibited-route blocking.

## Boundaries not yet created

- mobile trip-setup UI;
- results and timeline UI;
- map UI;
- PDF and other export renderers;
- complete login, session, identity-provider, token rotation, and revocation lifecycle;
- production commercial-routing adapter and credentials;
- reviewed production regulatory corpus;
- distributed rate-limit storage;
- production hosting, secret management, backup automation, recovery objectives, and deployment configuration.

Unsupported personal conveyance, yard move, exemptions, emergency rules, team-driver behavior, and pilot programs remain manual or blocking boundaries rather than automatic fallbacks.

## Next architectural source

After Stage 17 merge and ledger closure, the next source is `docs/specification/18_MOBILE_TRIP_SETUP_UI.md`. The UI must consume `@trip-route-calc/api` and must not duplicate unit, time, HOS, equipment, stop, route, compliance, ETA, confidence, tenant, revision, or audit logic.