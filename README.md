# TripRouteCalc

TripRouteCalc is a planned production-grade commercial motor vehicle trip-routing, Hours of Service, compliance, and ETA planning application.

The product is intended to produce transparent, defensible planning estimates for United States property-carrying tractor-semitrailer operations. It is a planning tool, not an ELD and not a substitute for a driver, motor carrier, safety department, permit office, official authority, or law enforcement.

## Current state

The canonical private repository is established on `main`. Stage 01 repository audit and implementation planning are complete.

The repository remains intentionally greenfield: it contains the controlling product specification, ordered implementation source pack, architecture plan, risks, decisions, blockers, baseline evidence, and completed Stage 01 handoff. Application scaffolding and production code have not started.

## Authority order

1. Current user instruction in the active project chat
2. `docs/specification/99_ORIGINAL_MASTER_SPEC.md`
3. `docs/specification/00_SHARED_GUARDRAILS.md`
4. The active numbered implementation source
5. Existing repository documentation
6. Existing implementation when it does not violate the specification

## Stage status

- Stage 01: Repository Audit and Implementation Plan, COMPLETE
- Stage 02: Product Foundation, Domain, Units, and Time, NOT STARTED

See:

- `docs/implementation/STATUS.md`
- `docs/implementation/DECISIONS.md`
- `docs/implementation/BLOCKERS.md`
- `docs/implementation/handoffs/01-repository-audit-and-plan.md`
- `docs/specification/02_PRODUCT_FOUNDATION_DOMAIN_UNITS_TIME.md`

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

Begin a dedicated Stage 02 implementation chat using `docs/specification/02_PRODUCT_FOUNDATION_DOMAIN_UNITS_TIME.md`. Reinspect the canonical repository before scaffolding the real workspace.