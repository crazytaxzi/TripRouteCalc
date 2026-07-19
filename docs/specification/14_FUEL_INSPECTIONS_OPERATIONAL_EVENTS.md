# 14. Fuel, Inspections, and Operational Events

> Use this source as the active assignment for one dedicated implementation chat.  
> Read `00_SHARED_GUARDRAILS.md`, the repository implementation ledger, and every prerequisite source listed below before changing code.  
> Inspect the real repository first. Existing code is authoritative over guessed names, paths, schemas, packages, or architecture.

## Prerequisites

- Sources 05, 09, 10, and 11 completed
- HOS event and route-leg contracts available

## Goal

Add realistic operational events that consume time, affect duty status, interact with HOS, and can be inserted into the route timeline without pretending they are all off duty.

## Required work

1. Support pre-trip, post-trip, fuel, scale, securement, reefer, maintenance, border/agricultural inspection, parking search, meal, and shower events.
2. Give each event explicit location, duration/range, duty status, source, and clock effects.
3. Implement fuel planning using capacity, current level, MPG, route distance, reserve, and truck-compatible locations when available.
4. Respect equipment range and route availability without fabricating fuel stops.
5. Allow operational events to overlap a qualifying interruption or rest only when duration and duty status legally qualify.
6. Insert pre-trip and required inspection time before driving as on-duty unless a legally supported configuration says otherwise.
7. Add route-aware placement constraints for scales, fuel, securement checks, maintenance, and parking.
8. Add configurable planning buffers and explain them separately from legal requirements.
9. Add tests for fuel as on-duty, pre-trip consuming shift/cycle, break overlap, insufficient range, and unavailable truck-compatible locations.
10. Persist user overrides and event sources in trip revisions.

## Hard boundaries

- Do not treat fueling as off duty by default.
- Do not fabricate fuel availability.
- Do not hide operational buffers inside drive time.
- Do not merge operational event types into an unexplained generic delay.

## Exit gate

The simulator can consume structured operational events with correct HOS effects and explicit placement/explanation.

## Relevant master requirements

## 12. Fuel, Inspections, and Operational Events

Support configurable operational events:

* Pre-trip inspection
* Fuel
* Scale
* Cargo securement check
* Reefer check
* Post-trip inspection
* Maintenance
* Border or agricultural inspection
* Parking search
* Meal stop
* Shower stop

Fuel planning must use:

* Fuel capacity
* Current estimated fuel level
* Estimated MPG
* Route distance
* Required reserve
* Available truck-compatible fuel locations when integrated

Do not automatically treat fueling as off duty.

Inspection and securement events normally consume on-duty time unless the user selects a legally supported alternative.

## 7. Stop Management and Multi-Stop Loads

The user must be able to create a trip with any number of stops.

The interface must allow users to:

* Add a stop
* Remove a stop
* Duplicate a stop
* Reorder stops using drag-and-drop and accessible buttons
* Insert a stop between existing stops
* Change a stop type
* Mark a stop required or optional
* Lock a stop’s position
* Set an appointment window
* Set a fixed appointment time
* Set expected service duration
* Set minimum and maximum service duration
* Set the expected duty status during service
* Add notes and instructions
* Recalculate the trip instantly after changes

Supported stop types:

* Start location
* Tractor pickup
* Trailer pickup
* Shipper
* Intermediate pickup
* Intermediate delivery
* Final consignee
* Fuel
* Scale
* Inspection
* Maintenance
* Food
* Driver break
* Sleeper rest
* Terminal
* Border crossing
* Other

### Default service times

Use configurable defaults rather than immutable hardcoded assumptions.

Initial suggested defaults:

* Start-of-trip pre-trip inspection: 30 minutes
* Fuel stop: 30 minutes
* Scale stop: 15 minutes
* Shipper: 30 to 60 minutes
* Intermediate pickup or delivery: 30 to 60 minutes
* Final consignee: 30 to 60 minutes
* Drop-and-hook: 30 minutes
* Live load or live unload: 60 minutes unless overridden

The application must let the user select:

* Exact duration
* Expected duration
* Minimum and maximum duration range
* Historical facility average when available

Every pickup, intermediate stop, and final delivery must have its own service-time value.

Do not add one generic multi-stop delay to the entire route.

For ETA simulation:

1. Calculate arrival at the stop.
2. Apply appointment-window waiting when early.
3. Apply check-in time.
4. Apply service time.
5. Apply any required break or rest that can legally overlap the stop.
6. Calculate legal departure time.
7. Recalculate the driver’s clocks.
8. Continue to the next leg.

A stop of 30 minutes or longer may satisfy the federal 30-minute interruption only when its recorded or planned duty status qualifies.

Do not assume that stop time resets the driving or shift clock.

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
