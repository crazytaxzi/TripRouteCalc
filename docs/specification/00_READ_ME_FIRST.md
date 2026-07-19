# TripRouteCalc Source Pack

This pack breaks the original production specification into ordered, dependency-aware implementation assignments. Use **one numbered source file per dedicated chat**.

## How to use the pack

1. Add every Markdown file in this folder to the TripRouteCalc project sources.
2. Keep `99_ORIGINAL_MASTER_SPEC.md` as the controlling product specification.
3. Start with `01_REPOSITORY_AUDIT_AND_PLAN.md`.
4. Open a new chat for each numbered implementation source.
5. Tell the chat to execute only that source unless a prerequisite defect must be repaired.
6. Require every chat to update the repository implementation ledger and leave a handoff using `00_CHAT_HANDOFF_TEMPLATE.md`.
7. Do not skip forward merely because a later feature looks prettier. The dependency chain matters.

## Authority order

When instructions appear to conflict, use this order:

1. Current user instruction in the active chat
2. `99_ORIGINAL_MASTER_SPEC.md`
3. `00_SHARED_GUARDRAILS.md`
4. The active numbered source file
5. Existing repository documentation
6. Existing implementation, when it does not violate the specification

## Recommended repository coordination files

The first implementation chat should create these if equivalents do not already exist:

- `docs/implementation/STATUS.md`
- `docs/implementation/DECISIONS.md`
- `docs/implementation/BLOCKERS.md`
- `docs/implementation/handoffs/`
- `docs/implementation/evidence/`

Do not create duplicates when the repository already has equivalent files.

## Source sequence

| Order | Source | Dedicated chat outcome |
|---:|---|---|
| 01 | Repository audit and plan | Verified stack, risks, gaps, dependency map, execution plan |
| 02 | Product foundation, domain, units, and time | Stable domain boundaries, terminology, units, timestamp rules |
| 03 | Persistence, revisions, and auditability | Database model, migrations, snapshots, revision history |
| 04 | Driver HOS inputs and duty-event model | Validated departure state and timestamped duty events |
| 05 | HOS core clocks and 30-minute interruption | Pure legal clock engine for 11/14 limits and interruption logic |
| 06 | HOS cycle, recaps, and restart | 60/7 and 70/8 cycle behavior, recaps, 34-hour restart |
| 07 | Sleeper split, adverse conditions, and carrier policy | Explicit advanced HOS modules without automatic exceptions |
| 08 | HOS automated test suite | Comprehensive HOS unit and integration coverage |
| 09 | Equipment, load, dimensions, and weight | Tractor/trailer/load profiles and legal-data validation |
| 10 | Stops, appointments, and service simulation | Unlimited ordered stops, windows, waiting, service, overlap rules |
| 11 | Commercial-routing provider layer | Provider-neutral route contracts and real provider integration |
| 12 | Regulatory rules engine and update workflow | Versioned, sourced, route-segment-aware jurisdiction rules |
| 13 | California KPRA and axle compliance | Correct KPRA workflow, tandem actions, axle revalidation |
| 14 | Fuel, inspections, and operational events | Realistic non-driving events and fuel planning |
| 15 | ETA simulator, speeds, and time zones | Earliest, expected, conservative event-based projections |
| 16 | Confidence, explanations, and data quality | Documented confidence model and plain-language reasoning |
| 17 | REST API and boundary validation | OpenAPI endpoints, schemas, structured calculation responses |
| 18 | Mobile trip-setup interface | Driver/equipment/load/stop workflow with accessible editing |
| 19 | Map, timeline, clocks, and results | Route visualization, chronological events, result tables |
| 20 | Authentication, privacy, security, and accessibility | Account isolation, hardening, WCAG-oriented review |
| 21 | Printing and exports | PDF, CSV, JSON, and printable trip plan |
| 22 | Integration, E2E, and acceptance scenario | Cross-engine verification and Portland-to-Sacramento scenario |
| 23 | Documentation, deployment, backup, and operations | Accurate setup, provider, regulatory, migration, and ops guides |
| 24 | Production verification and completion gate | Clean migration, full tests, build proof, final limitations |
| 99 | Original master specification | Unabridged controlling source |

## Important operating rule

A later chat may repair a defect in an earlier stage only when the defect blocks the active assignment. It must document the reason and preserve the active assignment's scope. Do not let a UI chat casually rewrite HOS arithmetic because a component wanted a friendlier data shape.
