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
│           └── 03-persistence-revisions-auditability.md
└── packages/
    ├── foundation/
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── src/
    │   │   ├── domain.ts
    │   │   ├── index.ts
    │   │   ├── scope.ts
    │   │   ├── terminology.ts
    │   │   ├── time.ts
    │   │   └── units.ts
    │   └── test/
    └── persistence/
        ├── package.json
        ├── prisma.config.ts
        ├── tsconfig.json
        ├── prisma/
        │   ├── schema.prisma
        │   └── migrations/
        │       ├── migration_lock.toml
        │       └── 20260720000000_stage03_persistence/
        │           └── migration.sql
        ├── src/
        │   ├── client.ts
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
            └── persistence.integration.test.ts
```

The Prisma-generated client is created under `packages/persistence/src/generated/` during checks and builds and is intentionally ignored by Git.

## Verified systems

- Node.js 22 and pnpm 9 TypeScript workspace
- Stable shared foundation package
- PostgreSQL 18 local and CI service configuration
- Prisma 7 schema, generated client, and committed migration
- Carrier-scoped tenant repositories
- Immutable calculation revisions and evidence
- Versioned regulatory persistence and change history
- Strict ESLint, TypeScript, Vitest, and GitHub Actions verification

## Boundaries not yet created

There is no frontend, backend application, REST API, authentication system, HOS calculation engine, commercial-routing adapter, regulatory evaluation engine, ETA simulator, map UI, export renderer, or production deployment configuration.

Future packages and applications must import `@trip-route-calc/foundation` and `@trip-route-calc/persistence` rather than duplicating unit, time, domain, tenant, revision, or audit contracts.
