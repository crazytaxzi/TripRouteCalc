# 10. Stops, Appointments, Waiting, and Service Simulation

> Use this source as the active assignment for one dedicated implementation chat.  
> Read `00_SHARED_GUARDRAILS.md`, the repository implementation ledger, and every prerequisite source listed below before changing code.  
> Inspect the real repository first. Existing code is authoritative over guessed names, paths, schemas, packages, or architecture.

## Prerequisites

- Sources 02 through 05 completed
- Persistence and HOS event contracts available

## Goal

Implement unlimited, ordered trip stops with independent appointment, waiting, check-in, service, duty-status, and departure behavior.

## Required work

1. Support add, remove, duplicate, reorder, insert, type change, required/optional, locked position, notes, and instructions.
2. Support every stop type listed in the master specification.
3. Store an explicit sequence/order value and protect it transactionally.
4. Give every stop independent:
   - resolved location
   - appointment mode and zone
   - facility hours
   - check-in duration
   - exact/expected/min/max service durations
   - planned duty status during waiting and service
   - early parking and overnight parking metadata
5. Implement configurable defaults, not immutable hardcoded delays.
6. Simulate stop processing in this order:
   - arrival
   - early appointment waiting
   - check-in
   - service
   - qualifying break/rest overlap
   - legal departure
   - clock recalculation
7. Keep arrival, service start/completion, and departure distinct.
8. Mark late or missed appointments and identify when lateness became unavoidable.
9. Do not distort HOS assumptions to make an appointment fit.
10. Add multi-stop and appointment tests, including reordering and time zones.
11. Expose pure stop-processing functions usable by the ETA simulator.

## Hard boundaries

- Do not add one generic “multi-stop delay.”
- Do not assume every 30-minute stop qualifies for the interruption.
- Do not reset drive or shift clocks merely because a stop occurred.
- Do not let drag-and-drop be the only accessible ordering method.

## Exit gate

An ordered stop list can be deterministically processed into arrival, waiting, check-in, service, and legal departure events with independent clock effects.

## Relevant master requirements

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

## 13. Appointment Windows

Each stop may have:

* No appointment
* Earliest appointment
* Latest appointment
* Fixed appointment
* Open appointment window
* Facility hours
* Appointment time zone
* Late-arrival tolerance
* Early-arrival parking allowed
* Overnight parking allowed

When the driver arrives early:

* Show arrival time
* Show waiting time
* Determine the planned duty status during waiting
* Apply any qualifying break or rest
* Calculate service start separately

When the driver arrives late:

* Mark the appointment at risk or missed
* Show how late the driver is expected to be
* Identify the earliest point in the trip where lateness became unavoidable
* Do not alter HOS assumptions to make the appointment appear achievable

### Multi-stop tests

1. Shipper, one intermediate stop, and final.
2. Five intermediate stops.
3. Stop reordered after initial calculation.
4. Stop added between two existing stops.
5. Different service duration at every stop.
6. Early appointment arrival with waiting time.
7. Late appointment.
8. Required break overlaps a qualifying stop.
9. Required 10-hour rest overlaps an overnight facility wait.
10. Stop in a different time zone.

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
