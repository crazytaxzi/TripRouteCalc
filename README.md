# TripRouteCalc

TripRouteCalc is a planned production-grade commercial motor vehicle trip-routing, Hours of Service, compliance, and ETA planning application.

The product is intended to produce transparent, defensible planning estimates for United States property-carrying tractor-semitrailer operations. It is a planning tool, not an ELD and not a substitute for a driver, motor carrier, safety department, permit office, official authority, or law enforcement.

## Current state

The canonical private repository is established on `main`. Stages 01 through 11 are complete, verified, and merged.

- `@trip-route-calc/foundation` provides product terminology, first-release scope boundaries, explicit measurement primitives, UTC and IANA time-zone handling, DST-safe local appointment and regulatory-boundary resolution, provider-neutral domain contracts, validated driver HOS departure-state and duty-event contracts, the pure Stage 05 core clock engine, the pure Stage 06 rolling cycle engine, the pure Stage 07 advanced-rule evaluator, the Stage 09 equipment/load physical-validation domain, the Stage 10 ordered stop-processing domain, and Stage 11 commercial-routing request and normalized-result contracts.
- Stage 05 covers the standard 10-hour reset, 11-hour driving allowance, 14-hour window, cycle-availability blocking, and 30-minute interruption.
- Stage 06 derives 60-hour/7-day and 70-hour/8-day availability from timestamped history, reconciles entered facts, returns correctly timed recaps, blocks on-duty work at zero cycle, and applies only explicitly selected and fully evidenced 34-hour restarts.
- Stage 07 validates explicitly selected 7/3 and 8/2 sleeper pairs, evidence-backed adverse-driving-condition extensions, stricter carrier planning limits, rest-preference conflicts, and unsupported special-rule selections without automatically activating exceptions.
- Stage 08 adds the comprehensive HOS acceptance, boundary, replay, isolation, and persistence-mapping suite without changing verified production HOS arithmetic.
- Stage 09 adds explicit tractor, trailer, and load profiles; provenance; KPRA and physical consistency checks; structured issues; route physical input; additive profile persistence; and audited tenant-scoped CRUD without inventing legal thresholds or axle distribution.
- Stage 10 adds unlimited ordered stop configuration, appointments, facility hours, independent waiting/check-in/service behavior, parking-dependent HOS overlap, legal-departure processing, deterministic multi-stop progression, and additive immutable stop-detail persistence.
- Stage 11 adds complete CMV routing requests, provider-neutral normalized routes, legs, segments, geometry, restrictions, confidence and unavailable-field evidence, hard timeouts, bounded retries, server-only credential redaction, explicit provider failures, and separately labeled consumer comparisons that cannot become the commercial plan.
- `@trip-route-calc/routing` isolates commercial provider capabilities, licensing configuration, credentials, execution policy, provider errors, and the no-fallback runtime boundary.
- `@trip-route-calc/persistence` provides PostgreSQL and Prisma persistence, tenant-scoped repositories, immutable trip revisions, ordered stops, evidence retention, regulatory history, export history, audit records, immutable HOS input revisions, additive equipment-profile details, additive stop-processing details, and typed normalized commercial-route evidence storage.

Regulatory compliance evaluation, complete ETA simulation, API behavior, and UI behavior have not started. Live commercial-provider verification remains blocked until B-002 is resolved with a licensed provider, documented entitlement and retention terms, server-only credentials, and a real adapter.

## Workspace checks

Use Node.js 22 and pnpm 9.15.4 or later within the 9.x line.

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` generates and validates the Prisma client, then runs lint, type-check, unit and integration tests, and the production TypeScript build. Database integration tests require `DATABASE_URL` and an applied migration.

## Local PostgreSQL

```bash
cp .env.example .env
docker compose up -d postgres
pnpm db:generate
pnpm db:validate
pnpm db:migrate:deploy
pnpm check
```

PostgreSQL 18 uses the named volume mounted at `/var/lib/postgresql`.

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
- Stage 03: Persistence, Revisions, and Auditability, COMPLETE
- Stage 04: Driver HOS Inputs and Duty Events, COMPLETE
- Stage 05: HOS Core Clocks and 30-Minute Interruption, COMPLETE
- Stage 06: HOS Cycle, Recaps, and 34-Hour Restart, COMPLETE
- Stage 07: Sleeper Split, Adverse Conditions, and Carrier Policy, COMPLETE
- Stage 08: HOS Automated Acceptance Suite, COMPLETE
- Stage 09: Equipment, Load, Dimensions, and Weight, COMPLETE
- Stage 10: Stops, Appointments, Waiting, and Service Simulation, COMPLETE
- Stage 11: Commercial-Routing Provider Layer, COMPLETE; live verification blocked by B-002

See:

- `docs/implementation/STATUS.md`
- `docs/implementation/DECISIONS.md`
- `docs/implementation/BLOCKERS.md`
- `docs/implementation/handoffs/01-repository-audit-and-plan.md`
- `docs/implementation/handoffs/02-product-foundation-domain-units-time.md`
- `docs/implementation/handoffs/03-persistence-revisions-auditability.md`
- `docs/implementation/handoffs/04-driver-hos-inputs-duty-events.md`
- `docs/implementation/handoffs/05-hos-core-clocks-interruption.md`
- `docs/implementation/handoffs/06-hos-cycle-recaps-restart.md`
- `docs/implementation/handoffs/07-hos-sleeper-adverse-and-carrier-policy.md`
- `docs/implementation/handoffs/08-hos-automated-test-suite.md`
- `docs/implementation/handoffs/09-equipment-load-dimensions-weight.md`
- `docs/implementation/handoffs/10-stops-appointments-service.md`
- `docs/implementation/handoffs/11-commercial-routing-provider-layer.md`
- `docs/domain/product-foundation.md`
- `docs/stops/README.md`
- `docs/equipment/README.md`
- `docs/routing/README.md`
- `docs/hos/README.md`
- `docs/hos/test-fixtures.md`
- `docs/persistence/README.md`
- `docs/specification/12_REGULATORY_RULES_AND_UPDATE_WORKFLOW.md`

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
- Preserve prior calculations and their evidence as immutable revisions.
- Do not add fake production providers, placeholder legal data, or demo calculations.

## Next action

Begin `docs/specification/12_REGULATORY_RULES_AND_UPDATE_WORKFLOW.md` under the Prime Directive, preserving the accepted commercial-routing, evidence, equipment, stop-order, HOS, time-zone, persistence, and audit boundaries.
