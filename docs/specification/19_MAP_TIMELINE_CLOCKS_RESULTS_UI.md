# 19. Route Map, Event Timeline, Clocks, and Results

> Use this source as the active assignment for one dedicated implementation chat.  
> Read `00_SHARED_GUARDRAILS.md`, the repository implementation ledger, and every prerequisite source listed below before changing code.  
> Inspect the real repository first. Existing code is authoritative over guessed names, paths, schemas, packages, or architecture.

## Prerequisites

- Source 18 trip setup complete
- Source 15 structured timeline and Source 17 result APIs stable
- Commercial map/provider licensing understood

## Goal

Implement the route review experience: commercial route visualization, chronological event timeline, clock state at every event, stop projection table, compliance findings, and explanations.

## Required work

1. Build the three-area setup/map/timeline layout responsively, adapting it for small screens without losing information.
2. Show commercial route geometry, stops, state boundaries when available, break/rest/fuel events, restriction points, tandem actions, and illegal/unverified segments.
3. Do not visually imply an unverified segment is legal.
4. Provide an accessible text alternative containing all material map information.
5. Render every planned event in chronological order with:
   - local start/end
   - duration
   - duty status
   - location
   - drive remaining
   - shift remaining
   - cycle remaining
   - explanation
6. Show separate drive, shift, and cycle gauges/cards.
7. Show clock values at every stop arrival and departure.
8. Implement the full result summary, stop table, compliance section, and explanation section.
9. Display earliest, expected, and conservative arrival distinctly.
10. Display route, weight, dimension, KPRA, hazmat, permit, HOS, and unverified status with severity text/icons, not color alone.
11. Handle long multi-stop trips, loading states, partial provider data, and print-friendly views.
12. Add component, accessibility, and end-to-end interaction tests.

## Hard boundaries

- Do not collapse arrival, service completion, and departure.
- Do not show a consumer route as the plan.
- Do not hide warnings behind map-only markers.
- Do not recalculate legal clocks in presentation components.

## Exit gate

A dispatcher can audit the entire plan from route and timeline views, including the reason and remaining clocks at every event.

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
