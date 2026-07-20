# Architectural Decision Log

## D-001: Treat the project as greenfield

**Status:** Accepted

No prior application repository or implementation was supplied. The source pack is a specification and staged execution plan, not an existing codebase. The repository therefore begins with documentation and coordination records only.

## D-002: Preserve the source pack verbatim

**Status:** Accepted

All Markdown source files are stored under `docs/specification/`. The original master specification remains controlling beneath current user instructions.

## D-003: Do not generate a cosmetic or placeholder application during Stage 01

**Status:** Accepted

Stage 01 is for audit and planning. Creating a UI shell, fake route provider, mock legal rules, or speculative data model would manufacture technical debt and violate the source guardrails.

## D-004: Use the documented greenfield architecture as the starting direction

**Status:** Accepted for staged implementation

The planned stack remains:

- TypeScript
- pnpm workspace monorepo
- React and Vite mobile-first PWA
- Fastify backend
- PostgreSQL
- Prisma
- Zod
- OpenAPI REST API
- Vitest
- Playwright
- Docker Compose

Stage 02 established the TypeScript, pnpm, Zod, and Vitest foundation. Stage 03 established PostgreSQL, Prisma, and Docker Compose. Later stages will introduce the remaining pieces only when their active source requires them.

## D-005: Keep safety-critical domains separate

**Status:** Accepted

HOS, commercial routing, regulatory compliance, ETA simulation, persistence, API, and UI must remain distinct modules with explicit contracts. UI convenience must not rewrite legal arithmetic.

## D-006: Default the initial GitHub repository to private

**Status:** Accepted

The repository remains private because it contains an unfinished safety-sensitive product specification and no verified production application.

## D-007: Use one shared foundation package

**Status:** Accepted

`@trip-route-calc/foundation` is the stable shared import boundary for product terminology, supported scope, units, time primitives, and provider-neutral domain contracts. Later packages must import these contracts rather than creating parallel measurement or time implementations.

## D-008: Use explicit canonical measurement objects

**Status:** Accepted

Authoritative measurements use unit-bearing objects:

- Distance: meters
- Duration: non-negative safe integer minutes
- Weight: pounds
- Length: inches
- Speed: meters per second

Display conversions may produce other units, but bare numeric measurements are rejected at runtime. Decimal hours are never authoritative HOS arithmetic.

## D-009: Use Temporal-backed UTC and IANA time handling

**Status:** Accepted

Authoritative instants are canonical UTC ISO 8601 strings. Location time zones are validated IANA identifiers. The Temporal polyfill resolves local appointment times, rejects spring-transition gaps, and requires an explicit earlier-or-later choice for repeated fall-transition times. Time-zone offsets are never inferred from longitude.

## D-010: Keep Stage 02 domain contracts provider-neutral and persistence-neutral

**Status:** Accepted

The foundation defines the minimum master-spec entities and their relationships without adopting external routing payloads or database schemas. Persistence mapping begins in Stage 03. Route contracts include an explicit `unverified` state and may not imply route legality without later commercial-routing and regulatory evidence.

## D-011: Pin reproducible foundation tooling

**Status:** Accepted

The repository uses Node.js 22, pnpm 9.15.4, a committed pnpm lockfile, strict TypeScript, typed ESLint rules, Vitest, and GitHub Actions. CI installs with `--frozen-lockfile` and runs lint, type-check, tests, and build as separate visible gates.

## D-012: Use PostgreSQL 18 and Prisma 7 for durable persistence

**Status:** Accepted

`@trip-route-calc/persistence` owns the database schema, generated Prisma client, migrations, tenant-scoped repositories, and persistence integration tests. PostgreSQL-specific constraints and triggers are permitted when they enforce safety or audit behavior that Prisma cannot express.

## D-013: Use the carrier as the tenant boundary

**Status:** Accepted

Carrier-owned records include `carrierId`. Repository operations require a carrier and acting user, verify carrier membership, and scope object queries by carrier. API authentication and request authorization arrive later, but unscoped persistence access is not an accepted application boundary.

## D-014: Preserve calculations as append-only trip revisions

**Status:** Accepted

A trip points to its latest committed revision, but prior revisions and their evidence remain queryable. Revision creation is transactional and stores calculation inputs, timestamps, rule and provider versions, results, warnings, acknowledgements, overrides, actor identity, and a canonical SHA-256 content hash. PostgreSQL triggers reject mutation or deletion of revisions and revision-owned evidence.

