# 05. HOS Core Clocks and 30-Minute Interruption

> Use this source as the active assignment for one dedicated implementation chat.  
> Read `00_SHARED_GUARDRAILS.md`, the repository implementation ledger, and every prerequisite source listed below before changing code.  
> Inspect the real repository first. Existing code is authoritative over guessed names, paths, schemas, packages, or architecture.

## Prerequisites

- Sources 01 through 04 completed
- Timestamped duty-event model verified

## Goal

Build the pure, independently testable standard federal property-carrying HOS core for a solo driver: qualifying 10-hour reset, 11-hour driving limit, 14-consecutive-hour window, and 30-minute interruption after eight cumulative driving hours.

## Required work

1. Implement pure functions or an isolated domain service that consumes a validated HOS state and ordered duty events.
2. Apply minute-level arithmetic for drive, shift, and cycle effects.
3. Stop legal driving immediately when the 11-hour allowance, 14-hour window, or current cycle availability reaches zero.
4. Track cumulative driving since the last qualifying interruption.
5. Evaluate consecutive non-driving periods of at least 30 minutes according to the configured standard rule set.
6. Correctly model:
   - driving
   - on-duty-not-driving
   - off-duty
   - sleeper berth
7. Implement standard 10-consecutive-hour off-duty reset behavior.
8. Return structured transition results, violations, next required legal action, and plain calculation reasons.
9. Keep the engine independent of UI, controllers, ORM records, and map providers.
10. Add tests for boundaries one minute before, exactly at, and one minute after every limit.

## Required scenarios in this stage

- Fresh 11/14 clocks
- More drive time than shift time
- Eight cumulative driving hours requiring interruption
- Qualifying 45-minute non-driving stop
- Non-qualifying 20-minute stop
- Fuel as on-duty-not-driving
- Stop waiting not automatically pausing the 14-hour window
- Required 10-hour break before continued driving
- Zero current cycle availability blocks departure even before advanced recap logic is added

## Hard boundaries

- Do not automatically apply adverse-driving conditions.
- Do not automatically apply personal conveyance.
- Do not assume split sleeper.
- Do not insert a 34-hour restart when a 10-hour break is sufficient.
- Do not let route or UI code reproduce clock arithmetic.

## Exit gate

Given a sequence of duty events, the engine deterministically returns legal clock state, required interruption/rest, and violations with minute precision.

## Relevant master requirements

## 6. Hours of Service Calculation Engine

Create a dedicated, pure, independently testable HOS engine.

Do not mix HOS arithmetic into UI components, map components, or API controllers.

The standard property-carrying rules engine must support:

* 10 consecutive hours off duty before starting a new standard duty period
* Maximum of 11 hours of driving
* No driving after the end of the 14-consecutive-hour driving window
* Required 30-minute interruption after eight cumulative hours of driving without a qualifying interruption
* 60-hour/7-day cycle
* 70-hour/8-day cycle
* 34-consecutive-hour restart
* Daily cycle recaps
* Qualifying split-sleeper calculations
* Explicitly enabled adverse-driving-condition calculations
* Carrier policies that are stricter than federal maximums

The engine must model time as timestamped duty-status events, not merely totals.

Supported event statuses:

* OFF_DUTY
* SLEEPER_BERTH
* DRIVING
* ON_DUTY_NOT_DRIVING

Every route event must have:

* Start timestamp
* End timestamp
* Duration
* Duty status
* Event type
* Location
* Source
* Explanation
* Effect on driving clock
* Effect on 14-hour clock
* Effect on cycle clock
* Whether it qualifies toward the 30-minute interruption
* Whether it participates in a sleeper-berth pairing

Use minute-level precision internally.

Do not use floating-point decimal hours for authoritative calculations. Use integer minutes or seconds.

### HOS event behavior

Driving time:

* Reduces the available driving clock
* Advances the 14-hour window
* Consumes cycle time
* Adds to time driven since the last qualifying interruption

On-duty not driving:

* Does not consume the 11-hour driving allowance
* Advances the 14-hour window
* Consumes cycle time
* May satisfy the 30-minute interruption when it is at least 30 consecutive minutes under the configured rule set

Off-duty time:

* Normally advances the 14-hour window unless it is part of a qualifying rule that excludes it
* Does not consume cycle time
* May satisfy the 30-minute interruption
* May contribute to a qualifying 10-hour break, sleeper split, or restart

Sleeper-berth time:

* Must be evaluated according to the selected HOS rule set
* May participate in a qualifying split
* Must not be treated as a valid split without checking both paired periods

### Critical HOS behavior

The planner must stop adding driving time immediately when any applicable clock reaches zero.

It must then insert the earliest legally sufficient break or rest period.

The engine must never:

* Continue driving past the available 11-hour clock
* Continue driving past the available 14-hour window
* Continue driving with no cycle time
* Assume loading or unloading pauses the 14-hour clock
* Treat a fuel stop as off duty by default
* Treat all facility time as off duty
* Automatically claim adverse driving conditions
* Automatically invoke personal conveyance
* Automatically assume a sleeper split is available
* assume a 34-hour restart when a normal 10-hour break is sufficient

### HOS tests

1. Fresh 11/14/70 clocks with a one-day trip.
2. Driver has more driving time than shift time.
3. Driver has more shift time than cycle time.
4. Driver reaches eight cumulative driving hours and requires a 30-minute interruption.
5. A 45-minute shipper stop satisfies the interruption.
6. A 20-minute stop does not satisfy the interruption.
7. Fuel stop consumes on-duty time.
8. Driver requires a 10-hour break before final delivery.
9. Driver receives cycle recap hours at midnight or the correct recap boundary.
10. Driver uses a valid 7/3 sleeper split.
11. Invalid sleeper periods do not create a split.
12. A 34-hour restart resets the applicable cycle.
13. Adverse-driving exception remains disabled unless explicitly selected.
14. Stop waiting time does not automatically pause the 14-hour clock.
15. Driver cannot depart when cycle time is zero.

## Required completion report

Before ending the chat, provide:

1. What you inspected before coding.
2. What you implemented.
3. Every file created, changed, moved, or deleted.
4. Database migrations or data changes, if any.
5. Commands actually run.
6. Test, lint, type-check, migration, and build results.
7. Remaining blockers, missing credentials, unverified legal data, or known limitations.
8. The exact next source file that should be used in the next dedicated chat.

Do not report success for checks that were not actually run. Update the repository's implementation ledger and create a concise handoff note for this stage.
