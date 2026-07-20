# Product Foundation Contracts

Stage 02 establishes the shared product language and the low-level contracts that later HOS, routing, compliance, ETA, persistence, API, and UI work must import rather than recreate.

## Stable package

The workspace package is `@trip-route-calc/foundation`.

Supported entry points:

- `@trip-route-calc/foundation`
- `@trip-route-calc/foundation/domain`
- `@trip-route-calc/foundation/scope`
- `@trip-route-calc/foundation/time`
- `@trip-route-calc/foundation/units`

The package contains no route-provider adapter, HOS engine, regulatory rule implementation, database model, API controller, or UI behavior.

## Authoritative versus display-only values

| Concern | Authoritative representation | Display-only representation |
| --- | --- | --- |
| Distance | `{ value, unit: "meter" }` | Miles or kilometers produced by conversion helpers |
| Duration | `{ value, unit: "minute" }` using a non-negative safe integer | Hours-and-minutes labels or decimal display values |
| Weight | `{ value, unit: "pound" }` | Kilograms produced by conversion helpers |
| Length | `{ value, unit: "inch" }` | Feet, meters, or centimeters produced by conversion helpers |
| Speed | `{ value, unit: "meter-per-second" }` | Miles per hour or kilometers per hour produced by conversion helpers |
| Instant | Canonical UTC ISO 8601 string ending in `Z` | Local date, local time, and zone abbreviation |
| Location time zone | Valid IANA identifier | Abbreviation such as PDT or CST |
| Appointment | Local date-time plus the location IANA zone and an explicit repeated-time choice when required | User-facing local appointment text |

Bare numeric measurements are rejected at runtime. A value such as `40` is not accepted without its measurement meaning.

## Time policy

- UTC instants are authoritative.
- Every location time zone is an IANA identifier.
- Local appointment inputs use `YYYY-MM-DDTHH:mm` and remain attached to the location time zone.
- Missing spring-transition times are rejected.
- Repeated fall-transition times require an explicit `earlier` or `later` choice.
- Appointment windows are validated after conversion to UTC and must move forward in time.
- The Temporal polyfill supplies IANA and DST-safe resolution. No longitude-based offset inference is permitted.

## Product terminology

The `PRODUCT_TERMINOLOGY` contract defines arrival, check-in, service completion, departure, driving clock, shift clock, cycle clock, on-duty not driving, stop, and KPRA. Arrival, service completion, and departure are intentionally distinct events.

KPRA is a `Length`. A printed trailer rail marker is not treated as verified KPRA unless a later equipment module supplies a verified mapping and source.

## First-release operating boundary

The accepted first-release scope is:

- United States property-carrying operations
- Interstate routes
- One solo driver
- Standard federal property-carrying HOS rules
- Tractor-semitrailer combinations
- Dry van, refrigerated, flatbed, and similar general freight equipment
- Single-stop and multi-stop loads

Team drivers, intrastate rules, Canada or Mexico, Alaska-specific rules, oilfield rules, agricultural exemptions, short-haul modes, hazmat-specific restrictions, oversize or overweight permits, doubles or triples, personal conveyance, yard move, ELD import, emergency declarations, pilot programs, and adverse-driving exceptions are not automatically applied. They require later explicit support, documented selection, sufficient evidence, and manual verification where applicable.

## Domain boundary

Stage 02 defines provider-neutral contracts for the minimum domain entities named in the master specification. These contracts establish shared vocabulary and relationships without selecting persistence schemas or external provider payloads.

Route objects carry an explicit verification status. `unverified` is the safe default. A later commercial-routing stage may set `commercial-route-provider-verified` only with source and timestamp evidence. The foundation package never claims that a route is legal.
