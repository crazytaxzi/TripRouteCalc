# Initial Repository Architecture Map

## Verified current tree

```text
TripRouteCalc/
├── .gitignore
├── README.md
└── docs/
    ├── specification/
    │   ├── 00_*.md
    │   ├── 01_*.md through 24_*.md
    │   ├── 99_ORIGINAL_MASTER_SPEC.md
    │   └── MANIFEST.txt
    └── implementation/
        ├── ARCHITECTURE_MAP.md
        ├── BASELINE_EVIDENCE.md
        ├── BLOCKERS.md
        ├── DECISIONS.md
        ├── GAP_MATRIX.md
        ├── RISK_REGISTER.md
        ├── STAGE_PLAN.md
        ├── STATUS.md
        ├── evidence/
        └── handoffs/
```

## Verified systems

There is currently no frontend, backend, workspace, database, ORM, migration system, API, authentication, styling system, mapping provider, test runner, CI workflow, deployment configuration, logging system, or environment-variable convention.

## Planned boundaries, not yet created

The source pack supports a future monorepo with distinct applications and packages for web UI, API, domain models, units and time, HOS, routing contracts, compliance rules, ETA simulation, persistence, validation, and shared test fixtures.

These names are intentionally not committed as directories during Stage 01. Stage 02 must establish real names and contracts in code rather than forcing later work to obey decorative scaffolding.
