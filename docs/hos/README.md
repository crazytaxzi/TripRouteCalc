# Driver HOS Contracts and Core Clock Engine

Stages 04 and 05 establish the validated HOS facts and the first pure legal-clock calculation service. The implementation is a planning engine, not an ELD, and it does not claim that a complete trip or route is legal.

## Stable boundaries

The HOS input contracts are exported from:

- `@trip-route-calc/foundation`
- `@trip-route-calc/foundation/hos`

The Stage 05 core engine is exported from:

- `@trip-route-calc/foundation`
- `@trip-route-calc/foundation/hos-core`

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

## Stage 05 core calculation

`calculateHosCore` consumes one validated departure state and a complete ordered event sequence beginning at the departure boundary. It returns immutable snapshots and transitions containing:

- driving, shift, and cycle minutes remaining
- cumulative driving since the last qualifying interruption
- current-shift on-duty time
- consecutive non-driving and reset-qualifying streaks
- whether the 14-hour window is active
- whether driving may legally continue under the Stage 05 core constraints
- structured blocking reasons and violations
- exact timestamps when a violation first begins
- legal and prohibited driving minutes for every driving event
- qualifying interruption and 10-hour-reset milestones
- the next required legal action and plain-language reasons

The standard Stage 05 rule set applies:

- no more than 11 driving hours after a qualifying 10-consecutive-hour off-duty period
- no driving after the end of the 14-consecutive-hour window
- no additional driving after eight cumulative driving hours without at least 30 consecutive non-driving minutes
- any combination of off-duty, sleeper-berth, and on-duty-not-driving time may satisfy the standard 30-minute interruption
- only consecutive off-duty and sleeper-berth time contributes to the 10-hour reset
- a 10-hour reset restores the 11-hour driving allowance and 14-hour window but does not restore cycle availability
- ordinary stops do not pause an active 14-hour window
- on-duty-not-driving work consumes shift and cycle time but not driving time

All authoritative arithmetic uses non-negative integer minutes and UTC instants.

## Provenance

Inputs identify their origin as:

- `USER_ENTERED`
- `PROVIDER_DERIVED`
- `CALCULATED`

Each origin also carries `UNVERIFIED` or `VERIFIED`, plus an optional source name, verification timestamp, and explanation. A provider-derived value is not considered verified merely because it came from a provider.

## Persistence

`createDriverHosRevision` writes one immutable departure-state revision and one immutable ordered event-history revision in a single transaction. Records are carrier-scoped, actor-attributed, driver-owned, and protected by canonical SHA-256 hashes and PostgreSQL append-only triggers.

`getDriverHosRevision` reloads the evidence, validates it again through the pure domain contracts, and verifies both hashes before returning it.

Stage 05 adds no database table or migration. Calculation outputs remain pure derived results until a later stage defines their revision boundary.

## Deliberate boundaries

Stage 05 does not:

- infer one entered primary clock from another
- calculate rolling 60-hour/7-day or 70-hour/8-day history
- award recap hours or choose a regulatory-day boundary
- activate or select a 34-hour restart
- validate a sleeper split
- apply adverse conditions, personal conveyance, an exception, exemption, pilot program, or emergency declaration
- enforce carrier-policy targets
- call a route or complete trip legal

Those behaviors belong to later numbered stages and must consume the recorded facts and Stage 05 transitions rather than duplicating the clock arithmetic.

## Regulatory verification

The Stage 05 standard rule behavior was checked on 2026-07-20 against current official FMCSA property-carrying HOS guidance and the federal 30-minute-break explanation. Production regulatory records remain subject to the later versioned, effective-dated, source-attributed regulatory workflow.
