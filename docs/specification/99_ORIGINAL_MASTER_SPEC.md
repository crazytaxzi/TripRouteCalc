# TripRouteCalc: Production CMV Trip Routing, HOS, Compliance, and ETA Planning Application

You are working inside the canonical TripRouteCalc repository.

Your task is to design and implement a complete, production-ready commercial motor vehicle trip-routing and planning application.

The application must calculate realistic, legally feasible arrival estimates for property-carrying commercial motor vehicle drivers. It must account for:

* The tractor and trailer configuration
* Commercial-vehicle route restrictions
* Federal Hours of Service rules
* State and local restrictions encountered along the route
* The driver’s actual remaining clocks at departure
* The driver’s available cycle hours
* Shipper, intermediate stop, and consignee time
* Multiple pickup and delivery stops
* Required breaks and rest periods
* Time-zone changes
* Appointment windows
* Operational delays and configurable planning buffers

The goal is not to promise an exact arrival time. The goal is to produce a transparent, defensible, semi-accurate planning estimate showing when the driver can legally and realistically arrive at each location.

This is a safety-sensitive planning application. Do not simplify legal calculations into a single miles-divided-by-speed formula.

## 1. Non-Negotiable Development Rules

Before modifying or creating code:

1. Inspect the entire repository.
2. Identify the existing framework, package manager, database, API structure, styling system, authentication system, test setup, and deployment method.
3. Preserve the existing architecture when it is reasonable.
4. Do not replace a functioning stack merely because another stack is preferred.
5. Do not invent existing component names, database tables, routes, environment variables, or integrations.
6. Do not create duplicate services or parallel implementations of existing functionality.
7. Do not use placeholders, mock APIs, fake routing responses, fake regulatory data, or hardcoded demo calculations in production code.
8. Do not leave TODO comments for core functionality.
9. Do not claim that a route is legal unless the route has been checked against the available commercial-routing and regulatory data.
10. Do not use a consumer automobile route as the sole source for CMV routing.
11. Do not silently ignore unavailable information.
12. When information is missing, show exactly what could not be verified and lower the confidence of the result.
13. Every important calculation must be explainable to the user.
14. Build this as a planning tool, not as an electronic logging device and not as a substitute for the driver, motor carrier, safety department, permit office, or law enforcement.
15. Regulations must be data-driven, versioned, source-attributed, and updateable without rewriting the calculation engine.

If the repository is empty or truly greenfield, use the following default architecture:

* TypeScript throughout
* React with Vite for the frontend
* Mobile-first Progressive Web App
* Fastify or an equally lightweight TypeScript backend
* PostgreSQL
* Prisma or the repository’s established ORM
* Zod or equivalent runtime validation
* OpenAPI-documented REST API
* Vitest for unit and integration tests
* Playwright for end-to-end tests
* Docker Compose for reproducible local and production-like deployment
* pnpm workspaces if a monorepo is appropriate

Do not change an existing stack solely to match these defaults.

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

## 9. Commercial Route Engine

Create a provider-agnostic commercial-routing interface.

The application must be able to support a licensed commercial-routing provider without allowing provider-specific code to leak through the entire system.

Define an interface similar to:

```ts
interface CommercialRouteProvider {
  geocodeLocation(input: LocationInput): Promise<ResolvedLocation>;
  calculateRoute(request: CommercialRouteRequest): Promise<CommercialRouteResult>;
  getRouteRestrictions(routeId: string): Promise<RouteRestriction[]>;
  getTrafficEstimate?(request: TrafficRequest): Promise<TrafficEstimate>;
  getRoadClosures?(request: ClosureRequest): Promise<RoadClosure[]>;
}
```

The commercial route request must include:

* Tractor dimensions
* Trailer dimensions
* Combined dimensions
* Axle count
* Gross weight
* Axle weights when available
* KPRA
* Trailer count
* Hazmat status and classes
* Permit status
* Avoidances
* Start
* Ordered stops
* Departure time
* Preferred route policy

The route engine must account for available data concerning:

* Commercially prohibited roads
* Low clearances
* Bridge limits
* Weight-restricted roads
* Length restrictions
* KPRA restrictions
* Axle restrictions
* Truck-route designation
* STAA route eligibility
* Terminal-access routes
* Local truck prohibitions
* Seasonal roads
* Construction closures
* Weather closures
* Chain restrictions
* Tunnel restrictions
* Hazmat restrictions
* Ferry restrictions
* Border restrictions
* Permit-only roads

Never silently fall back from a commercial route to a consumer-car route.