## D-015: Store authoritative measurements in explicit value and unit columns

**Status:** Accepted

Relational records use separate value and unit columns that map to the Stage 02 canonical units. Database check constraints enforce non-negative ranges, integer-minute durations, explicit ordering, and canonical unit labels. Serialized JSON remains supporting evidence rather than a replacement for queryable authoritative columns.

## D-016: Retain route-provider evidence according to license capability

**Status:** Accepted

Provider credentials and secrets are never stored with trip records. Evidence uses one of three modes: licensed raw JSON, normalized provider-neutral snapshots, or provider references. Repository guards and database constraints reject contradictory retention combinations.

## D-017: Version regulatory records and preserve administrative changes

**Status:** Accepted

Regulatory rule sets and jurisdiction rules are versioned, effective-dated, source-attributed, last-verified, and activatable or deactivatable. Administrative changes create immutable change-history and audit records. Stage 03 supplies persistence structure only and does not populate production legal rules.

## D-018: Record export history without storing generated documents

**Status:** Accepted

Export history stores revision, actor, timestamp, format, content hash, and metadata. Generated document bodies remain outside the database unless a later retention decision explicitly requires otherwise.

## D-019: Keep departure clocks and carrier targets independent

**Status:** Accepted

Driving time remaining, shift time remaining, and cycle time remaining are separate entered facts. No value is inferred from another. Carrier driving and duty targets are additional planning constraints and may be stricter than the entered legal clocks without making the departure state contradictory. Later engines must apply the most restrictive applicable constraint explicitly.

## D-020: Model Stage 04 as validated facts, not legal scheduling conclusions

**Status:** Accepted

Stage 04 records current duty status, clock values, prior-day totals, recap returns, sleeper evidence, restart intent, rest preferences, and timestamped duty events. It validates contradictions, ordering, duration, provenance, and explicit clock-effect metadata, but does not calculate legal continuation time, insert rest, validate a sleeper pairing, or activate an exception. Those conclusions belong to later pure HOS stages.

## D-021: Preserve HOS inputs and event history as append-only evidence revisions

**Status:** Accepted

A complete HOS departure state and its ordered duty-event history are written together in one transaction. The records are carrier-scoped, actor-attributed, driver-owned, canonical-hashed, and protected by PostgreSQL append-only triggers. Loading a revision revalidates the domain payload and verifies its hash before returning it.

## D-022: Distinguish data origin from verification

**Status:** Accepted

User-entered, provider-derived, and calculated values each carry a separate verification state, source, and explanation. Provider-derived does not automatically mean verified. Missing verification must remain visible to later engines and user interfaces.

## D-023: Keep the Stage 05 HOS core pure and transition-oriented

**Status:** Accepted

`calculateHosCore` consumes only validated Stage 04 facts and a complete ordered event sequence. It performs deterministic integer-minute arithmetic and returns immutable clock snapshots, per-event transitions, violations, milestones, blocking reasons, next actions, and explanations. It has no UI, ORM, database, map, route-provider, ETA, or network dependency. Later HOS modules must extend or compose this boundary rather than duplicate its arithmetic.

## D-024: Derive the standard 30-minute interruption from consecutive non-driving statuses

**Status:** Accepted

For the standard federal property-carrying rule, any consecutive combination of off-duty, sleeper-berth, and on-duty-not-driving time may satisfy the 30-minute interruption. The engine therefore evaluates the ordered duty-status sequence directly rather than trusting a single event's candidate-qualification flag. The candidate flag remains recorded evidence, while the Stage 05 legal conclusion is derived transparently from status and time.

## D-025: A 10-hour reset restores daily clocks but not cycle availability

**Status:** Accepted

Ten consecutive hours composed of off-duty and sleeper-berth time restore the standard 11-hour driving allowance and create a fresh 14-hour window when work resumes. The reset does not restore cycle availability. Cycle recaps and explicitly selected 34-hour restarts remain the responsibility of Stage 06.

## D-026: Keep rolling cycle arithmetic in a separate pure module

**Status:** Accepted

`calculateHosCycle` owns rolling 60-hour/7-day and 70-hour/8-day arithmetic, recap timing, and explicitly selected 34-hour restart effects. It does not duplicate Stage 05 driving, shift-window, interruption, or 10-hour-reset arithmetic. Callers must compose the Stage 05 and Stage 06 results and obey the most restrictive applicable constraint.

