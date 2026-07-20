# HOS Test Fixtures and Legal Assumptions

Stage 08 fixtures are deterministic evidence builders for the accepted Stage 04 through Stage 07 HOS boundaries. They are test-only and are not production defaults, route-provider fallbacks, or legal data.

The master acceptance scenarios use stable identifiers `HOS-01` through `HOS-15` so a failure names the controlling scenario before reporting the event, clock, or transition that failed.

## Authoritative representation

- All authoritative timestamps are explicit UTC ISO 8601 instants.
- All authoritative durations are non-negative whole minutes.
- Location and display time zones use IANA identifiers.
- Display-zone changes never alter UTC elapsed time or legal arithmetic.
- Departure driving, shift, and cycle clocks remain independent inputs.
- Event arrays are supplied in caller order. Validation never silently sorts or repairs them.

## Standard fixture

The default solo property-carrying driver begins with:

- 660 driving minutes
- 840 shift-window minutes
- 4,200 cycle minutes on the 70-hour/8-day cycle
- zero minutes driven since the last qualifying interruption
- a completed standard 10-hour break
- no automatic exception, exemption, restart, adverse condition, or sleeper pair

Tests override only the facts required by the scenario.

## Event assumptions

- `DRIVING` consumes driving, shift, and cycle time.
- `ON_DUTY_NOT_DRIVING` consumes shift and cycle time.
- `OFF_DUTY` and `SLEEPER_BERTH` do not consume cycle time.
- Ordinary off-duty waiting does not pause an active 14-hour window.
- A fuel event is on duty unless explicit evidence says otherwise.
- A 30-minute interruption is derived from consecutive non-driving statuses, not from a descriptive label alone.

## Sleeper fixtures

- The long paired period must contain at least 420 consecutive `SLEEPER_BERTH` minutes.
- The short paired period must contain at least 120 consecutive `OFF_DUTY` or `SLEEPER_BERTH` minutes.
- The periods must total at least 600 minutes and must share one explicit pair identifier.
- Candidate metadata never applies a pair without explicit selection and complete validation.
- A valid explicitly selected pair may coexist with a Stage 05 ten-hour-reset interpretation; each module preserves its own result.

## Cycle fixtures

- Cycle history is complete and contiguous across the required seven-day or eight-day regulatory window.
- Recaps return at the configured carrier home-terminal boundary, not at an assumed midnight.
- A 34-hour restart requires 2,040 consecutive qualifying minutes and explicit restart intent or historical selection.

## Adverse and carrier fixtures

- Adverse mode is disabled unless an explicit evidence-backed selection is supplied.
- An adverse extension never exceeds 120 minutes and never restores cycle availability or waives the interruption.
- Carrier driving and duty targets are stricter planning limits and remain distinguishable from federal maxima.
- Unsupported exceptions and pilot rules remain blocking/manual and do not alter clocks.

## Persistence fixture

The repeated-local-hour integration fixture uses `America/Los_Angeles` on November 1, 2026. The short rest period spans 07:30Z to 09:30Z, which is exactly 120 elapsed UTC minutes even though the local clock repeats an hour. The round trip must preserve both UTC instants, the IANA zone, sleeper-pair identity, and canonical hashes.