A consumer route may be shown only as an explicitly labeled comparison and must not be used as the legal trip plan.

## 10. State and Local Regulatory Rules Engine

Create a separate compliance-rules engine.

Do not merge regulatory rules directly into the route provider adapter.

Each rule must contain:

* Unique rule identifier
* Jurisdiction
* Rule category
* Vehicle types affected
* Road or route scope
* Effective date
* Expiration date, when applicable
* Source authority
* Source title
* Source retrieval date
* Source version
* Human-readable explanation
* Machine-evaluable conditions
* Required action
* Severity
* Whether the rule blocks the route
* Whether manual verification is required

Supported rule severities:

* INFORMATION
* ADVISORY
* ACTION_REQUIRED
* ROUTE_RESTRICTED
* ROUTE_ILLEGAL
* MANUAL_VERIFICATION_REQUIRED

Rules must be selected according to the exact route geometry and road segments.

Do not apply every rule from every state merely because the route crosses that state.

### California tandem and KPRA example

Model the Oregon-to-California example correctly.

For a typical 53-foot semitrailer with two or more rear axles:

* Track the actual kingpin-to-rearmost-axle measurement.
* Evaluate the California maximum applicable to the selected route.
* Warn before the vehicle enters California when tandem adjustment is required.
* Show the last reasonable adjustment location before the border or restricted segment.
* Do not refer only to a vague “40-foot trailer mark.”
* Do not assume all trailer rail markings measure KPRA identically.
* Some routes or local jurisdictions may require a shorter KPRA than the general maximum.
* A route that cannot accommodate the entered KPRA must be rejected or rerouted.

Example warning:

“California route compliance action required before entering the restricted segment. Entered KPRA: 42 ft 6 in. Maximum supported by the selected route: 40 ft. Move the sliding tandem to achieve a verified KPRA of 40 ft or less, confirm axle weights remain legal, or select another legal route.”

After a tandem adjustment, require the user to confirm:

* New KPRA
* Trailer axle weight
* Drive axle weight
* Total gross weight
* Whether the load remains properly distributed

Moving the tandems for length compliance must not be assumed to preserve axle-weight compliance.

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

## 16. Trip Results

The results page must include:

### Summary

* Trip status
* Legal route status
* Total commercial miles
* Total driving time
* Total on-duty time
* Total off-duty time
* Total planned duration
* Departure time
* Final arrival time
* Final service completion time
* Number of required 30-minute interruptions
* Number of required 10-hour breaks
* Whether a restart is used
* Confidence level

### Stop table

For every stop:

* Sequence
* Stop name
* Stop type
* Local time zone
* Appointment
* Earliest legal arrival
* Expected arrival
* Conservative arrival
* Expected service start
* Expected departure
* Service duration
* Drive clock at arrival
* Shift clock at arrival
* Cycle clock at arrival
* Drive clock at departure
* Shift clock at departure
* Cycle clock at departure
* Status
* Warnings

### Compliance section

Show:

* Federal HOS status
* Route legality status
* Vehicle dimension status
* Weight status
* KPRA status
* Hazmat status
* Permit status
* Unverified data
* Required driver or dispatcher actions

### Explanation section

Generate plain-language explanations such as:

“Although the driver has 8 hours 40 minutes of driving time remaining, only 5 hours 15 minutes remain in the current 14-hour window. The driver can therefore drive no more than 5 hours 15 minutes before a qualifying rest period, assuming no additional on-duty activity.”

“Stop 2 includes 45 minutes of on-duty-not-driving time. This consumes 45 minutes from the 14-hour window and cycle, but it does not reduce the 11-hour driving allowance.”

“The planned 45-minute delivery stop satisfies the required 30-minute interruption because it is a consecutive non-driving period of at least 30 minutes under the selected rule set.”

“Arrival at the final consignee is estimated for Tuesday at 7:20 AM Central Time. Unloading is expected to finish at approximately 8:20 AM.”

## 17. Confidence and Data Quality

Calculate an ETA confidence rating.

Possible levels:

* HIGH
* MODERATE
* LOW
* UNVERIFIED

Factors lowering confidence include:

* Missing axle weights
* Unknown KPRA
* Unknown trailer dimensions
* Missing appointment windows
* No live traffic data
* No weather data
* Use of average-speed fallback
* Unknown facility service times
* Unverified local truck access
* Missing permit information
* Route-provider restrictions unavailable
* User-entered address not fully resolved
* Route segment requiring manual verification

Display the reasons for the confidence rating.

