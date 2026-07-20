# Repository Architecture Map

## Verified current tree

```text
TripRouteCalc/
├── .env.example
├── .github/workflows/ci.yml
├── .gitignore
├── README.md
├── compose.yaml
├── eslint.config.mjs
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
├── tsconfig.typecheck.json
├── vitest.config.ts
├── docs/
│   ├── domain/
│   │   └── product-foundation.md
│   ├── hos/
│   │   └── README.md
│   ├── persistence/
│   │   └── README.md
│   ├── specification/
│   │   ├── 00_*.md
│   │   ├── 01_*.md through 24_*.md
│   │   ├── 99_ORIGINAL_MASTER_SPEC.md
│   │   └── MANIFEST.txt
│   └── implementation/
│       ├── ARCHITECTURE_MAP.md
│       ├── BASELINE_EVIDENCE.md
│       ├── BLOCKERS.md
│       ├── DECISIONS.md
│       ├── GAP_MATRIX.md
│       ├── RISK_REGISTER.md
│       ├── STAGE_PLAN.md
│       ├── STATUS.md
│       ├── evidence/
│       └── handoffs/
│           ├── 01-repository-audit-and-plan.md
│           ├── 02-product-foundation-domain-units-time.md
│           ├── 03-persistence-revisions-auditability.md
│           ├── 04-driver-hos-inputs-duty-events.md
│           └── 05-hos-core-clocks-interruption.md
└── packages/
    ├── foundation/
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── src/
    │   │   ├── domain.ts
    │   │   ├── hos-core.ts
    │   │   ├── hos.ts
    │   │   ├── index.ts
    │   │   ├── scope.ts
    │   │   ├── terminology.ts
    │   │   ├── time.ts
    │   │   └── units.ts
    │   └── test/
    │       ├── domain.test.ts
    │       ├── hos-core-boundaries.test.ts
    │       ├── hos-core.test.ts
    │       ├── hos.test.ts
    │       ├── time.test.ts
    │       └── units.test.ts
    └── persistence/
        ├── package.json
        ├── prisma.config.ts
        ├── tsconfig.json
        ├── prisma/
        │   ├── schema.prisma
        │   └── migrations/
        │       ├── migration_lock.toml
        │       ├── 20260720000000_stage03_persistence/
        │       │   └── migration.sql
        │       └── 20260720050000_stage04_driver_hos_inputs/
        │           └── migration.sql
        ├── src/
        │   ├── client.ts
        │   ├── driver-hos-repository.ts
        │   ├── errors.ts
        │   ├── export-history-repository.ts
        │   ├── index.ts
        │   ├── json.ts
        │   ├── regulatory-rule-repository.ts
        │   ├── repositories.ts
        │   ├── repository-shared.ts
        │   ├── route-provider-response-repository.ts
        │   ├── tenant.ts
        │   └── trip-revision-repository.ts
        └── test/
            ├── driver-hos.integration.test.ts
            └── persistence.integration.test.ts
```

The Prisma-generated client is created under `packages/persistence/src/generated/` during checks and builds and is intentionally ignored by Git.

## Verified systems

- Node.js 22 and pnpm 9 TypeScript workspace
- Stable shared foundation package
- Validated HOS departure-state and timestamped duty-event contracts
- Pure Stage 05 standard property-carrying HOS core with immutable snapshots and transitions
- Integer-minute 10-hour reset, 11-hour driving, 14-hour window, cycle blocking, and 30-minute interruption behavior
- PostgreSQL 18 local and CI service configuration
- Prisma 7 schema, generated client, and committed migrations
- Carrier-scoped tenant repositories
- Immutable calculation and HOS evidence revisions
- Versioned regulatory persistence and change history
- Strict ESLint, TypeScript, Vitest, and GitHub Actions verification

## Current HOS boundaries

- `hos.ts` owns validated departure facts, duty-event evidence, API-shaped mapping, and serialization.
- `hos-core.ts` owns pure Stage 05 clock arithmetic and structured transition results.
- Persistence stores immutable HOS inputs and event history but does not store Stage 05 derived results yet.
- Stage 06 must compose with the core engine to add rolling cycle history, recaps, and explicitly selected restart behavior without duplicating daily-clock arithmetic.
- Stage 07 owns split sleeper, adverse conditions, and carrier policy.
- Stage 08 owns the broader automated HOS acceptance suite.

## Boundaries not yet created

There is no frontend, backend application, REST API, authentication system, complete advanced HOS engine, commercial-routing adapter, regulatory evaluation engine, ETA simulator, map UI, export renderer, or production deployment configuration.

Future packages and applications must import `@trip-route-calc/foundation` and `@trip-route-calc/persistence` rather than duplicating unit, time, domain, HOS input, HOS core, tenant, revision, or audit contracts.
