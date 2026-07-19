# 09. Tractor, Trailer, Load, Dimensions, and Weight

> Use this source as the active assignment for one dedicated implementation chat.  
> Read `00_SHARED_GUARDRAILS.md`, the repository implementation ledger, and every prerequisite source listed below before changing code.  
> Inspect the real repository first. Existing code is authoritative over guessed names, paths, schemas, packages, or architecture.

## Prerequisites

- Sources 01 through 03 completed
- Explicit unit types available

## Goal

Implement reusable equipment and load profiles with enough validated physical data to support commercial routing and compliance without inventing legality.

## Required work

1. Implement all tractor profile fields in the master specification.
2. Implement all trailer profile fields, including physical KPRA range and optional verified rail-position mapping.
3. Implement all load profile fields, including axle weights, total gross combination weight, dimensions, permits, hazmat metadata, overhang, escorts, and secure-parking needs.
4. Use explicit unit-bearing values in domain, persistence, validation, APIs, and UI models.
5. Validate physically impossible KPRA, dimensions, capacity, and weight combinations.
6. Check that total gross weight is not less than known axle weights.
7. Require hazmat class when hazmat is selected.
8. Require permit data when the entered configuration requires permits.
9. Produce structured:
   - blocking errors
   - action-required warnings
   - missing-data confidence reasons
10. Never claim weight or dimension legality when required data is missing.
11. Add profile CRUD and validation tests appropriate to the existing architecture.
12. Document which values are measured, manufacturer-rated, carrier-configured, or user-estimated.

## Hard boundaries

- A printed trailer rail marker is not automatically a verified KPRA measurement.
- Do not infer axle weights from gross weight.
- Do not treat a “standard 53-foot trailer” label as complete routing input.
- Do not add provider-specific fields to core equipment entities unless isolated in extension metadata.

## Exit gate

A route request can be populated with validated physical measurements, and missing critical measurements are surfaced rather than fabricated.

## Relevant master requirements

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