Do not use a decorative confidence percentage without a documented calculation.

## 18. Persistence and Auditability

Save:

* Drivers
* Tractor profiles
* Trailer profiles
* Facilities
* Historical stop times
* Trips
* Trip revisions
* Route responses
* Regulatory rules used
* Calculation assumptions
* Timeline events
* User overrides
* Warning acknowledgements
* Export history

Every recalculation must create a revision or calculation snapshot containing:

* Input values
* Rule-set version
* Routing-provider version
* Calculation timestamp
* Result
* Warnings
* User overrides

Do not overwrite the only copy of a prior trip plan.

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

## 20. API Requirements

Create documented APIs equivalent to:

* `POST /api/trips`
* `GET /api/trips/:tripId`
* `PATCH /api/trips/:tripId`
* `POST /api/trips/:tripId/stops`
* `PATCH /api/trips/:tripId/stops/:stopId`
* `DELETE /api/trips/:tripId/stops/:stopId`
* `POST /api/trips/:tripId/stops/reorder`
* `POST /api/trips/:tripId/calculate`
* `GET /api/trips/:tripId/revisions`
* `GET /api/trips/:tripId/timeline`
* `GET /api/trips/:tripId/compliance`
* `POST /api/equipment/tractors`
* `POST /api/equipment/trailers`
* `POST /api/drivers`
* `POST /api/routes/validate`
* `GET /api/regulations/version`

The calculation endpoint must return structured data, not only a formatted sentence.

Include:

* Route
* Legs
* Stops
* Timeline
* HOS state transitions
* Warnings
* Regulatory actions
* Confidence
* Explanation
* Calculation metadata

## 21. Validation Rules

Reject or explicitly flag:

* Negative remaining clocks
* Driving clock above the configured legal maximum
* Shift clock above the configured maximum
* Cycle clock above the selected cycle maximum
* Departure before the current duty-status start
* Stop service duration below zero
* Missing start or final
* Duplicate stop sequence numbers
* Invalid time zones
* Trailer KPRA greater than physically possible
* Trailer KPRA below physically possible minimum
* Gross weight below the sum of known axle weights
* Vehicle height, width, length, or weight missing when required for route validation
* Hazmat load with no hazmat class
* Permit-required configuration with no permit information
* Appointment end before appointment start
* Route response containing a prohibited segment

Warnings are not all equal.

A route-legality failure must block finalization.

An uncertain facility duration may lower confidence without blocking the calculation.

## 22. Required Test Scenarios

Create comprehensive automated tests.

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

### Route-compliance tests

1. Oregon origin to California destination with compliant KPRA.
2. Oregon origin to California destination with excessive KPRA.
3. KPRA adjustment resolves length issue but causes axle-weight warning.
4. Route segment with 38-foot KPRA restriction.
5. Low-clearance road rejected.
6. Weight-restricted bridge rejected.
7. Consumer route differs from commercial route.
8. Route provider unavailable.
9. Local terminal access cannot be confirmed.
10. Route crosses multiple jurisdictions with different rules.

### Time tests

1. Pacific to Mountain time.
2. Mountain to Central time.
3. Central to Eastern time.
4. Daylight-saving spring transition.
5. Daylight-saving fall transition.
6. Appointment entered in destination-local time.
7. Route crossing a time-zone boundary during a rest period.

## 23. Example Planning Scenario

Use the following scenario as an acceptance test, not as hardcoded application data.

Driver departure state:

* Start: Portland, Oregon
* Departure: user-selected date at 8:00 AM Pacific
* Drive remaining: 8 hours 30 minutes
* Shift remaining: 10 hours
* Cycle remaining: 18 hours
* Time driven since last qualifying interruption: 2 hours
* Solo property-carrying driver
* 70-hour/8-day cycle

Equipment:

* Sleeper tractor
* 53-foot tandem-axle dry van
* Sliding tandems
* Entered KPRA: 42 feet
* Minimum achievable KPRA: 37 feet
* Standard legal width and height
* User-entered axle weights

Stops:

1. Start terminal in Portland
2. Shipper in Salem, Oregon

   * 45-minute expected service
3. Intermediate delivery near Redding, California

   * 60-minute expected service
4. Final delivery near Sacramento, California

   * 60-minute expected service

The application must:

* Generate a commercial route.
* Detect that California KPRA compliance must be evaluated.
* Warn that the entered 42-foot KPRA is not acceptable for a route requiring 40 feet or less.
* Require tandem adjustment or rerouting before treating the route as legal.
* Recheck axle weights after the proposed adjustment.
* Apply 45 minutes at the shipper.
* Calculate whether that stop satisfies a required 30-minute interruption.
* Insert a 10-hour break when any applicable clock prevents further driving.
* Calculate arrival and departure at Redding.
* Calculate arrival and service completion at Sacramento.
* Display every timestamp in the stop’s local time zone.
* Show remaining driving, shift, and cycle clocks at every arrival and departure.
* Explain the calculations in plain language.

## 24. Regulatory Update Strategy

Do not treat regulatory data as timeless.

Create:

* Rule-set versioning
* Effective dates
* Source attribution
* Last-verified timestamps
* Administrative rule review
* Ability to deactivate obsolete rules
* Change history
* Tests tied to regulatory versions

The interface must show:

“Regulatory data last verified: [date]. Confirm current restrictions with official authorities when required.”

Do not scrape random trucking blogs as legal authority.

Prefer:

* Federal regulations
* FMCSA
* FHWA
* State departments of transportation
* State legislatures
* State police or commercial-vehicle enforcement agencies
* Municipal ordinances
* Official permit and route maps
* Contracted commercial-routing data

Secondary sources may assist discovery but must not become the authoritative compliance record.

## 25. Security and Privacy

Implement:

* Authentication
* Authorization
* Input validation
* Rate limiting
* Secure secret handling
* No API keys in client bundles
* No secrets committed to source control
* Audit logging for administrative regulatory changes
* Protection against SQL injection
* Protection against cross-site scripting
* Protection against insecure direct-object access
* Safe export generation
* Account-level data isolation

Driver location, trip history, and HOS information are sensitive operational data.

Do not expose them publicly.

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

## 27. Exporting

Support:

* Printable trip plan
* PDF export
* CSV stop schedule
* JSON calculation export

The printable plan must include:

* Driver
* Equipment
* Load
* Route
* Stop schedule
* HOS timeline
* Compliance actions
* Warnings
* Assumptions
* Rule-set version
* Calculation time
* Disclaimer

Do not export secrets, internal database identifiers, or provider credentials.

## 28. Required Documentation

Create or update:

* README
* Architecture overview
* Local setup guide
* Environment-variable reference
* Database migration guide
* Routing-provider integration guide
* Regulatory-rule update guide
* HOS calculation documentation
* Calculation examples
* Testing guide
* Deployment guide
* Backup and restore guide
* Known limitations
* Safety and legal disclaimer

The HOS documentation must explain how each duty event affects:

* Driving time
* Shift time
* Cycle time
* Break qualification
* Sleeper qualification

## 29. Implementation Sequence

Complete the work in this order:

1. Repository audit
2. Domain model
3. Units and time-handling foundation
4. HOS engine
5. HOS unit tests
6. Equipment and load validation
7. Commercial-route provider interface
8. Compliance-rules engine
9. Stop and appointment engine
10. ETA simulator
11. Confidence calculation
12. Persistence
13. APIs
14. Mobile-first UI
15. Route timeline
16. Map integration
17. Exports
18. End-to-end tests
19. Security review
20. Documentation
21. Production build verification

Do not begin with visual polish while the time, HOS, and compliance foundations are incomplete.

## 30. Completion Criteria

The project is not complete until:

* A user can enter a real driver’s remaining clocks.
* A user can enter tractor, trailer, and load information.
* A user can enter a start, shipper, unlimited intermediate stops, and a final.
* Stops can be dynamically added, removed, and reordered.
* Every stop has independent appointment and service-time settings.
* A commercial route can be requested.
* Route restrictions are evaluated.
* The driver’s HOS timeline is simulated.
* Required breaks and rest periods are inserted.
* Arrival, service-start, departure, and final-completion times are distinct.
* Results show local time zones.
* California KPRA-type restrictions can be represented correctly.
* Route-specific state and local rules can be updated without modifying the core HOS engine.
* Every calculation can be explained.
* Missing data lowers confidence or blocks the route appropriately.
* Unit, integration, and end-to-end tests pass.
* Production build succeeds.
* Database migrations succeed on a clean database.
* No fake backend or placeholder calculation remains.
* Documentation matches the implementation.

At the end of implementation, provide:

1. A concise architecture summary
2. A list of files created or changed
3. Database migration details
4. Routing-provider setup instructions
5. Regulatory-data setup instructions
6. Commands to run locally
7. Commands to run tests
8. Commands to build for production
9. Known limitations
10. Evidence that the production build and tests pass

Do not report the application as complete unless those checks have actually been run.
