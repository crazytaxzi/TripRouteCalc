# TripRouteCalc

TripRouteCalc is a planned production-grade commercial motor vehicle trip-routing, Hours of Service, compliance, and ETA planning application.

The product is intended to produce transparent, defensible planning estimates for United States property-carrying tractor-semitrailer operations. It is a planning tool, not an ELD and not a substitute for a driver, motor carrier, safety department, permit office, official authority, or law enforcement.

## Current state

The canonical private repository is established on `main`. Stages 01 through 06 are complete, verified, and merged. Stage 07 is under active implementation and verification in pull request `#10`.

- `@trip-route-calc/foundation` provides product terminology, first-release scope boundaries, explicit measurement primitives, UTC and IANA time-zone handling, DST-safe local appointment and regulatory-boundary resolution, provider-neutral domain contracts, validated driver HOS departure-state and duty-event contracts, the pure Stage 05 core clock engine, and the pure Stage 06 rolling cycle engine.
- Stage 05 covers the standard 10-hour reset, 11-hour driving allowance, 14-hour window, cycle-availability blocking, and 30-minute interruption.
- Stage 06 derives 60-hour/7-day and 70-hour/8-day availability from timestamped history, reconciles entered facts, returns correctly timed recaps, blocks on-duty work at zero cycle, and applies only explicitly selected and fully evidenced 34-hour restarts.
- Stage 07 is adding explicit split-sleeper evaluation, adverse-driving-condition selection, stricter carrier planning limits, and unsupported-rule warnings without automatically activating exceptions.
- `@trip-route-calc/persistence` provides PostgreSQL and Prisma persistence, tenant-scoped repositories, ordered stops, immutable trip revisions, evidence retention, regulatory history, export history, audit records, and immutable HOS input revisions.

Commercial routing, compliance evaluation, ETA simulation, API behavior, and UI behavior have not started.

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
- Stage 07: Sleeper Split, Adverse Conditions, and Carrier Policy, IN PROGRESS

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
- `docs/domain/product-foundation.md`
- `docs/hos/README.md`
- `docs/persistence/README.md`
- `docs/specification/07_HOS_SLEEPER_ADVERSE_AND_CARRIER_POLICY.md`

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

Complete and verify Stage 07 using `docs/specification/07_HOS_SLEEPER_ADVERSE_AND_CARRIER_POLICY.md`. After acceptance, proceed to `docs/specification/08_HOS_AUTOMATED_TEST_SUITE.md`.
