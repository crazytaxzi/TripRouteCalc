# Driver HOS Contracts and Calculation Engines

Stages 04 through 07 establish validated HOS evidence and separate pure federal property-carrying calculation services. TripRouteCalc remains a planning engine, not an ELD, and it does not claim that a complete trip or route is legal.

## Stable boundaries

The HOS input contracts are exported from:

- `@trip-route-calc/foundation`
- `@trip-route-calc/foundation/hos`

The Stage 05 core engine is exported from:

- `@trip-route-calc/foundation`
- `@trip-route-calc/foundation/hos-core`

The Stage 06 rolling cycle engine is exported from:

- `@trip-route-calc/foundation`
- `@trip-route-calc/foundation/hos-cycle`

The Stage 07 advanced-rule evaluator is exported from:

- `@trip-route-calc/foundation`
- `@trip-route-calc/foundation/hos-advanced`

Persistence functions are exported from `@trip-route-calc/persistence`.

## Departure state and duty events

A `DriverHosDepartureState` preserves the driver, departure instant and time zone, current duty status, independent driving, shift, and cycle clocks, interruption state, current-shift duty time, prior cycle history, recap expectations, sleeper eligibility and evidence, explicit split-sleeper and restart intent, carrier targets, optional rest preference, and provenance.

Every `DutyEvent` records exact UTC timestamps and integer-minute duration, duty status, event type and location, source and explanation, clock effects, interruption candidacy, sleeper-pair participation, and provenance.

History validation rejects caller-supplied events that are out of order, overlap, or contain unexplained gaps. It never silently sorts, truncates, joins, or changes events.

Sleeper-pair candidate validation permits:

- a long period of at least seven consecutive hours only in `SLEEPER_BERTH`
- a short period of at least two consecutive hours in `OFF_DUTY` or `SLEEPER_BERTH`

Candidate metadata alone never makes a pair legally effective.

## Stage 05 core calculation

`calculateHosCore` consumes one validated departure state and a complete ordered event sequence beginning at departure. It owns:

- the standard 11-hour driving allowance
- the 14-consecutive-hour driving window
- the 30-minute interruption after eight cumulative driving hours
- the standard 10-consecutive-hour reset
- immutable snapshots, transitions, violations, milestones, blocking reasons, and next actions

A 10-hour reset restores the standard driving allowance and shift window but does not restore cycle availability.

## Stage 06 rolling cycle calculation

`calculateHosCycle` consumes complete timestamped history, optional planned events, a carrier-designated home-terminal regulatory-day boundary, and optional explicitly selected restart evidence. It owns:

- rolling 60-hour/7-day and 70-hour/8-day calculations
- regulatory-day windows and DST boundary evidence
- recap timing and reconciliation
- cycle blocking and exact first-prohibited timestamps
- explicitly selected and fully evidenced 34-hour restart effects

Stage 06 does not reimplement Stage 05 daily-clock arithmetic.

## Stage 07 advanced-rule calculation

`calculateHosAdvancedRules` consumes:

- one validated departure state
- complete historical evidence when needed for existing sleeper periods
- the planned duty-event sequence
- a matching Stage 05 core result
- an optional explicitly selected sleeper-pair identifier
- an optional adverse-driving-condition selection
- optional unsupported special-rule selections

It returns immutable sleeper, adverse, carrier-policy, rest-preference, and unsupported-rule results with structured issues and explanations.

### Split sleeper

A pair affects clocks only when:

- split sleeper is enabled and the driver is recorded as eligible
- the caller explicitly selects one pair identifier
- exactly one long and one short period carry that identity
- both periods have exact supporting events or exact recorded evidence
- the periods do not overlap
- each period lasts at least two hours
- the long period lasts at least seven consecutive hours in the sleeper berth
- the combined periods total at least ten hours
- the recalculated driving and 14-hour limits remain valid around both periods

For an applied pair, the engine:

- preserves both period identities and their order
- recalculates at the end of the second period
- anchors the recalculation at the end of the first period
- excludes both qualifying periods from the 14-hour calculation
- leaves cycle availability unchanged
- explains the exact driving and shift time remaining

An explicitly selected valid pair may still be used when a ten-consecutive-hour qualifying period could independently reset the standard clocks. The Stage 05 reset remains visible in its own result; Stage 07 preserves the documented pair choice rather than silently discarding it.

### Adverse driving conditions

The adverse result is `NOT_SELECTED`, `APPLIED`, or `REJECTED`.

An extension is applied only when the selection includes:

- an identifier, encounter timestamp, condition type, description, source, and explanation
- a requested whole-minute extension no greater than 120 minutes
- a supported or verified evidence confidence
- confirmation that the run was legally completable under normal limits
- confirmation that the driver could not reasonably know of the condition before the relevant duty or qualifying-rest period
- confirmation that the carrier could not reasonably know before dispatch
- confirmation that the condition prevented safe completion within normal limits
- an encounter timestamp that matches a Stage 05 event boundary

The result may extend the federal driving limit and driving window by no more than two hours. It never restores cycle availability or waives the 30-minute interruption. Ordinary congestion, routine weather, delay, or poor planning is not automatically classified as adverse.

### Carrier policy and rest preference

Carrier maximum daily-driving and duty targets remain separate from federal maxima. The engine reports the effective lower planning limits and exact timestamps when carrier policy is exceeded.

An optional nightly-rest preference is evaluated as a planning-policy conflict. It does not rewrite federal HOS clocks or create a federal violation.

### Unsupported special rules

Personal conveyance, yard move, short haul, the 16-hour exception, agriculture, emergency declarations or exceptions, team-driver operation, and pilot programs are never automatically approximated. Selections remain visible as blocking/manual warnings and do not alter clocks.

The current 6/4 and 5/5 flexible-sleeper alternatives and split-duty alternatives are pilot-only, not standard Stage 07 rules.

## Composition boundary

Stages 05, 06, and 07 intentionally return separate immutable result objects. A later caller must compose them and obey every applicable legal or stricter carrier constraint.

- Stage 05 owns standard daily clocks and reset transitions.
- Stage 06 owns rolling cycle history, recaps, and restart effects.
- Stage 07 owns explicit advanced-rule qualification and carrier-policy outcomes.

No module may duplicate another module's authoritative arithmetic for convenience.

## Persistence

`createDriverHosRevision` writes immutable departure-state and ordered event-history evidence. `getDriverHosRevision` reloads, validates, and hash-verifies that evidence.

Stages 05 through 07 add no database table or migration. Their outputs remain derived results until a later stage defines a persisted calculation-result revision boundary.

## Deliberate boundaries

The accepted HOS modules do not:

- activate an exception, exemption, declaration, pilot program, personal conveyance, or yard move automatically
- insert route events or choose rest locations
- merge HOS results into routing or ETA
- persist calculation outputs
- call a route or complete trip legal

## Regulatory verification

Stage 07 behavior was checked on 2026-07-20 against current official FMCSA HOS guidance, the property-carrying HOS summary, and revised split-sleeper guidance issued July 1, 2026. The standard representation remains at least seven consecutive hours in the sleeper berth plus at least two consecutive hours off duty inside or outside the berth, totaling at least ten hours, with neither period counted against the 14-hour window. The adverse-driving-condition provision may extend the driving limit and driving window by up to two hours when fully qualified.

Production regulatory records remain subject to the later versioned, effective-dated, source-attributed regulatory workflow.
