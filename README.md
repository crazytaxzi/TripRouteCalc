# TripRouteCalc

TripRouteCalc is a planned production-grade commercial motor vehicle trip-routing, Hours of Service, compliance, and ETA planning application.

The product is intended to produce transparent, defensible planning estimates for United States property-carrying tractor-semitrailer operations. It is a planning tool, not an ELD and not a substitute for a driver, motor carrier, safety department, permit office, official authority, or law enforcement.

## Current state

The canonical private repository is established on `main`. Stage 01 repository audit and implementation planning are complete, and Stage 02 establishes the first buildable TypeScript workspace and shared foundation package.

`@trip-route-calc/foundation` now provides authoritative product terminology, first-release scope boundaries, explicit measurement primitives, UTC and IANA time-zone handling, DST-safe local appointment resolution, and provider-neutral domain contracts. HOS, routing, compliance, ETA, persistence, API, and UI engines have not started.

## Workspace checks

Use Node.js 22 and pnpm 9.15.4 or later within the 9.x line.

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` runs lint, type-check, unit tests, and the production TypeScript build.

## Authority order

1. Current user instruction in the active project chat
2. `docs/specification/99_ORIGINAL_MASTER_SPEC.md`
3. `docs/specification/00_SHARED_GUARDRAILS.md`
4. The active numbered implementation source
5. Existing repository documentation
6. Existing implementation when it does not violate the specification

## Stage status

- Stage 01: Repository Audit and Implementation Plan, COMPLETE
- Stage 02: Product Foundation, Domain, Units, and Time, COMPLETE
- Stage 03: Persistence, Revisions, and Auditability, NOT STARTED

See:

- `docs/implementation/STATUS.md`
- `docs/implementation/DECISIONS.md`
- `docs/implementation/BLOCKERS.md`
- `docs/implementation/handoffs/01-repository-audit-and-plan.md`
- `docs/implementation/handoffs/02-product-foundation-domain-units-time.md`
- `docs/domain/product-foundation.md`
- `docs/specification/03_PERSISTENCE_REVISIONS_AUDITABILITY.md`

## First-release scope

- United States interstate property-carrying CMV operations
- One solo driver
- Standard federal property-carrying HOS rules
- Tractor-semitrailer combinations
- General freight equipment such as dry van, refrigerated, and flatbed
- Single-stop and multi-stop loads
- Commercial routing, route restrictions, appointments, service time, operational events, time zones, confidence, and explainable results

No exception, exemption, emergency declaration, pilot program, adverse-driving rule, or special operating rule may be applied automatically.

## Repository rules

- Never use a consumer automobile route as the legal CMV plan.
- Never claim legality when commercial-route or regulatory verification is missing.
- Never hide missing dimensions, axle information, KPRA, permits, route restrictions, time zones, or provider failures.
- Keep HOS, routing, compliance, ETA, persistence, API, and UI concerns separated.
- Use UTC for authoritative timestamps and IANA identifiers for location time zones.
- Use integer duration precision for authoritative HOS arithmetic.
- Do not add fake production providers, placeholder legal data, or demo calculations.

## Next action

Begin Stage 03 using `docs/specification/03_PERSISTENCE_REVISIONS_AUDITABILITY.md`. Reinspect the canonical repository and import the stable Stage 02 foundation contracts rather than duplicating them.
