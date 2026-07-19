# 18. Mobile-First Trip Setup and Stop Editor

> Use this source as the active assignment for one dedicated implementation chat.  
> Read `00_SHARED_GUARDRAILS.md`, the repository implementation ledger, and every prerequisite source listed below before changing code.  
> Inspect the real repository first. Existing code is authoritative over guessed names, paths, schemas, packages, or architecture.

## Prerequisites

- Source 17 API stable
- Existing frontend design system and accessibility patterns identified
- Do not begin until calculation foundations are functional

## Goal

Build the mobile-first workflow for selecting/creating a driver, entering departure clocks, selecting equipment, entering load facts, managing unlimited stops, configuring appointments/service, and requesting recalculation.

## Required work

1. Follow the repository's established frontend, styling, form, state, query, and component conventions.
2. Implement the primary workflow in the order defined by the master specification.
3. Show drive, shift, and cycle inputs as distinct values.
4. Provide reusable driver, tractor, trailer, and load profile selection/editing.
5. Build an accessible stop editor supporting:
   - add
   - remove
   - duplicate
   - insert
   - drag reorder
   - keyboard/button reorder
   - required/optional
   - locked position
   - independent appointment and service settings
6. Validate locally for usability and rely on server validation as authority.
7. Surface missing critical legal data before calculation.
8. Recalculate when requested and support controlled immediate recalculation after changes without request storms.
9. Preserve unsaved work and handle provider/calculation errors clearly.
10. Use large touch targets, labels, focus management, screen-reader ordering, reduced motion, and non-color-only severity cues.
11. Add component and workflow tests.
12. Do not invent map/timeline behavior that belongs to Source 19.

## Hard boundaries

- No combined “availability” clock.
- No generic one-size stop delay.
- No silent defaulting of duty status.
- No UI-only legal calculations.
- No visual redesign detached from the existing product system.

## Exit gate

A user can enter a complete real-world trip plan on mobile or desktop and submit a validated calculation without editing raw JSON.

## Relevant master requirements

## 15. User Interface

Build a mobile-first interface that also works well on desktop.

### Primary workflow

1. Select or create driver
2. Enter departure clocks
3. Select or create tractor
4. Select or create trailer
5. Enter load information
6. Enter starting location
7. Add shipper
8. Add any intermediate stops
9. Add final consignee
10. Configure stop durations and appointments
11. Calculate route
12. Review legal and operational warnings
13. Review route timeline
14. Modify assumptions
15. Save, print, or export the plan

### Main trip-planning screen

Use a clear three-area design:

#### Trip setup

Contains equipment, driver clocks, load information, stops, and planning assumptions.

#### Route map

Shows:

* Commercial route
* Stop markers
* State boundaries
* Required break areas
* Required rest periods
* Fuel events
* Restriction locations
* Tandem-adjustment alerts
* Illegal or unverified segments

#### Trip timeline

Shows every event in chronological order:

* Start
* Pre-trip
* Drive
* Break
* Fuel
* State entry
* Regulatory action
* Stop arrival
* Facility waiting
* Loading or unloading
* Departure
* 10-hour rest
* Final arrival
* Final service completion

Each timeline event must show:

* Local start and end time
* Duration
* Duty status
* Location
* Driving clock remaining
* Shift clock remaining
* Cycle clock remaining
* Explanation

### Clock display

Show three distinct gauges or cards:

* Drive remaining
* Shift remaining
* Cycle remaining

Do not combine them into one availability number.

At each stop, show clocks both:

* At arrival
* At departure

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

## 8. Tractor, Trailer, and Load Inputs

Create reusable equipment profiles.

### Tractor profile

Include:

* Unit number
* VIN, optional
* Tractor type
* Number of axles
* Overall tractor length
* Wheelbase
* Height
* Width
* Empty weight
* Registered gross weight
* Fuel capacity
* Estimated fuel range
* Governed speed
* Planning cruise speed
* Hazmat-equipped status
* California-compliant status fields where relevant
* Idle or auxiliary power assumptions
* Notes

### Trailer profile

Include:

* Trailer number
* Trailer type
* Trailer length
* Trailer width
* Trailer height
* Number of axles
* Sliding tandem capability
* Fixed or sliding axle configuration
* Current KPRA
* Minimum achievable KPRA
* Maximum achievable KPRA
* Trailer rail-position mapping, when known
* Empty weight
* Maximum payload
* Reefer status
* Liftgate status
* Special equipment
* Notes

### Load profile

Include:

* Load identifier
* Commodity
* Hazmat status
* Hazmat class, when applicable
* Gross cargo weight
* Tractor steer axle weight
* Tractor drive axle weight
* Trailer axle weight
* Total gross combination weight
* Load length
* Load width
* Load height
* Front overhang
* Rear overhang
* Temperature requirements
* Permit identifiers
* Permit restrictions
* Escort requirements
* Route restrictions
* High-value or secure-parking requirement
* Notes

Do not claim weight or dimension legality when required axle or dimensional information is missing.

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

## 26. Accessibility

Meet WCAG 2.2 AA where practical.

Include:

* Full keyboard navigation
* Proper labels
* Screen-reader-friendly stop ordering
* Accessible map alternatives
* Text timeline matching map information
* Do not use color alone for warning severity
* Sufficient contrast
* Large mobile touch targets
* Clear error messages
* Reduced-motion support

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
