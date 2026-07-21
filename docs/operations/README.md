# Fuel, Inspections, and Operational Events

Stage 14 models operational work as structured timeline events rather than hiding it inside drive time or a generic delay. The public foundation boundary supports pre-trip inspection, post-trip inspection, fuel, scale, cargo securement, reefer checks, maintenance, border or agricultural inspection, parking search, meal, and shower events.

TripRouteCalc remains a planning tool. It does not establish that a location is available, that a duty-status treatment is legally valid, or that a route is legal unless the required evidence is present.

## Event evidence

Each operational plan records:

- a distinct event type and identifier;
- exact or minimum, expected, and maximum duration;
- duty status and explicit clock effects through the existing HOS engine;
- location and IANA time zone when placement requires one;
- source, source reference, verification timestamp, and explanation;
- route-distance, segment, stop, or before/after-driving placement constraints;
- whether a 30-minute interruption overlap or rest overlap is requested;
- any user override and its source; and
- any planning buffer as a separate, non-legal duration.

Operational events never become unexplained generic delays. Fueling, inspection, securement, reefer, scale, maintenance, border, and parking-search work default to on-duty-not-driving. Another status requires recorded legal support. On-duty operational time cannot be represented as qualifying rest.

## Placement safeguards

Pre-trip inspection must occur before the first driving event. Post-trip inspection cannot be inserted before any driving has occurred. Explicitly selected locations are checked for truck compatibility, required capability, exact route-distance placement, and earliest or latest placement windows.

Provider-selected locations must be supplied by the caller as verified evidence. The planner does not invent fuel, scale, maintenance, parking, meal, shower, or inspection locations when none are available.

## Fuel planning

Fuel planning uses explicit US-gallon and mile conversions over the canonical unit objects. Inputs include tank capacity, current level, estimated miles per gallon, route distance, required reserve, and supplied truck-compatible fuel locations.

The planner:

1. rejects physically inconsistent or invalid fuel inputs;
2. uses current fuel above reserve as the initial usable range;
3. schedules only supplied verified truck-compatible fuel locations;
4. supports immediate origin fueling when current fuel is below reserve and a verified origin fuel location is supplied;
5. blocks an uncovered route gap as insufficient range; and
6. reports unavailable location evidence without fabricating a stop.

Fuel stops are on-duty-not-driving by default. The fuel plan does not claim price, open hours, pump availability, payment acceptance, or route legality.

## HOS behavior

Scheduled operational work becomes validated duty events and is composed with the existing pure HOS core. On-duty-not-driving events advance the 14-hour window and consume cycle time without consuming the 11-hour driving allowance. A qualifying 30-minute interruption is recognized only from the recorded duration and status under the configured rule set. Rest overlap is allowed only when the event status and duration legally qualify.

## Persistence

Stage 14 requires no schema migration. Operational plans, event sources, and user overrides are retained inside the existing immutable trip-revision input and override snapshots. The persistence integration test verifies that a prior revision remains queryable after a later revision changes operational-event duration or source evidence.

## Known limits

- B-002 remains open, so live commercial-route and route-aware location evidence are unavailable.
- No live fuel, parking, scale, maintenance, border, meal, shower, traffic, closure, or facility provider is configured.
- Supplied fixture locations are test evidence only and must not be represented as production availability.
- ETA placement and cross-time-zone simulation continue in Stage 15.
