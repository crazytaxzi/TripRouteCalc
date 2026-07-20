# Stops, Appointments, and Service Time

Stage 10 models each trip stop as an independent, explicitly ordered planning object. A stop records its resolved location and IANA time zone, appointment semantics, facility hours, check-in duration, service-duration method, duty-status assumptions, parking availability, notes, and instructions.

## Time semantics

The stop processor keeps these timestamps distinct:

1. arrival
2. appointment or facility waiting
3. check-in
4. service start
5. service completion
6. any required HOS hold that can legally overlap the stop
7. legal and operational departure

Local appointments and facility windows are resolved through the shared DST-safe time module. Nonexistent local times are rejected. Repeated local times require an explicit earlier or later choice.

## Duration semantics

Service duration is explicit and may be exact, expected, a minimum/expected/maximum range, or a labeled historical average. The selected earliest, expected, or conservative projection determines which range value is used. Check-in is always stored separately from service.

Suggested defaults are produced only when a caller explicitly selects `suggestedStopDefaults()`. Every value can be overridden and then becomes ordinary revision input. No hidden delay is injected into a calculation.

## HOS integration

Waiting, check-in, service, and HOS holds become validated duty events and are passed to the existing pure HOS core. A 30-minute interruption or 10-hour rest is inserted only when required and when the stop explicitly permits the necessary parking. Cycle exhaustion remains blocked until the Stage 06 cycle engine resolves a known recap or selected restart.

Stage 10 does not claim route legality, facility permission, or appointment acceptance. It calculates from entered and resolved evidence and exposes warnings and blockers when the evidence is insufficient or contradictory.

## Persistence

Detailed stop configuration is persisted as an additive one-to-one extension of the existing immutable `trip_stops` rows. Sequence remains transactionally unique inside each trip revision, the detail row is carrier-bound to the parent stop, and each revision retains its original appointment, facility, duration, duty-status, parking, and instruction evidence.
