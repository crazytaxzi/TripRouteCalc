# 15. ETA Simulator, Speed Model, and Time Zones

> Use this source as the active assignment for one dedicated implementation chat.  
> Read `00_SHARED_GUARDRAILS.md`, the repository implementation ledger, and every prerequisite source listed below before changing code.  
> Inspect the real repository first. Existing code is authoritative over guessed names, paths, schemas, packages, or architecture.

## Prerequisites

- Sources 05 through 14 completed
- Commercial route, stops, compliance actions, and operational events available

## Goal

Build the event-based trip simulator that produces earliest legal, expected, and conservative projections while inserting the earliest legally sufficient breaks/rest and preserving local-time correctness.

## Required work

1. Consume ordered route legs, commercial travel times, HOS state, stop models, appointments, compliance actions, fuel/inspection events, buffers, and available traffic/weather.
2. Simulate chronologically at minute precision.
3. Stop driving as soon as any applicable drive, shift, cycle, route, or compliance constraint blocks continuation.
4. Insert the earliest legally sufficient interruption, 10-hour rest, recap wait, or explicitly selected restart/sleeper action.
5. Produce three projections:
   - earliest legal
   - expected
   - conservative
6. Use expected/minimum/maximum stop durations correctly.
7. Implement a documented commercial speed model constrained by governed speed, legal/provider speed, road class, carrier cap, grades, urban conditions, traffic, and weather.
8. Never estimate the whole trip at governed maximum.
9. Use provider travel time where verified and clearly labeled fallback averages where detailed data is unavailable.
10. Reduce confidence when fallback speed assumptions are used.
11. Store instants in UTC and render every stop/event in its IANA local zone.
12. Correctly handle DST gaps, repeated times, and crossings during driving or rest.
13. Return complete timeline events and HOS state at every transition.
14. Add deterministic tests for time zones, DST, multiple stops, rests, break overlaps, early/late appointments, and route constraints.

## Hard boundaries

- Do not produce one unexplained timestamp.
- Do not change legal assumptions to meet an appointment.
- Do not use floating-point hours.
- Do not let display time zones alter event ordering.
- Do not continue driving through a zero clock or blocked segment.

## Exit gate

The same persisted revision always reproduces the same three projections and event timeline, with every delay and clock transition explainable.

## Relevant master requirements

## 11. ETA Simulation Engine

Create an event-based trip simulator.

The ETA engine must consume:

* Ordered route legs
* Route distance and commercial travel time
* Driver HOS state
* Stop service durations
* Appointment windows
* Time zones
* Regulatory actions
* Fuel requirements
* Required inspections
* User-configured operational buffers
* Traffic and weather data when available

The simulator must produce at least three projections:

### Earliest legal arrival

The earliest arrival achievable while complying with entered HOS and route restrictions, using minimal configured stop times.

### Expected arrival

The primary planning estimate using expected stop durations, realistic commercial speed assumptions, required breaks, and configured buffers.

### Conservative arrival

A risk-aware estimate using maximum stop-duration ranges and conservative operational assumptions.

Do not present a single timestamp as certain.

### Speed handling

Allow the user to configure:

* Governed maximum speed
* Preferred planning speed
* Maximum average trip speed
* Road-class speed assumptions
* Mountain or grade adjustment
* Urban adjustment
* Traffic adjustment
* Weather adjustment

The planning speed must never exceed:

* The tractor’s governed speed
* The legal speed supplied by the route data
* The road-specific commercial speed
* The carrier’s configured maximum

Do not estimate the entire trip at the governed maximum.

When detailed road data is unavailable, use a clearly labeled conservative average-speed model and reduce ETA confidence.

## 14. Time Zones and Daylight Saving Time

Store timestamps in UTC.

Store the IANA time zone for each stop.

Display:

* Local time at the stop
* Stop time-zone abbreviation
* Date
* Optional home-terminal time

Use a real time-zone library.

Do not calculate time zones from longitude offsets manually.

Handle daylight-saving transitions correctly, including:

* Missing local times during spring transition
* Repeated local times during fall transition
* Stops in different time zones
* Routes crossing time-zone boundaries more than once

Appointment times must remain associated with the location’s time zone.

### Time tests

1. Pacific to Mountain time.
2. Mountain to Central time.
3. Central to Eastern time.
4. Daylight-saving spring transition.
5. Daylight-saving fall transition.
6. Appointment entered in destination-local time.
7. Route crossing a time-zone boundary during a rest period.

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