## D-027: Derive cycle availability from timestamped evidence while preserving entered facts

**Status:** Accepted

Timestamped driving and on-duty-not-driving events are the calculation basis for rolling cycle consumption and recap returns. Entered cycle time remaining, prior-day totals, and entered recap predictions remain immutable evidence. The engine reports reconciliation status and discrepancies instead of silently rewriting the input record.

## D-028: Require an explicit carrier-designated regulatory-day boundary

**Status:** Accepted

Cycle days use a caller-supplied home-terminal IANA time zone and carrier-designated local 24-hour boundary. Repeated local times require an explicit earlier-or-later choice, and nonexistent local times require an explicit previous-valid or next-valid resolution. Event-location time zones do not redefine the carrier cycle boundary.

## D-029: Never assume a 34-hour restart

**Status:** Accepted

A historical restart affects cycle history only when the caller explicitly selects a fully evidenced interval containing at least 2,040 consecutive off-duty or sleeper-berth minutes. A future restart affects the timeline only when restart intent is recorded and the supplied duty-event sequence actually completes the qualifying period. Consecutive qualifying rest already underway before departure may continue across the departure boundary.

## D-030: Keep advanced HOS rules in a pure composition layer

**Status:** Accepted

`calculateHosAdvancedRules` consumes validated Stage 04 evidence and a matching Stage 05 result. It validates and explains advanced-rule effects without duplicating the standard daily-clock or rolling-cycle engines. Stage 05 remains authoritative for its standard transitions, Stage 06 remains authoritative for cycle history, and callers must compose all applicable results.

## D-031: Require an explicit, fully qualified sleeper pair

**Status:** Accepted

A sleeper pair alters clocks only when the caller selects a specific pair identifier and both periods are present, ordered, non-overlapping, role-distinct, long enough, and clock-feasible. The long period must include at least seven consecutive sleeper-berth hours. The short period may be off duty or sleeper berth and must last at least two consecutive hours. The pair must total at least ten hours.

An explicitly selected valid pair may be used even when a ten-consecutive-hour period could independently reset the standard clocks. This preserves the driver or carrier's documented choice under FMCSA guidance issued July 1, 2026 instead of silently forcing one interpretation.

## D-032: Treat adverse conditions as evidence-backed selection, not a weather flag

**Status:** Accepted

An adverse-driving-condition extension requires explicit selection, source and explanation, sufficient evidence confidence, a normally completable run, and documented facts showing the condition was not reasonably knowable before the relevant duty period or dispatch. The extension may add no more than 120 minutes to the federal driving limit and driving window. It never restores cycle time or waives the 30-minute interruption.

## D-033: Keep carrier policy and unsupported rules visibly separate from federal legality

**Status:** Accepted

Carrier driving and duty caps are stricter planning constraints and are reported independently from federal maxima. Nightly-rest preferences are planning-policy conflicts, not federal violations. Personal conveyance, yard move, short haul, the 16-hour exception, agriculture, emergency declarations, emergency exceptions, team operation, and pilot programs remain unsupported/manual and cannot alter clocks automatically.

## D-034: Treat the Stage 08 suite as acceptance evidence, not a second implementation

**Status:** Accepted

The Stage 08 master scenarios, exact-boundary tables, deterministic replay, pure-engine isolation checks, and persistence mapping tests exercise the accepted Stage 04 through Stage 07 contracts. Tests may expose a production defect, but they may not redefine verified legal behavior merely to obtain a passing result. Reusable fixtures remain test-only evidence builders and cannot become production defaults or provider fallbacks.
## D-023: Equipment profiles separate physical evidence from legal evaluation

Stage 09 stores reusable, provider-neutral tractor, trailer, and load profiles in the shared foundation package. Every numeric value carries an explicit canonical unit, and safety-relevant fields may carry measured, manufacturer-rated, carrier-configured, or user-estimated provenance. Validation distinguishes impossible data, required human action, and missing-data confidence reasons. A verified KPRA rail mapping requires a physical measurement source and timestamp; a printed rail marker is never treated as a measurement. Equipment route input always reports legality as not evaluated.

The Prisma schema now uses supported multi-file organization. Existing identity tables remain the trip-revision reference boundary, while additive detail tables extend them without rewriting prior migrations. Tenant-scoped CRUD writes identity and details transactionally and records audit events.
