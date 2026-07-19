# Dependency-Aware Stage Plan

The numbered source pack is the execution sequence. The likely implementation shape below is directional and must be adjusted to actual code created by each preceding stage.

| Stage | Primary outcome | Likely code target |
|---:|---|---|
| 01 | Canonical repo, audit, plan, ledgers | `docs/implementation/` |
| 02 | Domain, units, time foundation | shared domain packages |
| 03 | Persistence and revisions | database schema, migrations, repositories |
| 04-08 | Driver state and complete HOS engine/tests | isolated HOS domain package and tests |
| 09 | Equipment and load validation | equipment/load domain package |
| 10 | Stops and service events | trip/stop simulation package |
| 11 | Commercial routing abstraction/integration | provider-neutral routing package and adapter |
| 12-13 | Versioned regulatory rules and KPRA | compliance package and sourced data |
| 14-16 | Operational events, ETA, confidence | simulation and explanation packages |
| 17 | Validated OpenAPI REST API | backend application |
| 18-19 | Mobile-first setup and results UI | PWA frontend application |
| 20-21 | Auth, hardening, accessibility, exports | cross-cutting app modules |
| 22 | Integration and E2E acceptance proof | integration and Playwright suites |
| 23 | Deployment, backup, operations docs | infrastructure and operations documentation |
| 24 | Clean production verification | evidence and final completion gate |

The next source after Stage 01 is `02_PRODUCT_FOUNDATION_DOMAIN_UNITS_TIME.md`.
