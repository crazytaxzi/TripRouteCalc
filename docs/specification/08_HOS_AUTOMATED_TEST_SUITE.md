# 08. HOS Automated Test Suite and Engine Hardening

> Use this source as the active assignment for one dedicated implementation chat.  
> Read `00_SHARED_GUARDRAILS.md`, the repository implementation ledger, and every prerequisite source listed below before changing code.  
> Inspect the real repository first. Existing code is authoritative over guessed names, paths, schemas, packages, or architecture.

## Prerequisites

- Sources 04 through 07 implemented
- Baseline HOS tests available

## Goal

Build comprehensive, readable, deterministic automated coverage for the HOS engine and remove defects uncovered by that coverage. This chat is about proving behavior, not adding unrelated features.

## Required work

1. Implement every HOS scenario in the master specification.
2. Add exact-boundary tests at one minute before, exactly at, and one minute after legal limits.
3. Add property-style or table-driven tests for event sequences where the repository supports them.
4. Test duty-event ordering, overlap rejection, invalid data, and deterministic replay.
5. Test UTC persistence and local-time display boundaries without allowing display conversions to alter legal arithmetic.
6. Test cycle history windows, recap boundaries, and restart qualification.
7. Test valid/invalid sleeper pairings.
8. Test carrier limits stricter than federal limits.
9. Test that disabled exceptions remain disabled.
10. Verify pure engine tests require no database, browser, route provider, or network.
11. Add integration tests for persistence-to-domain mapping.
12. Document test fixtures and their legal assumptions.

## Exit gate

All HOS tests pass repeatedly, the engine has no production dependency on mocks or providers, and failures clearly identify the event and clock transition involved.

## Required master scenarios

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

## Supporting requirements

## 5. Driver HOS Inputs

Create a driver availability form containing:

* Driver name or identifier
* Departure date and time
* Departure time zone
* Current duty status
* Time current duty status began
* Driving hours remaining
* 14-hour shift time remaining
* Cycle hours remaining
* Cycle type:

  * 70 hours in 8 days
  * 60 hours in 7 days
* Time driven since the last qualifying 30-minute interruption
* Time already on duty during the current shift
* Time off duty immediately before departure
* Whether the driver has completed a qualifying 10-hour break
* Previous seven or eight days of on-duty totals
* Expected hours returning through cycle recaps
* Sleeper berth eligibility
* Existing qualifying sleeper-berth periods
* Whether split sleeper is enabled for this plan
* Whether a 34-hour restart is planned
* Carrier-specific maximum daily driving target
* Carrier-specific maximum duty target
* Optional driver preference for nightly rest start and end times

The three primary departure inputs must be treated as independent constraints:

* Driving hours remaining
* Shift hours remaining
* Cycle hours remaining

Do not infer one from another.

For example, a driver may have:

* 9 hours 30 minutes of driving available
* 6 hours 45 minutes remaining on the 14-hour clock
* 22 hours remaining on the 70-hour cycle

In this situation, the immediate legal driving period is constrained by the 6 hours 45 minutes remaining on the 14-hour clock, minus any on-duty tasks that occur before or during the drive.

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
