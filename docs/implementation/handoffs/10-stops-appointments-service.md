# Stage 10 Handoff: Stops, Appointments, and Service

- Source: `docs/specification/10_STOPS_APPOINTMENTS_AND_SERVICE.md`
- Date: 2026-07-20
- Implementation branch: `agent/stage-10-stops-appointments-service`
- Completion status: IMPLEMENTATION COMPLETE, VERIFICATION PENDING

## Protected governance

Stage 10 is executed under `PRIME_DIRECTIVE.md`. The local environment cannot clone the private repository or run its complete dependency graph, so `ERROR_RECOVERY_PROTOCOL.md` requires an isolated branch, bounded connector-backed reconstruction, explicit evidence, and GitHub Actions as the authoritative full-repository gate. No unavailable local check is represented as successful.

## Implemented scope

- Independent stop plans with stable identifiers, explicit sequence, required or optional status, and locked-position control.
- Resolved location and IANA time zone evidence.
- None, earliest, latest, fixed, window, and open-window appointment modes with explicit late tolerance.
- Facility hours, early-parking and overnight-parking flags, separate check-in and service durations, notes, and instructions.
- Exact, expected, range, and labeled historical-average service-duration methods.
- Configurable and overridable suggested defaults with no hidden immutable delays.
- Pure list operations for add, insert, duplicate, remove, reorder, type change, required status, and position lock.
- Distinct arrival, waiting, check-in, service-start, service-completion, HOS-hold, and departure events.
- Appointment outcomes for early, on-time, at-risk, and missed arrivals plus earliest supplied checkpoint where lateness became unavoidable.
- HOS event generation and cumulative calculation through the existing validated pure core.
- Explicit parking-dependent overlap for a required 30-minute interruption or 10-hour rest.
- Deterministic ordered multi-stop processing using timestamped duty events for every route leg.
- Additive Prisma stop-detail model and migration tied to the existing immutable revision and tenant boundaries.
- Integration coverage for immutable revision persistence, ordering, tenant isolation, and contradiction rejection.

## Preserved boundaries

- Existing Stage 02 time and unit contracts remain authoritative.
- Existing Stage 03 immutable trip revisions, audit events, and tenant ownership remain authoritative.
- Existing Stage 05 through Stage 08 HOS engines and tests are reused rather than duplicated.
- Stage 09 equipment and load validation is unchanged.
- No commercial route provider, facility API, appointment confirmation, legal route threshold, UI, or production deployment is invented.
- Cycle availability is not guessed. A known recap or explicitly selected restart remains the responsibility of the Stage 06 cycle engine.

## Verification pending

The complete GitHub Actions gate must pass before this handoff may be marked complete:

- frozen-lockfile install
- Prisma generation and validation
- clean PostgreSQL 18 migration deployment
- ESLint
- strict TypeScript type-check
- complete unit and integration tests
- production build
