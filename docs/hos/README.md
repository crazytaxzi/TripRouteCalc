# Driver HOS Input and Duty-Event Contracts

Stage 04 establishes the validated facts consumed by later pure HOS engines. It does not calculate legal drive windows, insert breaks, validate a sleeper split, apply a restart, or claim that a trip is legal.

## Stable boundary

The HOS contracts are exported from:

- `@trip-route-calc/foundation`
- `@trip-route-calc/foundation/hos`

The persistence functions are exported from `@trip-route-calc/persistence`.

## Departure state

A `DriverHosDepartureState` records the complete minute-precise state at departure:

- driver identifier or name
- UTC departure timestamp and IANA departure time zone
- current duty status and the UTC timestamp when it began
- independent driving, shift, and cycle clocks
- selected 60-hour/7-day or 70-hour/8-day cycle
- driving since the last qualifying interruption
- current-shift on-duty time
- immediately preceding off-duty time and 10-hour-break claim
- the required previous seven or eight local-day on-duty totals
- ordered cycle recap returns
- sleeper eligibility and existing sleeper-period evidence
- explicit split-sleeper and 34-hour-restart intent
- carrier driving and duty targets
- optional local nightly-rest preference
- provenance for every input group

The three primary clocks remain independent. A carrier target is also a separate planning constraint and may be stricter than the entered legal clock.

## Duty events

Every `DutyEvent` records:

- UTC start and end timestamps
- exact integer-minute duration
- one supported duty status
- event type, location, and IANA time zone
- source and explanation
- explicit driving, shift-window, and cycle effects
- whether it is a candidate qualifying 30-minute interruption
- whether it is candidate evidence for a sleeper pairing
- provenance and verification state

History validation rejects caller-supplied events that are out of order, overlap, or contain an unexplained gap. It never silently sorts, truncates, joins, or changes events.

## Provenance

Inputs identify their origin as:

- `USER_ENTERED`
- `PROVIDER_DERIVED`
- `CALCULATED`

Each origin also carries `UNVERIFIED` or `VERIFIED`, plus an optional source name, verification timestamp, and explanation. A provider-derived value is not considered verified merely because it came from a provider.

## Persistence

`createDriverHosRevision` writes one immutable departure-state revision and one immutable ordered event-history revision in a single transaction. Records are carrier-scoped, actor-attributed, driver-owned, and protected by canonical SHA-256 hashes and PostgreSQL append-only triggers.

`getDriverHosRevision` reloads the evidence, validates it again through the pure domain contracts, and verifies both hashes before returning it.

## Deliberate boundaries

Stage 04 does not:

- infer any primary clock from another
- decide how long the driver may legally continue driving
- insert a 30-minute interruption or 10-hour rest
- validate both sides of a sleeper split
- activate a restart, adverse-driving condition, or personal conveyance
- treat fuel, inspection, loading, unloading, or facility time as off duty by default

Those behaviors belong to later HOS stages and must consume these recorded facts rather than replacing them.
