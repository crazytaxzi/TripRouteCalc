# 02. Product Foundation, Domain Boundaries, Units, and Time

> Use this source as the active assignment for one dedicated implementation chat.  
> Read `00_SHARED_GUARDRAILS.md`, the repository implementation ledger, and every prerequisite source listed below before changing code.  
> Inspect the real repository first. Existing code is authoritative over guessed names, paths, schemas, packages, or architecture.

## Prerequisites

- Source 01 completed
- Repository audit and implementation ledger reviewed

## Goal

Establish the shared language and low-level foundations that every later engine will use. Create or refine domain primitives, explicit measurement types, timestamp handling, and supported-scope boundaries without implementing the full HOS or ETA engines yet.

## Required work

1. Define authoritative product terminology in code and documentation: arrival, check-in, service completion, departure, driving clock, shift clock, cycle clock, on-duty-not-driving, stop, and KPRA.
2. Define supported first-release operating scope and explicit unsupported or manually verified modes.
3. Create explicit unit types and conversion helpers:
   - distance, internally meters unless the repository already has a stronger standard
   - duration as integer minutes or seconds
   - weight as pounds with unit metadata
   - length as inches with unit metadata
   - speed with explicit units and safe conversion
4. Create timestamp and time-zone primitives:
   - UTC authoritative instant
   - IANA zone identifier
   - validated local appointment representation
   - DST-safe conversion utilities
5. Establish core domain entities and boundaries without prematurely coupling them to provider-specific schemas.
6. Add runtime validation for units, time zones, impossible ranges, and ambiguous bare numbers.
7. Add focused tests for conversions, precision, DST gaps/repeats, and serialization.
8. Document which types are authoritative and which are display-only.

## Hard boundaries

- Do not implement route-provider adapters in this stage.
- Do not bury HOS arithmetic in generic date utilities.
- Do not store values such as `40` without measurement meaning.
- Do not manually infer time-zone offsets from longitude.
- Do not redesign the UI.

## Exit gate

Later HOS, route, compliance, ETA, persistence, and API stages must be able to import one stable set of unit and time primitives.

## Relevant master requirements

## 2. Core Product Definition

TripRouteCalc allows a dispatcher, driver manager, planner, or driver to enter:

1. Driver availability and HOS clocks
2. Tractor information
3. Trailer information
4. Load information
5. Starting location
6. Shipper or first pickup
7. Any number of intermediate stops
8. Final delivery location
9. Stop appointment windows
10. Expected service time at every location
11. Operational planning assumptions

The application returns:

* A legal CMV route
* Total route miles
* Estimated driving time
* Estimated arrival at every stop
* Estimated departure from every stop
* Required break locations or approximate break windows
* Required 10-hour rest periods
* Remaining 11-hour, 14-hour, and cycle clocks at every event
* State and local compliance warnings
* Trailer and axle-position warnings
* Appointment feasibility
* Estimated final completion time
* Confidence level
* Detailed explanation of every delay, break, rest period, and adjustment

The user must be able to change any input and immediately recalculate the complete trip.

## 3. Terminology

Use the following definitions consistently throughout the codebase and interface.

### Arrival time

The time the tractor reaches the location.

### Check-in time

The time the driver is expected to complete gate entry or facility check-in.

### Service completion time

The time loading, unloading, drop-and-hook, inspection, paperwork, or other stop activity is expected to finish.

### Departure time

The time the driver can legally and operationally leave the location.

Arrival, service completion, and departure are not interchangeable.

### Driving clock

The driver’s available driving time under the applicable HOS rules. For a standard interstate property-carrying driver, this normally relates to the 11-hour driving limit.

### Shift clock

The remaining time in the driver’s 14-consecutive-hour driving window.

### Cycle clock

The remaining on-duty time in the applicable 60-hour/7-day or 70-hour/8-day cycle.

### On-duty not driving

Time spent performing work such as inspections, fueling, loading, unloading, paperwork, or many shipper and receiver activities.

### Stop

Any route location requiring an arrival calculation. Stops include:

* Starting terminal
* Tractor pickup
* Trailer pickup
* Fuel stop
* Scale
* Shipper
* Intermediate pickup
* Intermediate delivery
* Border or inspection point
* Required maintenance
* Rest location
* Final consignee
* Empty trailer return
* Driver terminal

### KPRA

Kingpin-to-rearmost-axle distance. Store this as a physical measurement. Do not assume that a trailer’s printed rail marker exactly equals legal KPRA unless the trailer configuration contains a verified mapping.

## 4. Supported Operating Mode

The first production release must focus on:

* United States property-carrying CMV operations
* Interstate routes
* A single solo driver
* Standard federal property-carrying HOS rules
* Tractor-semitrailer combinations
* Dry van, refrigerated, flatbed, and similar general freight equipment
* Single-stop and multi-stop loads

Design the architecture so that future modules may support:

* Team drivers
* Passenger-carrying operations
* Canada and Mexico
* Alaska-specific rules
* Intrastate HOS variations
* Oilfield rules
* Agricultural exemptions
* Short-haul operations
* Hazmat-specific restrictions
* Oversize and overweight permits
* Doubles and triples
* Personal conveyance
* Yard move integration
* ELD import

Do not apply any exception, exemption, emergency declaration, pilot program, adverse-driving exception, or special operating rule automatically.

Special rules must require an explicit, documented selection and sufficient supporting information.

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

## 19. Suggested Domain Model

At minimum, create domain entities equivalent to:

* User
* Carrier
* Driver
* DriverHosState
* DriverDutyEvent
* Tractor
* Trailer
* Load
* Trip
* TripRevision
* TripStop
* AppointmentWindow
* Route
* RouteLeg
* RouteSegment
* RouteRestriction
* JurisdictionRule
* Permit
* PlannedEvent
* ComplianceWarning
* Facility
* FacilityServiceProfile
* CalculationAssumption
* CalculationResult

Use explicit units.

Examples:

* Distance: meters internally
* Duration: integer seconds or minutes
* Weight: pounds internally, with unit metadata
* Length: inches internally, with unit metadata
* Speed: miles per hour or meters per second with clear conversion
* Time: UTC timestamp plus IANA time zone

Never store values such as `"40"` without the unit and measurement meaning.

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
