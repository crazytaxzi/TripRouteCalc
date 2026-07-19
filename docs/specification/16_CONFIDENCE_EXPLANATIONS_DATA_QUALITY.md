# 16. Confidence, Explanations, and Data Quality

> Use this source as the active assignment for one dedicated implementation chat.  
> Read `00_SHARED_GUARDRAILS.md`, the repository implementation ledger, and every prerequisite source listed below before changing code.  
> Inspect the real repository first. Existing code is authoritative over guessed names, paths, schemas, packages, or architecture.

## Prerequisites

- Source 15 simulator producing structured events and warnings
- Routing and regulatory verification metadata available

## Goal

Create a documented, deterministic confidence model and plain-language explanation layer. Confidence must reflect actual missing or unverified inputs, not decorative optimism.

## Required work

1. Implement the levels HIGH, MODERATE, LOW, and UNVERIFIED.
2. Define a documented rules-based scoring or classification method.
3. Include every confidence-lowering factor listed in the master specification.
4. Distinguish:
   - legal blocking failures
   - manual verification requirements
   - operational uncertainty
   - missing live data
   - user-estimated inputs
5. Return machine-readable reasons and user-facing explanations.
6. Explain independent HOS constraints, stop clock effects, qualifying interruptions, rests, appointment waiting, compliance actions, speed fallbacks, and final local-time results.
7. Reference exact events, inputs, rules, route segments, and revisions.
8. Avoid legal conclusions when the confidence is unverified or a blocking field is missing.
9. Add tests that assert both classification and reasons.
10. Ensure explanations remain stable enough for audit but do not expose secrets or internal identifiers.

## Hard boundaries

- No unsupported confidence percentage.
- No “route legal” label when route or regulation verification failed.
- No vague “traffic may vary” as a substitute for enumerated data-quality reasons.
- Do not let prose become the only calculation output.

## Exit gate

Every projection carries a transparent confidence level and reasons, and a user can understand the dominant legal and operational constraints without reading code.

## Relevant master requirements

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
